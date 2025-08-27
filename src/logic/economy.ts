// src/logic/economy.ts
import { BuildingType } from './types'
import { itemValueCopper } from './items'

// Building costs (in copper)
export const BuildingCostCopper: Record<BuildingType, number> = {
  BLACKSMITH: 100_0000, // 100g
  ARMORY:     100_0000, // 100g
  WOODWORKER: 20_000,   // 10g
  TAILOR:     35_000,   // 30g
  STABLE:     40_000,   // 40g
  MARKET:     0,
  BARRACKS:   0,
}

// Focus options (percentage of coin kept; remaining is converted to items)
export const FocusOptions = [100, 80, 60, 40, 20, 0] as const

// What each building can produce (and whether it’s weapons/armor)
export const BuildingOutputChoices: Record<string, { options: string[] }> = {
  BLACKSMITH: { options: ['HALBERD', 'SPEAR', 'SWORD'] }, // all weapons except bows
  ARMORY:     { options: ['HEAVY_ARMOR', 'HORSE_ARMOR'] },
  WOODWORKER: { options: ['BOW', 'SHIELD'] },
  TAILOR:     { options: ['LIGHT_ARMOR'] },
  STABLE:     { options: [] },
  MARKET:     { options: [] },
  BARRACKS:   { options: [] },
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
