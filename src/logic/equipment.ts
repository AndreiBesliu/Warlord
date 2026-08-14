// src/logic/equipment.ts
import type { Inventories, SoldierType, Unit } from './types'
import { WeaponTypes, ArmorTypes, HorseTypes } from './types'
import { itemValueCopper } from './items'

export type UnitEquip = Unit['equip']

export type EquipDemand = {
  weapons: Partial<Record<(typeof WeaponTypes)[number], number>>
  armors:  Partial<Record<(typeof ArmorTypes)[number], number>>
  horses:  Partial<Record<(typeof HorseTypes)[number], number>>
}

export function emptyDemand(): EquipDemand {
  return { weapons: {}, armors: {}, horses: {} }
}

function add(d: EquipDemand, kind: keyof EquipDemand, k: string, n: number) {
  const rec = d[kind] as Record<string, number>
  rec[k] = (rec[k] ?? 0) + n
}

/** Per-soldier equipment profile for each unit type */
export function perSoldierRequirement(t: SoldierType): EquipDemand {
  const d = emptyDemand()
  // Infantry by weapon
  if (t === 'LIGHT_INF_SWORD')   { add(d,'weapons','SWORD',1);  add(d,'armors','LIGHT_ARMOR',1); add(d,'armors','SHIELD',1) }
  if (t === 'LIGHT_INF_SPEAR')   { add(d,'weapons','SPEAR',1);  add(d,'armors','LIGHT_ARMOR',1); add(d,'armors','SHIELD',1) }
  if (t === 'LIGHT_INF_HALBERD') { add(d,'weapons','HALBERD',1);add(d,'armors','LIGHT_ARMOR',1); add(d,'armors','SHIELD',1) }

  if (t === 'HEAVY_INF_SWORD')   { add(d,'weapons','SWORD',1);  add(d,'armors','HEAVY_ARMOR',1); add(d,'armors','SHIELD',1) }
  if (t === 'HEAVY_INF_SPEAR')   { add(d,'weapons','SPEAR',1);  add(d,'armors','HEAVY_ARMOR',1); add(d,'armors','SHIELD',1) }
  if (t === 'HEAVY_INF_HALBERD') { add(d,'weapons','HALBERD',1);add(d,'armors','HEAVY_ARMOR',1); add(d,'armors','SHIELD',1) }

  // Archers
  if (t === 'LIGHT_ARCHER')      { add(d,'weapons','BOW',1);    add(d,'armors','LIGHT_ARMOR',1) }
  if (t === 'HEAVY_ARCHER')      { add(d,'weapons','BOW',1);    add(d,'armors','HEAVY_ARMOR',1) }

  // Cavalry
  if (t === 'LIGHT_CAV')         { add(d,'weapons','SPEAR',1);  add(d,'armors','LIGHT_ARMOR',1); add(d,'horses','LIGHT_HORSE',1) }
  if (t === 'HEAVY_CAV')         { add(d,'weapons','HALBERD',1);add(d,'armors','HEAVY_ARMOR',1); add(d,'armors','HORSE_ARMOR',1); add(d,'horses','HEAVY_HORSE',1) }
  if (t === 'HORSE_ARCHER')      { add(d,'weapons','BOW',1);    add(d,'armors','LIGHT_ARMOR',1); add(d,'horses','LIGHT_HORSE',1) }

  return d
}

/** Multiply per-soldier demand by headcount */
export function demandFor(t: SoldierType, soldiers: number): EquipDemand {
  const base = perSoldierRequirement(t)
  const d = emptyDemand()
  for (const k in base.weapons) add(d,'weapons',k, (base.weapons as any)[k] * soldiers)
  for (const k in base.armors)  add(d,'armors', k, (base.armors  as any)[k] * soldiers)
  for (const k in base.horses)  add(d,'horses', k, (base.horses  as any)[k] * soldiers)
  return d
}

/** Compare demand to inventory; return missing breakdown */
export function missingFromInventory(inv: {
  weapons: Record<string, number>,
  armors:  Record<string, number>,
  horses:  Record<'LIGHT_HORSE'|'HEAVY_HORSE', {active:number; inactive:number}>
}, need: EquipDemand) {
  const miss: EquipDemand = emptyDemand()
  let any = false
  for (const k in need.weapons) {
    const have = inv.weapons[k] ?? 0
    const want = (need.weapons as any)[k] ?? 0
    if (have < want) { (miss.weapons as any)[k] = want - have; any = true }
  }
  for (const k in need.armors) {
    const have = inv.armors[k] ?? 0
    const want = (need.armors as any)[k] ?? 0
    if (have < want) { (miss.armors as any)[k] = want - have; any = true }
  }
  for (const k in need.horses) {
    const have = inv.horses[k as 'LIGHT_HORSE'|'HEAVY_HORSE'].active ?? 0
    const want = (need.horses as any)[k] ?? 0
    if (have < want) { (miss.horses as any)[k] = want - have; any = true }
  }
  return { any, miss }
}

/** Try to satisfy demand from inventory; if autoBuy, purchase missing at market value (deduct wallet). */
export function ensureEquipOrBuy(
  inv: any,
  wallet: number,
  need: EquipDemand,
  autoBuy: boolean
): { inv: any; wallet: number; ok: boolean; spent: number; missing?: EquipDemand } {
  const { any, miss } = missingFromInventory(inv, need)
  let spent = 0
  if (any) {
    if (!autoBuy) return { inv, wallet, ok:false, spent, missing: miss }
    // Buy missing at market value
    for (const k in miss.weapons) { const q = (miss.weapons as any)[k]; spent += q * itemValueCopper(k) }
    for (const k in miss.armors)  { const q = (miss.armors  as any)[k]; spent += q * itemValueCopper(k) }
    for (const k in miss.horses)  { const q = (miss.horses  as any)[k]; spent += q * itemValueCopper(k) }
    if (wallet < spent) return { inv, wallet, ok:false, spent, missing: miss }
    wallet -= spent
    // add purchased to inventory
    for (const k in miss.weapons) inv.weapons[k] = (inv.weapons[k] ?? 0) + (miss.weapons as any)[k]
    for (const k in miss.armors)  inv.armors[k]  = (inv.armors[k]  ?? 0) + (miss.armors  as any)[k]
    for (const k in miss.horses)  inv.horses[k].active += (miss.horses as any)[k]
  }

  // Consume required equipment
  for (const k in need.weapons) inv.weapons[k] -= (need.weapons as any)[k]
  for (const k in need.armors)  inv.armors[k]  -= (need.armors  as any)[k]
  for (const k in need.horses)  inv.horses[k].active -= (need.horses as any)[k]

  return { inv, wallet, ok:true, spent }
}

// ── Gear that a unit HOLDS ────────────────────────────────────────────────
// Equipment used to be consumed at unit creation and then vanish: `u.equip` stayed
// empty forever, so `computeEquipped` reported 0 and a fully paid-for unit displayed
// "Ready 0/20" next to a red Missing list. Gear now stays with the soldiers who carry
// it, which is what every readiness readout in the UI already claimed to measure.

/** A demand (what N soldiers need) becomes the gear those soldiers carry. */
export function equipFromDemand(d: EquipDemand): UnitEquip {
  return {
    weapons: { ...(d.weapons as Record<string, number>) },
    armors: { ...(d.armors as Record<string, number>) },
    horses: { ...(d.horses as Record<string, number>) },
  }
}

/** Fold more gear into what a unit already carries (replenishment). */
export function addEquip(a: UnitEquip, b: UnitEquip): UnitEquip {
  const merge = (x: Record<string, number>, y: Record<string, number>) => {
    const out: Record<string, number> = { ...x }
    for (const [k, v] of Object.entries(y)) out[k] = (out[k] ?? 0) + v
    return out
  }
  return {
    weapons: merge(a.weapons, b.weapons),
    armors: merge(a.armors, b.armors),
    horses: merge(a.horses, b.horses),
  }
}

/**
 * Hand a unit's gear back to the stores — disbanding. Pure: returns a new inventory.
 * Horses come back as ACTIVE, which is where they were taken from.
 */
export function releaseEquip(inv: Inventories, equip: UnitEquip): Inventories {
  const out: Inventories = structuredClone(inv)
  for (const [k, n] of Object.entries(equip.weapons)) {
    if (n > 0) out.weapons[k] = (out.weapons[k] ?? 0) + n
  }
  for (const [k, n] of Object.entries(equip.armors)) {
    if (n > 0) out.armors[k] = (out.armors[k] ?? 0) + n
  }
  for (const [k, n] of Object.entries(equip.horses)) {
    if (n > 0) {
      const stall = out.horses[k as keyof Inventories['horses']]
      if (stall) stall.active += n
    }
  }
  return out
}

/**
 * A unit saved before gear was tracked carries nothing, and would suddenly read as
 * unequipped. It was paid for at creation, so it gets exactly what its headcount needs.
 */
export function equipIsEmpty(equip: UnitEquip | undefined): boolean {
  if (!equip) return true
  return [equip.weapons, equip.armors, equip.horses]
    .every((rec) => !rec || Object.values(rec).every((n) => !n))
}
