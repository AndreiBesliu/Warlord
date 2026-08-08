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
  manufacturingRecipe, BuildingOutputChoices,
} from './economy'
import { makeEmptyInventories } from './helpers'
import { Registry } from './registry'
import { itemValueCopper } from './items'
import { fmtCopper, ResourceTypes, type Building, type BuildingType, type ResourceMap } from './types'

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
}

/**
 * Runs one day for a single building, in isolation, with stores deep enough that nothing
 * is input-limited — so the answer is "what this building does", not "what it managed today".
 */
export function explainBuilding(
  type: BuildingType,
  opts: { level?: number; focusCoinPct?: Building['focusCoinPct']; outputItem?: string } = {},
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
  const consumes: Partial<Record<string, number>> = {}
  for (const r of ResourceTypes) {
    const used = (before[r] ?? 0) - (day.resources[r] ?? 0)
    // Nature's +1 wood is not this building's doing.
    const adjusted = r === 'WOOD' ? used + 1 : used
    if (adjusted > 0) consumes[r] = adjusted
  }
  return {
    type,
    outputItem,
    valuePerDay: Math.round((line?.coinGain ?? 0) + (line?.itemsFloat ?? 0) * 0.7 * (itemValueCopper(outputItem) || 0)),
    coinPerDay: line?.coinGain ?? 0,
    itemsPerDay: +(line?.itemsFloat ?? 0).toFixed(2),
    consumesPerDay: consumes,
    blocked: !!line?.blocked,
  }
}

/** Human-readable arithmetic for one building, with the real numbers substituted in. */
export function buildingFormula(type: BuildingType, level = 1, focusCoinPct = 0): string[] {
  const base = BUILDING_OUTPUT_VALUE[type]
  const price = buildingCostCopper(type)
  const lvl = buildingLevelMult(level)
  const outputItem = BuildingOutputChoices[type]?.options?.[0] ?? ''
  const mv = itemValueCopper(outputItem) || 0
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
    lines.push(`this building produces no item — all of its value is coin`)
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
