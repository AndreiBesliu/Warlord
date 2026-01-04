// src/logic/economy.ts
import { BuildingType, ResourceType, ResourceMap } from './types'
import { itemValueCopper } from './items'

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
  LUMBER_MILL: 5_000,   // Cheap
  QUARRY: 5_000,
  IRON_MINE: 50_000,
  COAL_MINE: 30_000,
  COPPER_MINE: 30_000,
  SILVER_MINE: 100_000,
  SMELTER: 40_000,
  MINTER: 80_000,
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
  MINTER: { options: [] }, // Mints coins from silver directly
}

export const SmelterRecipes: Record<string, { input: Partial<ResourceMap> }> = {
  'IRON_INGOT': { input: { IRON_ORE: 2, COAL: 1 } },
  'COPPER_INGOT': { input: { COPPER_ORE: 2, COAL: 1 } },
  'SILVER_INGOT': { input: { SILVER_ORE: 2, COAL: 1 } },
}

export const ManufacturingRecipes: Record<string, Partial<ResourceMap>> = {
  // Woodworker
  BOW: { WOOD: 10 },
  SHIELD: { WOOD: 15 },
  // Blacksmith (optional for now, but good for completeness)
  SPEAR: { WOOD: 5, IRON_INGOT: 2 },
  HALBERD: { WOOD: 10, IRON_INGOT: 5 },
  SWORD: { IRON_INGOT: 10, COAL: 2 },
}

/**
 * Passive income / production math per spec:
 * - Base output/day = 10% of building cost (in copper).
 * - Keep `focusCoinPct`% as coin.
 * - Foregone coin is converted into items at **70%** of their market value.
 * - We return (coinGain, items to add, new fractional buffer).
 */
export function passiveIncomeAndProduction(args: {
  costCopper: number
  focusCoinPct: (typeof FocusOptions)[number]
  outputItem: string
  fractionalBuffer: number
}): { coinGain: number; items: number; newBuffer: number } {
  const { costCopper, focusCoinPct, outputItem, fractionalBuffer } = args

  if (!costCopper) return { coinGain: 0, items: 0, newBuffer: fractionalBuffer }

  // Special case: Lumber Mill fixed at 10 Wood/day
  if (outputItem === 'WOOD') {
    const baseItems = 10
    // If specific focus logic applies to resources, we can adjust, but usually resources are 100% production?
    // User said "10 wood per day". Assuming 100% goods (0% coin).
    // If the user uses the slider, what happens?
    // "10 wood per day" implies that is the max output.
    // Let's assume standard split logic applies to the *value* of 10 wood?
    // OR simpler: It produces 10 Wood if focus is on goods.
    // If the user explicitly requested "10 wood per day", I will force 10 wood if focus is < 100% coin?
    // Let's stick to the simpler interpretation: It produces 10 Wood/day base.
    // But wait, the slider exists.
    // If I return fixed items:
    const coinGain = 0 // Or should it generate coin? 
    // "Lumber Mill ... output to 10 wood per day".
    // I'll assume if they want wood, they get 10.
    // Behavior: ignore slider for now or assume 0% coin focus for this building type?
    // Let's just return fixed 10 items and 0 coin for now to satisfy the "10 wood" requirement.
    return { coinGain: 0, items: 10, newBuffer: fractionalBuffer }
  }

  const basePerDay = 0.10 * costCopper

  const coinGain = Math.round(basePerDay * (focusCoinPct / 100))

  const remainderValue = basePerDay - coinGain
  const mv = itemValueCopper(outputItem) || 0

  if (remainderValue <= 0 || mv <= 0) {
    return { coinGain, items: 0, newBuffer: fractionalBuffer }
  }

  // Produce at 70% of market value (i.e., more items than buying)
  const itemsFloat = remainderValue / (0.7 * mv)

  const total = fractionalBuffer + itemsFloat
  const items = Math.floor(total)
  const newBuffer = total - items

  return { coinGain, items, newBuffer }
}
