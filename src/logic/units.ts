// src/logic/units.ts
import { Rank, RankIndex, Unit, SoldierType, WeaponTypes, ArmorTypes, HorseTypes } from './types'

import { Registry } from './registry';

type UnitLoadout = Unit['loadout'];
type Bucket = { r: Rank; count: number; avgXP: number };

// Helper to get unit def or throw/warn
function getDef(id: string) {
  const def = Registry.getUnit(id);
  if (!def) {
    console.warn(`Unit definition not found for ${id}`);
    // return a dummy default?
    return {
      id, type: id, name: id,
      req: { weapons: {}, armors: {}, horses: {} },
      loadout: {}
    };
  }
  return def;
}

export const defaultLoadout = (t: SoldierType): UnitLoadout => {
  return getDef(t).loadout || {};
}

export const computeUnitAvgXP = (buckets: Bucket[]) => {
  const total = buckets.reduce((a, b) => a + b.count, 0)
  const wx = buckets.reduce((a, b) => a + b.count * b.avgXP, 0)
  return total === 0 ? 0 : Math.floor(wx / total)
}

export const requiredCountsFor = (u: Unit): {
  weapons: Partial<Record<string, number>>;
  armors: Partial<Record<string, number>>;
  horses: Partial<Record<string, number>>;
} => {
  const size = u.buckets.reduce((a, b) => a + b.count, 0)

  // Get reqs from Registry
  const def = getDef(u.type);
  const baseReq = def.req || {};

  const req: any = { weapons: {}, armors: {}, horses: {} }

  // Multiply base reqs by size
  if (baseReq.weapons) {
    for (const [k, v] of Object.entries(baseReq.weapons)) req.weapons[k] = (v as number) * size;
  }
  if (baseReq.armors) {
    for (const [k, v] of Object.entries(baseReq.armors)) req.armors[k] = (v as number) * size;
  }
  if (baseReq.horses) {
    for (const [k, v] of Object.entries(baseReq.horses)) req.horses[k] = (v as number) * size;
  }

  // Special dynamic handling for Cavalry loadouts if needed?
  // Original logic had:
  // case 'LIGHT_CAV': { const w = (u.loadout as any).weapon || 'SPEAR'; req.weapons[w]=size; ... }
  // case 'HEAVY_CAV': { const w = (u.loadout as any).weapon || 'HALBERD'; req.weapons[w]=size; ... }

  // If the unit has a variable weapon in loadout that overrides the default req?
  // The Registry `req` is static. 
  // If `u.loadout.weapon` differs from `def.req`, we might need logic here.
  // For now, let's assume the Registry `req` covers the BASE. 
  // If the unit uses a different weapon, we should probably inspect `u.loadout`.

  // Let's replicate the "weapon from loadout" logic if present:
  if (u.loadout && u.loadout.weapon) {
    // If the Registry defined a weapon, we might want to override it?
    // Or we assume `def.req` DOES NOT include the weapon if it's variable?
    // In my Registry init, I put 'SPEAR': 1 for Light Cav.
    // But if they switch to Sword?
    // We should probably remove the "default" weapon from the result and add `u.loadout.weapon`.

    // Actually, for minimal regression risk, let's trust the Registry `req` for FIXED items, 
    // but if `u.loadout.weapon` is set, we use that INSTEAD of what?
    // The original code hardcoded `req.weapons[w] = size`.

    // I will modify this to:
    // If `u.loadout.weapon` is present, it adds/overwrites that weapon requirement?
    // But we don't know WHICH weapon to remove if we just add one.
    // So the Registry `req` for Light Cav should probably NOT include the weapon if it is selectable.
    // OR, we check if `def.req` has a weapon, and if `u.loadout.weapon` is different, we swap?

    // For this pass, I will just use `def.req`. 
    // If the user changes weapon in loadout, `requiredCountsFor` needs to reflect that.
    // Existing logic writes `req.weapons[w]`.

    // Dynamic fallback:
    if (u.loadout.weapon) {
      // Check if we already have a weapon requirement? 
      // Implementing a "Swap" logic is generic:
      // If `def.loadout.weapon` (default) != `u.loadout.weapon` (current),
      // REMOVE default, ADD current.
      const defWeapon = def.loadout?.weapon;
      const curWeapon = u.loadout.weapon;
      if (defWeapon && curWeapon && defWeapon !== curWeapon) {
        // Remove defWeapon count
        if (req.weapons[defWeapon]) delete req.weapons[defWeapon];
        // Add curWeapon count
        req.weapons[curWeapon] = size;
      }
    }
  }

  return req
}

export const computeReady = (u: Unit): number => {
  const size = u.buckets.reduce((a, b) => a + b.count, 0)
  const req = requiredCountsFor(u)
  const caps: number[] = []
  for (const [w, n] of Object.entries(req.weapons)) caps.push(Math.floor(((u.equip.weapons[w as any] || 0) / ((n as number) || 1)) * size))
  for (const [a, n] of Object.entries(req.armors)) caps.push(Math.floor(((u.equip.armors[a as any] || 0) / ((n as number) || 1)) * size))
  for (const [h, n] of Object.entries(req.horses)) caps.push(Math.floor(((u.equip.horses[h as any] || 0) / ((n as number) || 1)) * size))
  if (!caps.length) return 0
  return Math.min(size, ...caps)
}

// ---- Missing equipment list ----
export function missingEquipmentList(u: Unit): string[] {
  const req = requiredCountsFor(u)
  const out: string[] = []
  for (const [w, need] of Object.entries(req.weapons)) {
    const have = u.equip.weapons[w] || 0
    if ((need || 0) > have) out.push(`${w}: ${(need || 0) - have}`)
  }
  for (const [a, need] of Object.entries(req.armors)) {
    const have = u.equip.armors[a] || 0
    if ((need || 0) > have) out.push(`${a}: ${(need || 0) - have}`)
  }
  for (const [h, need] of Object.entries(req.horses)) {
    const have = u.equip.horses[h] || 0
    if ((need || 0) > have) out.push(`${h}: ${(need || 0) - have}`)
  }
  return out
}

// ---- Split / Merge ----
function cloneBuckets(b: Bucket[]): Bucket[] { return b.map(x => ({ ...x })) }
function mergeBucketArrays(a: Bucket[], b: Bucket[]): Bucket[] {
  const map = new Map<Rank, { count: number, wx: number }>()
  const add = (arr: Bucket[]) => arr.forEach(({ r, count, avgXP }) => {
    const prev = map.get(r) || { count: 0, wx: 0 }
    prev.count += count; prev.wx += count * avgXP; map.set(r, prev)
  })
  add(a); add(b)
  return Array.from(map.entries()).map(([r, v]) => ({
    r, count: v.count, avgXP: v.count ? Math.floor(v.wx / v.count) : 0
  }))
}
export function splitUnit(u: Unit, takeCount: number): { taken: Unit; remaining: Unit } {
  const size = u.buckets.reduce((a, b) => a + b.count, 0)
  const amt = Math.max(0, Math.min(takeCount, size))
  const ratio = size ? (amt / size) : 0

  const takenBuckets: Bucket[] = []
  const remainBuckets: Bucket[] = []
  let carried = 0
  for (const b of u.buckets) {
    const want = Math.round(b.count * ratio)
    const take = Math.min(want, b.count)
    const left = b.count - take
    if (take > 0) takenBuckets.push({ r: b.r, count: take, avgXP: b.avgXP })
    if (left > 0) remainBuckets.push({ r: b.r, count: left, avgXP: b.avgXP })
    carried += take
  }
  let diff = amt - carried
  for (const b of remainBuckets) {
    if (diff <= 0) break
    const move = Math.min(diff, b.count)
    b.count -= move
    const tb = takenBuckets.find(x => x.r === b.r)
    if (tb) tb.count += move
    else takenBuckets.push({ r: b.r, count: move, avgXP: b.avgXP })
    diff -= move
  }

  const takeEq = {
    weapons: Object.fromEntries(Object.entries(u.equip.weapons).map(([k, v]) => [k, Math.floor((v || 0) * ratio)])) as any,
    armors: Object.fromEntries(Object.entries(u.equip.armors).map(([k, v]) => [k, Math.floor((v || 0) * ratio)])) as any,
    horses: Object.fromEntries(Object.entries(u.equip.horses).map(([k, v]) => [k, Math.floor((v || 0) * ratio)])) as any,
  }
  const remEq = {
    weapons: Object.fromEntries(Object.entries(u.equip.weapons).map(([k, v]) => [k, (v || 0) - (takeEq.weapons[k] || 0)])) as any,
    armors: Object.fromEntries(Object.entries(u.equip.armors).map(([k, v]) => [k, (v || 0) - (takeEq.armors[k] || 0)])) as any,
    horses: Object.fromEntries(Object.entries(u.equip.horses).map(([k, v]) => [k, (v || 0) - (takeEq.horses[k] || 0)])) as any,
  }

  const taken: Unit = {
    id: `U_${Math.random().toString(36).slice(2, 7)}`,
    type: u.type,
    buckets: takenBuckets,
    avgXP: computeUnitAvgXP(takenBuckets),
    training: false,
    equip: takeEq,
    loadout: u.loadout,
  }
  const remaining: Unit = {
    ...u,
    buckets: remainBuckets,
    avgXP: computeUnitAvgXP(remainBuckets),
    equip: remEq,
  }
  return { taken, remaining }
}
export function mergeUnits(a: Unit, b: Unit): Unit {
  if (a.type !== b.type) throw new Error('Cannot merge units of different types')
  const buckets = mergeBucketArrays(cloneBuckets(a.buckets), cloneBuckets(b.buckets))
  return {
    id: `U_${Math.random().toString(36).slice(2, 7)}`,
    type: a.type,
    buckets,
    avgXP: computeUnitAvgXP(buckets),
    training: false,
    loadout: a.loadout,
    equip: {
      weapons: Object.fromEntries(Object.keys({ ...a.equip.weapons, ...b.equip.weapons })
        .map(k => [k as any, ((a.equip.weapons as any)[k] || 0) + ((b.equip.weapons as any)[k] || 0)])) as any,
      armors: Object.fromEntries(Object.keys({ ...a.equip.armors, ...b.equip.armors })
        .map(k => [k as any, ((a.equip.armors as any)[k] || 0) + ((b.equip.armors as any)[k] || 0)])) as any,
      horses: Object.fromEntries(Object.keys({ ...a.equip.horses, ...b.equip.horses })
        .map(k => [k as any, ((a.equip.horses as any)[k] || 0) + ((b.equip.horses as any)[k] || 0)])) as any,
    }
  }
}

export const trainingGainPerDay = (r: Rank) =>
  (RankIndex[r] >= 3 ? 0 : 25 + 10 * RankIndex[r])
