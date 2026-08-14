// src/logic/economy.ts
import type { Building, BuildingType, Inventories, ResourceMap, SoldierType, Unit, Rank } from './types'
import { GOLD, fmtCopper, ResourceTypes, WeaponTypes, ArmorTypes } from './types'
import { itemValueCopper } from './items'
import { GameConfig } from './config'
import { studyPerDay, type StudyPools } from './research/study'

// Daily upkeep cost per soldier (in copper), by type
export const UPKEEP_BASE: Record<SoldierType, number> = {
  LIGHT_INF_SWORD: 2, LIGHT_INF_SPEAR: 2, LIGHT_INF_HALBERD: 2,
  HEAVY_INF_SWORD: 3, HEAVY_INF_SPEAR: 3, HEAVY_INF_HALBERD: 3,
  LIGHT_ARCHER: 2,    HEAVY_ARCHER: 3,
  LIGHT_CAV: 5,       HEAVY_CAV: 8,
  HORSE_ARCHER: 5,
}

// Rank multiplier for upkeep (veterans cost more to maintain)
export const UPKEEP_RANK_MULT: Record<Rank, number> = {
  NOVICE: 1.0, TRAINED: 1.1, ADVANCED: 1.25, VETERAN: 1.5, ELITE: 2.0,
}

// `mult` lets research/momentum lower upkeep (1 = unchanged).
export function dailyUpkeepCopper(units: Unit[], mult = 1): number {
  let total = 0
  for (const u of units) {
    const base = GameConfig.upkeepBase(u.type, UPKEEP_BASE[u.type] ?? 2)
    for (const b of u.buckets) {
      total += Math.round(base * GameConfig.upkeepRankMult(b.r, UPKEEP_RANK_MULT[b.r] ?? 1) * b.count)
    }
  }
  return Math.round(total * mult)
}

// Building costs (in copper)
export const BuildingCostCopper: Record<BuildingType, number> = {
  BLACKSMITH: 100_0000, // 100g
  ARMORY: 100_0000,
  WOODWORKER: 20_000,
  TAILOR: 35_000,
  STABLE: 40_000,
  MARKET: 0,
  BARRACKS: 0,
  // Resource buildings
  LUMBER_MILL: 5_000,
  QUARRY: 5_000,
  IRON_MINE: 50_000,
  COAL_MINE: 30_000,
  COPPER_MINE: 30_000,
  SILVER_MINE: 100_000,
  SMELTER: 40_000,
  MINTER: 80_000,
  FARM: 8_000,
  // Learning has a home before it has an output: the Scriptorium is the gate to research.
  SCRIPTORIUM: 60_000,
}

// Resource costs for buildings (Wood, Stone, etc.)
export const ResourceBuildingCosts: Record<BuildingType, Partial<ResourceMap>> = {
  // Production
  BLACKSMITH: { WOOD: 50, STONE: 100 },
  ARMORY: { WOOD: 50, STONE: 100 },
  WOODWORKER: { WOOD: 100 },
  TAILOR: { WOOD: 50, STONE: 20 },
  STABLE: { WOOD: 100, STONE: 20 },
  MARKET: { WOOD: 100 },
  BARRACKS: { WOOD: 100, STONE: 100 },
  // Resource
  LUMBER_MILL: { WOOD: 10 },
  QUARRY: { WOOD: 20 },
  IRON_MINE: { WOOD: 100, STONE: 50 },
  COAL_MINE: { WOOD: 100, STONE: 50 },
  COPPER_MINE: { WOOD: 50, STONE: 20 },
  SILVER_MINE: { WOOD: 200, STONE: 200 },
  SMELTER: { WOOD: 50, STONE: 200 },
  MINTER: { WOOD: 50, STONE: 200, IRON_INGOT: 20 },
  FARM: { WOOD: 30 },
  SCRIPTORIUM: { WOOD: 60, STONE: 40 },
}

// Focus options (percentage of coin kept; remaining is converted to items)
export const FocusOptions = [100, 80, 60, 40, 20, 0] as const

// What each building can produce (and whether it’s weapons/armor)
export const BuildingOutputChoices: Record<string, { options: string[] }> = {
  BLACKSMITH: { options: ['HALBERD', 'SPEAR', 'SWORD'] },
  ARMORY: { options: ['HEAVY_ARMOR', 'HORSE_ARMOR'] },
  WOODWORKER: { options: ['BOW', 'SHIELD'] },
  TAILOR: { options: ['LIGHT_ARMOR'] },
  STABLE: { options: [] },
  MARKET: { options: [] },
  BARRACKS: { options: [] },
  // Resource buildings generally have fixed outputs, but we might list them here for UI
  LUMBER_MILL: { options: ['WOOD'] },
  QUARRY: { options: ['STONE'] },
  IRON_MINE: { options: ['IRON_ORE'] },
  COAL_MINE: { options: ['COAL'] },
  COPPER_MINE: { options: ['COPPER_ORE'] },
  SILVER_MINE: { options: ['SILVER_ORE'] },
  SMELTER: { options: ['IRON_INGOT', 'COPPER_INGOT', 'SILVER_INGOT'] },
  MINTER: { options: [] },
  FARM: { options: ['FOOD'] },
  SCRIPTORIUM: { options: [] },
}

// How much VALUE a building turns out per day at level 1, in copper.
//
// This used to be "10% of the building's price", which made the scale of a workshop an
// accident of what it cost to build: a blacksmith at 100g printed 100,000c of goods a day
// and ate 2,379 wood doing it, while a lumber mill produced 14. One workshop outpaced a
// hundred mills. Output is now its own axis — comparable across buildings and tunable
// from the admin without touching prices, which gate construction instead.
export const BUILDING_OUTPUT_VALUE: Partial<Record<BuildingType, number>> = {
  // Extraction — unchanged from the old resource table.
  LUMBER_MILL: 500,
  QUARRY: 500,
  FARM: 800,
  IRON_MINE: 5_000,
  COAL_MINE: 3_000,
  COPPER_MINE: 3_000,
  SILVER_MINE: 10_000,
  // Refining — unchanged (was already 10% of a sane price).
  SMELTER: 4_000,
  MINTER: 8_000,
  // Workshops — these are the corrections. Sized so one workshop's appetite for raw
  // material is within reach of one or two extraction buildings.
  WOODWORKER: 1_200,
  TAILOR: 2_000,
  BLACKSMITH: 3_000,
  ARMORY: 20_000, // heavy armour is a luxury good; even here that is one piece every ~3 days
}

export const SmelterRecipes: Record<string, { input: Partial<ResourceMap> }> = {
  'IRON_INGOT': { input: { IRON_ORE: 2, COAL: 1 } },
  'COPPER_INGOT': { input: { COPPER_ORE: 2, COAL: 1 } },
  'SILVER_INGOT': { input: { SILVER_ORE: 2, COAL: 1 } },
}

// What an item costs in materials. Every one of these used to cost MORE than the item was
// worth — a bow took 500c of wood to make 70c of bow — so crafting destroyed value and any
// workshop was a wood sink. Materials now sit at roughly 40-75% of the item's market value,
// so a workshop turns raw material into something worth more than it consumed.
export const ManufacturingRecipes: Record<string, Partial<ResourceMap>> = {
  // Woodworker
  BOW: { WOOD: 1 }, // 50c -> 70c
  SHIELD: { WOOD: 1 }, // 50c -> 100c
  // Blacksmith
  SPEAR: { WOOD: 2 }, // 100c -> 300c (mostly a stick)
  HALBERD: { WOOD: 3, IRON_INGOT: 2 }, // 750c -> 1200c
  SWORD: { IRON_INGOT: 3, COAL: 2 }, // 1100c -> 1500c
}

/**
 * Passive income / production math:
 * - Base output/day = 10% of building cost (in copper). Resource buildings use a fixed base.
 * - Keep `focusCoinPct`% as coin; remaining value is converted to items at 70% market value.
 * - Returns (coinGain, whole items produced, fractional remainder for next tick).
 */

// Fixed daily output value (in copper) for resource buildings that don't scale with cost.
export const RESOURCE_BUILDING_BASE_VALUE: Partial<Record<string, number>> = {
  WOOD: 500,   // ~10 wood/day at 50c/wood
  STONE: 500,
  FOOD: 800,   // ~16 food/day at 50c/food
}

// Food consumption per soldier per day (base, before rank modifier)
export const FOOD_BASE: Record<SoldierType, number> = {
  LIGHT_INF_SWORD: 1, LIGHT_INF_SPEAR: 1, LIGHT_INF_HALBERD: 1,
  HEAVY_INF_SWORD: 2, HEAVY_INF_SPEAR: 2, HEAVY_INF_HALBERD: 2,
  LIGHT_ARCHER: 1,    HEAVY_ARCHER: 2,
  LIGHT_CAV: 2,       HEAVY_CAV: 3,
  HORSE_ARCHER: 2,
}

// `mult` lets research/momentum lower consumption (1 = unchanged).
export function dailyFoodConsumption(units: Unit[], mult = 1): number {
  let total = 0
  for (const u of units) {
    const base = GameConfig.foodBase(u.type, FOOD_BASE[u.type] ?? 1)
    for (const b of u.buckets) total += base * b.count
  }
  return Math.round(total * mult)
}

// ---- Building levels ----
export const BUILDING_MAX_LEVEL = 3

// Output multiplier per level: L1 ×1.0, L2 ×1.3, L3 ×1.6
export function buildingLevelMult(level: number): number {
  const lvl = Math.max(1, Math.min(BUILDING_MAX_LEVEL, Math.floor(level || 1)))
  return 1 + 0.3 * (lvl - 1)
}

// Copper cost to upgrade FROM `currentLevel` to the next: 60% of base cost × current level.
export function buildingUpgradeCostCopper(type: BuildingType, currentLevel: number, costMult = 1): number {
  const base = GameConfig.buildingCost(type, BuildingCostCopper[type] || 0)
  return Math.round(base * 0.6 * Math.max(1, currentLevel) * costMult)
}

// THE single source of a building's copper price: admin config first, then any research
// discount. Every reader (purchase, income math, UI price tags) must go through this —
// reading the raw BuildingCostCopper table would show a price the game doesn't charge.
export function buildingCostCopper(type: BuildingType, costMult = 1): number {
  return Math.round(GameConfig.buildingCost(type, BuildingCostCopper[type] || 0) * costMult)
}

// Resource price of a building after admin config (research discounts don't apply to
// materials today — only to copper).
// Precedence, most specific first:
//  1. an admin override for THIS building
//  2. a legacy admin override keyed by the produced resource (kept working on purpose —
//     an existing configuration must not silently stop applying)
//  3. the built-in per-building value
//  4. the old 10%-of-price rule, for anything a mod adds without a table entry
export function buildingOutputValue(type: BuildingType, outputItem: string, costCopper: number): number {
  const perBuilding = GameConfig.buildingOutputValue(type)
  if (perBuilding !== undefined) return perBuilding
  const legacy = GameConfig.resourceBaseValueOverride(outputItem)
  if (legacy !== undefined) return legacy
  const table = BUILDING_OUTPUT_VALUE[type]
  if (table !== undefined) return table
  return 0.1 * costCopper
}

export function manufacturingRecipe(item: string): Partial<ResourceMap> | undefined {
  return GameConfig.recipe(item, ManufacturingRecipes[item])
}

export function buildingResourceCost(type: BuildingType): Partial<ResourceMap> {
  return GameConfig.buildingResourceCost(type, ResourceBuildingCosts[type] || {})
}

export function passiveIncomeAndProduction(args: {
  type: BuildingType
  costCopper: number
  focusCoinPct: (typeof FocusOptions)[number]
  outputItem: string
  fractionalBuffer: number
  level?: number
  outputMult?: number // research/momentum production bonus (1 = unchanged)
  craftEfficiency?: number // research crafting bonus: more items per unit of value
  /**
   * Share of the day's value spent on study instead of output. Taken FIRST, off the top;
   * `focusCoinPct` then splits what is left, exactly as it always has. A three-way slider
   * summing to 100 would have silently rewritten the intent of every building in every
   * existing save — this way an absent field means 0 and nothing changes.
   */
  focusResearchPct?: number
}): { coinGain: number; items: number; newBuffer: number; researchValue: number } {
  const { costCopper, focusCoinPct, outputItem, fractionalBuffer } = args

  const basePerDay = buildingOutputValue(args.type, outputItem, costCopper)
    * buildingLevelMult(args.level ?? 1) * (args.outputMult ?? 1)
  if (!basePerDay) return { coinGain: 0, items: 0, newBuffer: fractionalBuffer, researchValue: 0 }

  const researchPct = Math.min(100, Math.max(0, args.focusResearchPct ?? 0))
  const researchValue = Math.round(basePerDay * (researchPct / 100))
  const afterResearch = basePerDay - researchValue

  const coinGain = Math.round(afterResearch * (focusCoinPct / 100))
  const remainderValue = afterResearch - coinGain
  const mv = itemValueCopper(outputItem) || 0

  if (remainderValue <= 0 || mv <= 0) {
    return { coinGain, items: 0, newBuffer: fractionalBuffer, researchValue }
  }

  // Produce at 70% of market value (manufacturing efficiency bonus); research can
  // improve that conversion further (craftEfficiency > 1 → cheaper per item).
  const itemsFloat = remainderValue / ((0.7 / (args.craftEfficiency ?? 1)) * mv)
  const total = fractionalBuffer + itemsFloat
  const items = Math.floor(total)
  const newBuffer = total - items

  return { coinGain, items, newBuffer, researchValue }
}

// ── ONE DAY OF ECONOMY, AS A PURE FUNCTION ────────────────────────────────
// This is THE per-day resource math. The daily tick runs it and commits the result;
// the UI runs it on the current snapshot to forecast tomorrow. Nothing may
// re-implement it: this codebase already shipped that bug twice (ProductionModal
// advertising numbers the tick never paid), and a forecast that drifts is worse
// than no forecast.
//
// Purity: no Math.random, no Date.now, no I/O, no React. Random events and battle
// loot are deliberately NOT here — they are not promisable, so they stay in the tick.

export interface DayEconomyInput {
  buildings: Building[] // ORDER IS LOAD-BEARING: one running resource pool, in array order
  resources: ResourceMap
  inv: Inventories
  units: Unit[] // pass [] to get income only (what the tick's income step does)
  mods?: { prodMult?: number; craftEfficiency?: number; upkeepMult?: number; foodMult?: number }
}

export interface BuildingDayLine {
  id: string
  type: BuildingType
  outputItem: string
  skipped: boolean // produces nothing by design (Stable/Market/Barracks/Scriptorium)
  coinGain: number
  itemsFloat: number // the day-invariant RATE, before the integer buffer
  itemsWanted: number // what the buffer would have released today
  itemsProduced: number // what the inputs actually allowed
  blocked: boolean // wanted > 0 but produced 0 — the shortfall is destroyed, not banked
  inputsConsumed: Partial<Record<string, number>>
  researchValue: number // copper of output diverted to study instead of coin/goods
}

export interface DayEconomyResult {
  resources: ResourceMap
  inv: Inventories
  buildings: Building[] // fractional buffers advanced
  incomeWalletDelta: number // buildings + minter − stable upkeep
  soldierUpkeep: number
  walletDelta: number // incomeWalletDelta − soldierUpkeep (NOT floored: copper goes negative)
  foodNeeded: number // what the army demands
  foodConsumed: number // what it actually gets — the granary is clamped at 0
  foodShortage: boolean
  breakdown: BuildingDayLine[]
  notes: string[]
  /**
   * Study produced today, per research branch. Computed here rather than by the caller so
   * the tick, the topbar forecast and the admin preview all read one number — the same rule
   * that keeps coin and goods honest.
   */
  studyByBranch: StudyPools
}

export function simulateEconomyDay(input: DayEconomyInput): DayEconomyResult {
  const { buildings, mods } = input
  const notes: string[] = []
  const breakdown: BuildingDayLine[] = []
  let walletDelta = 0
  const ninv: Inventories = structuredClone(input.inv)
  const nres: ResourceMap = { ...input.resources }
  const hasStable = buildings.some((b) => b.type === 'STABLE')
  const diverted: Record<string, number> = {}

  nres.WOOD = (nres.WOOD || 0) + 1
  notes.push('Nature → +1 Wood')

  const updated = buildings.map((b) => {
    const row = { ...b }

    // The Scriptorium stays out of the copper economy on purpose: its study is a function
    // of its LEVEL, not of an output value that then converts. Giving it a copper output
    // would have it paying coin at the default 100% focus, which it must never do.
    if (['STABLE', 'MARKET', 'BARRACKS', 'SCRIPTORIUM'].includes(row.type)) {
      breakdown.push({
        id: row.id, type: row.type, outputItem: '', skipped: true,
        coinGain: 0, itemsFloat: 0, itemsWanted: 0, itemsProduced: 0, blocked: false, inputsConsumed: {},
        researchValue: 0,
      })
      return row
    }

    // Config price only — a research BUILD discount must not shrink the income basis.
    const cost = buildingCostCopper(row.type)
    const outItem = row.outputItem ?? BuildingOutputChoices[row.type].options[0] ?? ''
    const bufferBefore = row.fractionalBuffer ?? 0
    const { coinGain, items, newBuffer, researchValue } = passiveIncomeAndProduction({
      type: row.type,
      costCopper: cost,
      focusCoinPct: row.focusCoinPct,
      outputItem: outItem,
      fractionalBuffer: bufferBefore,
      level: row.level ?? 1,
      outputMult: mods?.prodMult ?? 1,
      craftEfficiency: mods?.craftEfficiency ?? 1,
      focusResearchPct: row.focusResearchPct,
    })
    if (researchValue > 0) diverted[row.id] = researchValue

    walletDelta += coinGain
    row.fractionalBuffer = newBuffer

    const line: BuildingDayLine = {
      id: row.id, type: row.type, outputItem: outItem, skipped: false,
      coinGain,
      // The rate the buffer is filling at, independent of which day the integer lands.
      itemsFloat: items + newBuffer - bufferBefore,
      itemsWanted: items, itemsProduced: 0, blocked: false, inputsConsumed: {},
      researchValue,
    }

    if (row.type === 'SMELTER') {
      const recipe = SmelterRecipes[outItem]
      if (recipe && items > 0) {
        let maxAfford = items
        for (const [res, qty] of Object.entries(recipe.input)) {
          const avail = nres[res as keyof ResourceMap] || 0
          maxAfford = Math.min(maxAfford, Math.floor(avail / qty))
        }
        if (maxAfford > 0) {
          for (const [res, qty] of Object.entries(recipe.input)) {
            nres[res as keyof ResourceMap] -= qty * maxAfford
            line.inputsConsumed[res] = (line.inputsConsumed[res] ?? 0) + qty * maxAfford
          }
          // `|| 0`: a save written before an ingot key existed would make this NaN and
          // poison the resource permanently.
          nres[outItem as keyof ResourceMap] = (nres[outItem as keyof ResourceMap] || 0) + maxAfford
          line.itemsProduced = maxAfford
          notes.push(`${row.type} → Smelted ${maxAfford} ${outItem} (gain ${fmtCopper(coinGain)})`)
        } else {
          line.blocked = true
          notes.push(`${row.type} → Idle (missing ore/coal)`)
        }
      }
    } else if (row.type === 'MINTER') {
      if (items > 0) {
        const run = Math.min(items, nres['SILVER_INGOT'] || 0)
        if (run > 0) {
          nres['SILVER_INGOT'] -= run
          line.inputsConsumed['SILVER_INGOT'] = run
          const mintedValue = run * 600
          walletDelta += mintedValue
          line.coinGain += mintedValue
          line.itemsProduced = run
          notes.push(`${row.type} → Minted ${run} Silver Ingots into ${fmtCopper(mintedValue)}`)
        } else {
          line.blocked = true
          notes.push(`${row.type} → Idle (missing silver)`)
        }
      }
    } else {
      if (items > 0 && outItem) {
        const recipe = manufacturingRecipe(outItem)
        let actualItems = items

        if (recipe) {
          let maxAfford = items
          for (const [res, qty] of Object.entries(recipe)) {
            const avail = nres[res as keyof ResourceMap] || 0
            maxAfford = Math.min(maxAfford, Math.floor(avail / qty))
          }
          actualItems = maxAfford
          if (actualItems > 0) {
            for (const [res, qty] of Object.entries(recipe)) {
              nres[res as keyof ResourceMap] -= qty * actualItems
              line.inputsConsumed[res] = (line.inputsConsumed[res] ?? 0) + qty * actualItems
            }
          }
        }

        line.itemsProduced = actualItems
        if (actualItems > 0) {
          if ((ResourceTypes as readonly string[]).includes(outItem)) {
            nres[outItem as keyof ResourceMap] = (nres[outItem as keyof ResourceMap] || 0) + actualItems
            notes.push(`${row.type} → +${actualItems} ${outItem}, +${fmtCopper(coinGain)}`)
          } else if ((WeaponTypes as readonly string[]).includes(outItem)) {
            ninv.weapons[outItem] = (ninv.weapons[outItem] ?? 0) + actualItems
            notes.push(`${row.type} → +${actualItems} ${outItem}, +${fmtCopper(coinGain)}`)
          } else if ((ArmorTypes as readonly string[]).includes(outItem)) {
            ninv.armors[outItem] = (ninv.armors[outItem] ?? 0) + actualItems
            notes.push(`${row.type} → +${actualItems} ${outItem}, +${fmtCopper(coinGain)}`)
          }
        } else {
          line.blocked = true
          notes.push(`${row.type} → Idle (missing resources for ${outItem}), +${fmtCopper(coinGain)}`)
        }
      } else if (coinGain > 0) {
        notes.push(`${row.type} → +${fmtCopper(coinGain)}`)
      }
    }

    breakdown.push(line)
    return row
  })

  if (hasStable) {
    const breedL = Math.floor(0.01 * (ninv.horses.LIGHT_HORSE.active || 0))
    const breedH = Math.floor(0.01 * (ninv.horses.HEAVY_HORSE.active || 0))
    ninv.horses.LIGHT_HORSE.active += breedL
    ninv.horses.HEAVY_HORSE.active += breedH
    // Counted AFTER breeding: today's foals are charged today.
    const activeTotal = (ninv.horses.LIGHT_HORSE.active || 0) + (ninv.horses.HEAVY_HORSE.active || 0)
    const upkeep = Math.round(activeTotal * (0.005 * GOLD))
    walletDelta -= upkeep
    notes.push(`Stable: +${breedL + breedH} foals; upkeep ${fmtCopper(upkeep)} for ${activeTotal} horses`)
  }

  const incomeWalletDelta = walletDelta

  // The army half. Empty `units` reproduces the income-only step the tick commits first.
  const soldierUpkeep = input.units.length > 0 ? dailyUpkeepCopper(input.units, mods?.upkeepMult) : 0
  const foodNeeded = input.units.length > 0 ? dailyFoodConsumption(input.units, mods?.foodMult) : 0
  const stock = nres.FOOD ?? 0
  const foodConsumed = Math.min(foodNeeded, stock) // the granary floors at 0; there is no debt
  if (foodNeeded > 0) nres.FOOD = stock - foodConsumed

  return {
    resources: nres,
    inv: ninv,
    buildings: updated,
    incomeWalletDelta,
    soldierUpkeep,
    walletDelta: incomeWalletDelta - soldierUpkeep, // no floor: copper really does go negative
    foodNeeded,
    foodConsumed,
    foodShortage: foodNeeded > foodConsumed,
    breakdown,
    notes,
    studyByBranch: studyPerDay(buildings, diverted),
  }
}
