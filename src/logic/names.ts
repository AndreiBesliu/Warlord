// src/logic/names.ts
// ONE way to write a game thing's name on screen.
//
// The same soldier type used to render four different ways depending on which panel you
// were looking at — `LIGHT_INF_SPEAR` in the formation select, `LIGHT INF SPEAR` in the
// barracks pool, `light inf spear` inside a refusal, and `Light Infantry (Spear)` in the
// training target list. Seven separate title-case helpers exist in the codebase and the
// army tabs used none of them.
//
// The Registry already holds names a human wrote — 'Light Infantry (Spear)', 'Bow',
// 'Light Armor'. Those beat any regex, so they win; title-case is only the fallback for
// keys with no registered name (ranks, batch kinds).

import { Registry } from './registry'

const titleCase = (key: string): string =>
  key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

/** A soldier type: 'LIGHT_INF_SPEAR' → 'Light Infantry (Spear)'. */
export function unitName(type: string): string {
  if (!type) return ''
  return Registry.getUnit(type)?.name ?? titleCase(type)
}

/** An item: 'LIGHT_ARMOR' → 'Light Armor', 'BOW' → 'Bow'. */
export function itemName(key: string): string {
  if (!key) return ''
  return Registry.getItem(key)?.name ?? titleCase(key)
}

/** A rank: 'NOVICE' → 'Novice'. Ranks are not Registry entries. */
export function rankName(rank: string): string {
  return titleCase(rank)
}

/** Anything else with an enum-shaped key — batch kinds, branches, difficulties. */
export function labelOf(key: string): string {
  return titleCase(key)
}

/**
 * "3 Spear + 2 Light Armor" from an equipment demand or any key→count map. Zero and
 * negative entries are dropped: `Need: BOW:0 | LIGHT_ARMOR:0 | —` was a machine talking.
 */
export function itemList(counts: Partial<Record<string, number>> | undefined): string {
  if (!counts) return ''
  return Object.entries(counts)
    .filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0)
    .map(([k, n]) => `${n} ${itemName(k)}`)
    .join(' + ')
}
