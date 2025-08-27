// src/logic/items.ts
import { Weapon, Armor, Horse, GOLD, SILVER } from './types'

// Prices in copper
export const WeaponPriceCopper: Record<Weapon, number> = {
  HALBERD: 12 * SILVER,
  SPEAR:   3 * SILVER,
  SWORD:   15 * SILVER,
  BOW:     0.7 * SILVER,
}

export const ArmorPriceCopper: Record<Armor, number> = {
  SHIELD:      1 * SILVER,
  HEAVY_ARMOR: 10 * GOLD,
  LIGHT_ARMOR: 10 * SILVER,
  HORSE_ARMOR: 8 * GOLD,
}

export const HorsePriceCopper: Record<Horse, number> = {
  LIGHT_HORSE: 5 * GOLD,
  HEAVY_HORSE: 15 * GOLD,
}

// Lookup helper
export function itemValueCopper(subtype: string): number {
  if ((Object.keys(WeaponPriceCopper) as string[]).includes(subtype)) {
    return WeaponPriceCopper[subtype as keyof typeof WeaponPriceCopper]
  }
  if ((Object.keys(ArmorPriceCopper) as string[]).includes(subtype)) {
    return ArmorPriceCopper[subtype as keyof typeof ArmorPriceCopper]
  }
  if ((Object.keys(HorsePriceCopper) as string[]).includes(subtype)) {
    return HorsePriceCopper[subtype as keyof typeof HorsePriceCopper]
  }
  return 0
}
