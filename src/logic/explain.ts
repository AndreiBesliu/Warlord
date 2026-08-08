// src/logic/explain.ts
// "What does this setting actually do, and what would my change do?"
//
// Answered by RUNNING a day with the proposed configuration, on a reference domain, and
// diffing it against a day run with the current one. Not by re-deriving the formulas in
// the admin — this codebase has shipped that mistake three times, and an admin that
// promises numbers the game does not pay is worse than an admin with no preview at all.
//
// Pure: no React, no I/O. The caller supplies the two configurations.

import { GameConfig, type GameConfigOverrides } from './config'
import {
  simulateEconomyDay, BUILDING_OUTPUT_VALUE, buildingLevelMult, buildingCostCopper,
  buildingUpgradeCostCopper, buildingResourceCost, BUILDING_MAX_LEVEL,
  manufacturingRecipe, BuildingOutputChoices,
  dailyUpkeepCopper, dailyFoodConsumption,
} from './economy'
import { makeEmptyInventories } from './helpers'
import { Registry } from './registry'
import { itemValueCopper } from './items'
import { missionPresets, computeReward } from './combat/enemies'
import type { Difficulty } from './combat/types'
import {
  fmtCopper, ResourceTypes,
  type Building, type BuildingType, type ResourceMap, type Rank, type SoldierType, type Unit,
} from './types'

// Item prices come from the Registry, and this module is imported by hosts that never
// mount the game (the balance admin). Without this, every item value reads 0, every
// items/day comes out 0, and the panel silently reports that nothing produces anything.
// `init` is guarded, so calling it here is free when the game already did.
Registry.init()

/** A domain with one of every building, so a change anywhere shows up somewhere. */
export function referenceDomain(level = 1, focusCoinPct: Building['focusCoinPct'] = 0): Building[] {
  return (Object.keys(BUILDING_OUTPUT_VALUE) as BuildingType[]).map((type) => ({
    id: `ref_${type}`,
    type,
    focusCoinPct,
    outputItem: BuildingOutputChoices[type]?.options?.[0],
    fractionalBuffer: 0,
    level,
  }))
}

const fullStores = (): ResourceMap =>
  Object.fromEntries(ResourceTypes.map((r) => [r, 100_000])) as ResourceMap

/** Buildings that yield only coin have no output item; asking the Registry for "" only warns. */
const priceOf = (item: string): number => (item ? itemValueCopper(item) || 0 : 0)

/**
 * Runs `fn` as if `cfg` were the active configuration, then restores whatever was active.
 * The admin needs to see the effect of the values it is EDITING, not of the values the
 * player is currently living under — but GameConfig is a global singleton, so previewing
 * must never leak. `finally` covers the throwing case.
 */
function under<T>(cfg: GameConfigOverrides | null | undefined, fn: () => T): T {
  if (cfg === undefined) return fn()
  const saved = GameConfig.raw()
  GameConfig.init(cfg)
  try {
    return fn()
  } finally {
    GameConfig.init(saved)
  }
}

export interface BuildingEffect {
  type: BuildingType
  outputItem: string
  /** Copper of value per day, after level and research. */
  valuePerDay: number
  coinPerDay: number
  /** Items per day as a rate — the integer that lands varies with the buffer. */
  itemsPerDay: number
  /** What one day of this building eats, by resource. */
  consumesPerDay: Partial<Record<string, number>>
  /** True when the building wanted to produce but had nothing to produce from. */
  blocked: boolean
  /**
   * Value the building turns out and then throws away, per day. A building with no item to
   * make (the Minter) converts only the coin share of its output; everything the focus
   * slider leaves on the material side simply ceases to exist.
   */
  valueLostPerDay: number
}

/**
 * Runs one day for a single building, in isolation, with stores deep enough that nothing
 * is input-limited — so the answer is "what this building does", not "what it managed today".
 */
export function explainBuilding(
  type: BuildingType,
  opts: {
    level?: number
    focusCoinPct?: Building['focusCoinPct']
    outputItem?: string
    /** Evaluate under this configuration instead of the active one (the admin's pending edits). */
    config?: GameConfigOverrides | null
  } = {},
): BuildingEffect {
  return under(opts.config, () => explainBuildingNow(type, opts))
}

function explainBuildingNow(
  type: BuildingType,
  opts: { level?: number; focusCoinPct?: Building['focusCoinPct']; outputItem?: string },
): BuildingEffect {
  const level = opts.level ?? 1
  const focusCoinPct = opts.focusCoinPct ?? 0
  const outputItem = opts.outputItem ?? BuildingOutputChoices[type]?.options?.[0] ?? ''
  const before = fullStores()
  const day = simulateEconomyDay({
    buildings: [{ id: 'x', type, focusCoinPct, outputItem, fractionalBuffer: 0, level }],
    resources: before,
    inv: makeEmptyInventories(),
    units: [],
  })
  const line = day.breakdown[0]
  // The same building at full coin focus turns out its whole value as coin, which is the
  // only honest way to ask "how much value did this day actually turn out?" — the answer
  // at any other focus can be smaller, and for a building with no item to make it is.
  const fullValue = focusCoinPct === 100 ? (line?.coinGain ?? 0) : simulateEconomyDay({
    buildings: [{ id: 'x', type, focusCoinPct: 100, outputItem, fractionalBuffer: 0, level }],
    resources: fullStores(),
    inv: makeEmptyInventories(),
    units: [],
  }).breakdown[0]?.coinGain ?? 0
  const consumes: Partial<Record<string, number>> = {}
  for (const r of ResourceTypes) {
    const used = (before[r] ?? 0) - (day.resources[r] ?? 0)
    // Nature's +1 wood is not this building's doing.
    const adjusted = r === 'WOOD' ? used + 1 : used
    if (adjusted > 0) consumes[r] = adjusted
  }
  const delivered = Math.round((line?.coinGain ?? 0) + (line?.itemsFloat ?? 0) * 0.7 * priceOf(outputItem))
  return {
    type,
    outputItem,
    valuePerDay: delivered,
    coinPerDay: line?.coinGain ?? 0,
    itemsPerDay: +(line?.itemsFloat ?? 0).toFixed(2),
    consumesPerDay: consumes,
    blocked: !!line?.blocked,
    valueLostPerDay: Math.max(0, Math.round(fullValue) - delivered),
  }
}

/** Human-readable arithmetic for one building, with the real numbers substituted in. */
export function buildingFormula(
  type: BuildingType,
  level = 1,
  focusCoinPct = 0,
  config?: GameConfigOverrides | null,
): string[] {
  return under(config, () => buildingFormulaNow(type, level, focusCoinPct))
}

function buildingFormulaNow(type: BuildingType, level: number, focusCoinPct: number): string[] {
  // The configured value wins over the built-in table, so the formula shows the number
  // actually in force — which is the whole point of showing it.
  const base = GameConfig.buildingOutputValue(type) ?? BUILDING_OUTPUT_VALUE[type]
  const price = buildingCostCopper(type)
  const lvl = buildingLevelMult(level)
  const outputItem = BuildingOutputChoices[type]?.options?.[0] ?? ''
  const mv = priceOf(outputItem)
  const value = (base ?? 0.1 * price) * lvl
  const coin = Math.round(value * (focusCoinPct / 100))
  const lines = [
    base !== undefined
      ? `value/day = ${fmtCopper(base)} (this building) × ${lvl.toFixed(1)} (level ${level}) = ${fmtCopper(Math.round(value))}`
      : `value/day = 10% of the price ${fmtCopper(price)} × ${lvl.toFixed(1)} (level ${level}) = ${fmtCopper(Math.round(value))}`,
    `coin/day = value × ${focusCoinPct}% focus = ${fmtCopper(coin)}`,
  ]
  if (mv > 0) {
    lines.push(
      `items/day = (value − coin) ÷ (0.7 × ${fmtCopper(mv)} per ${outputItem}) = ${((value - coin) / (0.7 * mv)).toFixed(2)}`,
    )
    const recipe = manufacturingRecipe(outputItem)
    if (recipe && Object.keys(recipe).length) {
      const per = Object.entries(recipe).map(([r, q]) => `${q} ${r}`).join(' + ')
      lines.push(`each ${outputItem} consumes ${per}`)
    }
  } else {
    // Not "all of its value is coin": the engine converts only the coin share and drops the
    // rest, so a Minter left on the default material focus turns out nothing at all.
    lines.push(`this building has NO item to make — only the coin share is paid`)
    if (focusCoinPct < 100) {
      lines.push(`the other ${100 - focusCoinPct}% (${fmtCopper(Math.round(value - coin))}/day) is DESTROYED — set its focus to 100% coin`)
    }
  }
  lines.push(`research multiplies value (production ×) and item yield (crafting ×) on top`)
  return lines
}

export interface DomainDelta {
  wallet: number
  resources: Partial<Record<string, number>>
}

/**
 * What a proposed configuration changes, per day, on the reference domain: the honest
 * answer to "what will this do?" because both sides are produced by the tick's own function.
 *
 * Restores whatever configuration was active before it ran — the GameConfig singleton is
 * global, and a preview must never leave the game on the values it was previewing.
 */
export function compareConfigs(current: GameConfigOverrides | null, proposed: GameConfigOverrides | null, level = 1): DomainDelta {
  const saved = GameConfig.raw()
  const runOne = (cfg: GameConfigOverrides | null) => {
    GameConfig.init(cfg)
    const start = fullStores()
    const day = simulateEconomyDay({
      buildings: referenceDomain(level),
      resources: start,
      inv: makeEmptyInventories(),
      units: [],
    })
    const res: Record<string, number> = {}
    for (const r of ResourceTypes) res[r] = (day.resources[r] ?? 0) - (start[r] ?? 0)
    return { wallet: day.incomeWalletDelta, res }
  }
  try {
    const a = runOne(current)
    const b = runOne(proposed)
    const resources: Partial<Record<string, number>> = {}
    for (const r of ResourceTypes) {
      const d = b.res[r] - a.res[r]
      if (d !== 0) resources[r] = d
    }
    return { wallet: b.wallet - a.wallet, resources }
  } finally {
    GameConfig.init(saved)
  }
}

// ── The other knobs an admin turns, each answered by the game's own function ──

export interface RecipeEconomics {
  item: string
  itemValue: number
  materialsValue: number
  materials: { resource: string; qty: number; unitValue: number; total: number }[]
  /** Materials as a share of the item's value. Above 1 means crafting burns value. */
  ratio: number
  destroysValue: boolean
  lines: string[]
}

/**
 * Is this recipe worth crafting? Every recipe in the game once cost more in materials than
 * the item was worth, so a workshop was a way to end the day poorer. The panel warns about
 * that in prose; this measures it.
 */
export function explainRecipe(item: string, config?: GameConfigOverrides | null): RecipeEconomics {
  return under(config, () => {
    const recipe = manufacturingRecipe(item) ?? {}
    const itemValue = priceOf(item)
    const materials = Object.entries(recipe)
      .filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0)
      .map(([resource, qty]) => {
        const unitValue = priceOf(resource)
        return { resource, qty, unitValue, total: qty * unitValue }
      })
    const materialsValue = materials.reduce((s, m) => s + m.total, 0)
    const ratio = itemValue > 0 ? materialsValue / itemValue : Infinity
    const lines = [
      ...materials.map((m) => `${m.qty} × ${m.resource} @ ${fmtCopper(m.unitValue)} = ${fmtCopper(m.total)}`),
      `materials ${fmtCopper(materialsValue)} vs ${item} ${fmtCopper(itemValue)} → ${
        itemValue > 0 ? `${Math.round(ratio * 100)}% of the item's value` : 'the item has no price'
      }`,
    ]
    return { item, itemValue, materialsValue, materials, ratio, destroysValue: materialsValue > itemValue, lines }
  })
}

export interface BuildingCostEffect {
  build: number
  /** What it costs to reach each further level, and the running total from nothing. */
  upgrades: { toLevel: number; cost: number; cumulative: number }[]
  resources: Partial<ResourceMap>
  lines: string[]
}

/** What a building costs to put up and to raise, at the prices currently in the form. */
export function explainBuildingCost(type: BuildingType, config?: GameConfigOverrides | null): BuildingCostEffect {
  return under(config, () => {
    const build = buildingCostCopper(type)
    const upgrades: BuildingCostEffect['upgrades'] = []
    let cumulative = build
    for (let level = 1; level < BUILDING_MAX_LEVEL; level++) {
      const cost = buildingUpgradeCostCopper(type, level)
      cumulative += cost
      upgrades.push({ toLevel: level + 1, cost, cumulative })
    }
    const resources = buildingResourceCost(type)
    const lines = [
      `build = ${fmtCopper(build)}`,
      ...upgrades.map((u) => `L${u.toLevel - 1}→L${u.toLevel} = price × 0.6 × ${u.toLevel - 1} = ${fmtCopper(u.cost)}`),
      `all the way to L${BUILDING_MAX_LEVEL} = ${fmtCopper(cumulative)}`,
    ]
    const res = Object.entries(resources).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0)
    if (res.length) lines.push(`plus ${res.map(([r, q]) => `${q} ${r}`).join(' + ')} on top of the coin`)
    lines.push('research can lower this (build cost ×), never below the engine\'s floor')
    return { build, upgrades, resources, lines }
  })
}

export interface CompanyCost {
  copperPerDay: number
  foodPerDay: number
  lines: string[]
}

/**
 * What a company of soldiers costs to keep, per day. Upkeep and food are per-soldier numbers
 * that only mean something at the size an army actually reaches — so the panel shows a company.
 */
export function explainCompany(
  type: SoldierType, rank: Rank, count: number, config?: GameConfigOverrides | null,
): CompanyCost {
  return under(config, () => {
    const unit: Unit = {
      id: 'ref', type, buckets: [{ r: rank, count, avgXP: 0 }], avgXP: 0, training: false, morale: 100,
      equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
    }
    const copperPerDay = dailyUpkeepCopper([unit])
    const foodPerDay = dailyFoodConsumption([unit])
    return {
      copperPerDay,
      foodPerDay,
      lines: [
        `upkeep/day = base × ${rank} multiplier × ${count} soldiers = ${fmtCopper(copperPerDay)}`,
        `food/day = base × ${count} soldiers = ${foodPerDay}`,
        'research and momentum multiply both on top (upkeep ×, food ×)',
      ],
    }
  })
}

export interface MissionEffect {
  enemyStrength: number
  rewardCopper: number
  rewardResources: Partial<Record<string, number>>
  lines: string[]
}

/** What one run of a mission fields against you and pays, for an army of a given strength. */
export function explainMission(
  id: Difficulty, deployedStrength = 100, config?: GameConfigOverrides | null,
): MissionEffect {
  return under(config, () => {
    const preset = missionPresets()[id]
    const enemyStrength = Math.max(preset.minTokens, Math.round(deployedStrength * preset.ratio))
    const reward = computeReward(preset, enemyStrength)
    const res = Object.entries(reward.resources).filter((e): e is [string, number] => typeof e[1] === 'number')
    return {
      enemyStrength,
      rewardCopper: reward.copper,
      rewardResources: reward.resources,
      lines: [
        `enemy strength = your ${deployedStrength} × ${preset.ratio} ratio = ${enemyStrength} (campaign escalation multiplies this)`,
        `coin = ${fmtCopper(preset.rewardCopperPerStrength)} per enemy strength × ${enemyStrength} = ${fmtCopper(reward.copper)}`,
        res.length
          ? `resources = base × (enemy strength ÷ 50) = ${res.map(([r, q]) => `${q} ${r}`).join(' + ')}`
          : 'no resource reward',
        'a win streak and research loot × multiply the reward on top',
      ],
    }
  })
}
