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
export const BuildingOutputChoices: Record<
  BuildingType,
  { kind: 'WEAPON' | 'ARMOR' | null; options: string[] }
> = {
  BLACKSMITH: { kind: 'WEAPON', options: ['HALBERD', 'SPEAR', 'SWORD'] },
  ARMORY:     { kind: 'ARMOR',  options: ['HEAVY_ARMOR', 'HORSE_ARMOR'] },
  WOODWORKER: { kind: 'WEAPON', options: ['BOW', 'SHIELD'] }, // SHIELD uses armor price
  TAILOR:     { kind: 'ARMOR',  options: ['LIGHT_ARMOR'] },
  STABLE:     { kind: null,     options: [] },
  MARKET:     { kind: null,     options: [] },
  BARRACKS:   { kind: null,     options: [] },
}

/**
 * Passive income / production math per spec:
 * - Base output/day = 10% of building cost (in copper).
 * - Keep `focusCoinPct`% as coin.
 * - Foregone coin is converted into items at **70%** of their market value.
 * - We return (coinGain, items to add, new fractional buffer).
 */
export function passiveIncomeAndProduction(params: {
  costCopper: number
  focusCoinPct: number
  outputItem: string
  fractionalBuffer: number
}) {
  const { costCopper, focusCoinPct, outputItem, fractionalBuffer } = params

  const Cout = 0.10 * costCopper // base output/day (copper)
  const coinGain = Math.floor(Cout * (focusCoinPct / 100))

  const foregone = Cout - coinGain
  const productionBudget = 0.70 * foregone

  const itemVal = itemValueCopper(outputItem)
  const itemsFloat = itemVal > 0 ? productionBudget / itemVal + fractionalBuffer : 0
  const items = Math.floor(itemsFloat)
  const newBuffer = itemsFloat - items

  return { coinGain, items, newBuffer }
}
