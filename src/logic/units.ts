// src/logic/units.ts
import { Rank, RankIndex, Unit, SoldierType, WeaponTypes, ArmorTypes, HorseTypes } from './types'

type UnitLoadout = Unit['loadout'];
type Weapon = typeof WeaponTypes[number];
type Armor  = typeof ArmorTypes[number];
type Horse  = typeof HorseTypes[number];
type Bucket = { r: Rank; count: number; avgXP: number };

export const defaultLoadout = (t: SoldierType): UnitLoadout => {
  switch (t) {
    case 'LIGHT_INF_SWORD':   return {kind:'LIGHT_INF_SWORD',   weapon:'SWORD',   shield:true,  lightArmor:true}
    case 'LIGHT_INF_SPEAR':   return {kind:'LIGHT_INF_SPEAR',   weapon:'SPEAR',   shield:true,  lightArmor:true}
    case 'LIGHT_INF_HALBERD': return {kind:'LIGHT_INF_HALBERD', weapon:'HALBERD', shield:true,  lightArmor:true}
    case 'HEAVY_INF_SWORD':   return {kind:'HEAVY_INF_SWORD',   weapon:'SWORD',   shield:true,  heavyArmor:true}
    case 'HEAVY_INF_SPEAR':   return {kind:'HEAVY_INF_SPEAR',   weapon:'SPEAR',   shield:true,  heavyArmor:true}
    case 'HEAVY_INF_HALBERD': return {kind:'HEAVY_INF_HALBERD', weapon:'HALBERD', shield:true,  heavyArmor:true}
    case 'LIGHT_ARCHER':      return {kind:'LIGHT_ARCHER',      weapon:'BOW',     shield:false, lightArmor:true}
    case 'HEAVY_ARCHER':      return {kind:'HEAVY_ARCHER',      weapon:'BOW',     shield:false, heavyArmor:true}
    case 'LIGHT_CAV':         return {kind:'LIGHT_CAV',         weapon:'SPEAR',   lightArmor:true}
    case 'HEAVY_CAV':         return {kind:'HEAVY_CAV',         weapon:'HALBERD', heavyArmor:true, horseArmor:true}
    case 'HORSE_ARCHER':      return {kind:'HORSE_ARCHER',      weapon:'BOW',     lightArmor:true}
  }
}

export const computeUnitAvgXP = (buckets: Bucket[]) => {
  const total = buckets.reduce((a,b)=>a+b.count,0)
  const wx    = buckets.reduce((a,b)=>a+b.count*b.avgXP,0)
  return total===0?0:Math.floor(wx/total)
}

export const requiredCountsFor = (u: Unit): {
  weapons: Partial<Record<Weapon, number>>;
  armors:  Partial<Record<Armor, number>>;
  horses:  Partial<Record<Horse, number>>;
} => {
  const size = u.buckets.reduce((a,b)=>a+b.count,0)
  const req: any = {weapons:{}, armors:{}, horses:{}}
  switch (u.type) {
    case 'LIGHT_INF_SWORD':   { req.weapons['SWORD']=size;   req.armors['LIGHT_ARMOR']=size; req.armors['SHIELD']=size; break }
    case 'LIGHT_INF_SPEAR':   { req.weapons['SPEAR']=size;   req.armors['LIGHT_ARMOR']=size; req.armors['SHIELD']=size; break }
    case 'LIGHT_INF_HALBERD': { req.weapons['HALBERD']=size; req.armors['LIGHT_ARMOR']=size; req.armors['SHIELD']=size; break }
    case 'HEAVY_INF_SWORD':   { req.weapons['SWORD']=size;   req.armors['HEAVY_ARMOR']=size; req.armors['SHIELD']=size; break }
    case 'HEAVY_INF_SPEAR':   { req.weapons['SPEAR']=size;   req.armors['HEAVY_ARMOR']=size; req.armors['SHIELD']=size; break }
    case 'HEAVY_INF_HALBERD': { req.weapons['HALBERD']=size; req.armors['HEAVY_ARMOR']=size; req.armors['SHIELD']=size; break }
    case 'LIGHT_ARCHER':      { req.weapons['BOW']=size;     req.armors['LIGHT_ARMOR']=size; break }
    case 'HEAVY_ARCHER':      { req.weapons['BOW']=size;     req.armors['HEAVY_ARMOR']=size; break }
    case 'LIGHT_CAV':         { /* spear or sword allowed */ const w = (u.loadout as any).weapon || 'SPEAR'; req.weapons[w]=size; req.horses['LIGHT_HORSE']=size; req.armors['LIGHT_ARMOR']=size; break }
    case 'HEAVY_CAV':         { const w = (u.loadout as any).weapon || 'HALBERD'; req.weapons[w]=size; req.horses['HEAVY_HORSE']=size; req.armors['HEAVY_ARMOR']=size; req.armors['HORSE_ARMOR']=size; break }
    case 'HORSE_ARCHER':      { req.weapons['BOW']=size;     req.horses['LIGHT_HORSE']=size; req.armors['LIGHT_ARMOR']=size; break }
  }
  return req
}

export const computeReady = (u: Unit): number => {
  const size = u.buckets.reduce((a,b)=>a+b.count,0)
  const req = requiredCountsFor(u)
  const caps:number[] = []
  for (const [w,n] of Object.entries(req.weapons)) caps.push(Math.floor(((u.equip.weapons[w as any]||0)/((n as number)||1))*size))
  for (const [a,n] of Object.entries(req.armors))  caps.push(Math.floor(((u.equip.armors[a as any]||0)/((n as number)||1))*size))
  for (const [h,n] of Object.entries(req.horses))  caps.push(Math.floor(((u.equip.horses[h as any]||0)/((n as number)||1))*size))
  if (!caps.length) return 0
  return Math.min(size, ...caps)
}

// ---- Missing equipment list ----
export function missingEquipmentList(u: Unit): string[] {
  const req = requiredCountsFor(u)
  const out: string[] = []
  for (const [w, need] of Object.entries(req.weapons)) {
    const have = u.equip.weapons[w as Weapon] || 0
    if ((need||0) > have) out.push(`${w}: ${(need||0) - have}`)
  }
  for (const [a, need] of Object.entries(req.armors)) {
    const have = u.equip.armors[a as Armor] || 0
    if ((need||0) > have) out.push(`${a}: ${(need||0) - have}`)
  }
  for (const [h, need] of Object.entries(req.horses)) {
    const have = u.equip.horses[h as Horse] || 0
    if ((need||0) > have) out.push(`${h}: ${(need||0) - have}`)
  }
  return out
}

// ---- Split / Merge ----
function cloneBuckets(b: Bucket[]): Bucket[] { return b.map(x=>({ ...x })) }
function mergeBucketArrays(a: Bucket[], b: Bucket[]): Bucket[] {
  const map = new Map<Rank,{count:number, wx:number}>()
  const add = (arr:Bucket[]) => arr.forEach(({r,count,avgXP})=>{
    const prev = map.get(r) || {count:0, wx:0}
    prev.count += count; prev.wx += count*avgXP; map.set(r, prev)
  })
  add(a); add(b)
  return Array.from(map.entries()).map(([r, v])=>({
    r, count: v.count, avgXP: v.count ? Math.floor(v.wx / v.count) : 0
  }))
}
export function splitUnit(u: Unit, takeCount: number): { taken: Unit; remaining: Unit } {
  const size = u.buckets.reduce((a,b)=>a+b.count,0)
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
    const tb = takenBuckets.find(x=>x.r===b.r)
    if (tb) tb.count += move
    else takenBuckets.push({ r: b.r, count: move, avgXP: b.avgXP })
    diff -= move
  }

  const takeEq = {
    weapons: Object.fromEntries(Object.entries(u.equip.weapons).map(([k,v])=>[k, Math.floor((v||0)*ratio)])) as any,
    armors:  Object.fromEntries(Object.entries(u.equip.armors ).map(([k,v])=>[k, Math.floor((v||0)*ratio)])) as any,
    horses:  Object.fromEntries(Object.entries(u.equip.horses ).map(([k,v])=>[k, Math.floor((v||0)*ratio)])) as any,
  }
  const remEq = {
    weapons: Object.fromEntries(Object.entries(u.equip.weapons).map(([k,v])=>[k, (v||0) - (takeEq.weapons[k]||0)])) as any,
    armors:  Object.fromEntries(Object.entries(u.equip.armors ).map(([k,v])=>[k, (v||0) - (takeEq.armors[k] ||0)])) as any,
    horses:  Object.fromEntries(Object.entries(u.equip.horses ).map(([k,v])=>[k, (v||0) - (takeEq.horses[k] ||0)])) as any,
  }

  const taken: Unit = {
    id: `U_${Math.random().toString(36).slice(2,7)}`,
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
    id: `U_${Math.random().toString(36).slice(2,7)}`,
    type: a.type,
    buckets,
    avgXP: computeUnitAvgXP(buckets),
    training: false,
    loadout: a.loadout,
    equip: {
      weapons: Object.fromEntries(Object.keys({...a.equip.weapons, ...b.equip.weapons})
        .map(k=>[k as any, ((a.equip.weapons as any)[k]||0)+((b.equip.weapons as any)[k]||0)])) as any,
      armors: Object.fromEntries(Object.keys({...a.equip.armors, ...b.equip.armors})
        .map(k=>[k as any, ((a.equip.armors as any)[k]||0)+((b.equip.armors as any)[k]||0)])) as any,
      horses: Object.fromEntries(Object.keys({...a.equip.horses, ...b.equip.horses})
        .map(k=>[k as any, ((a.equip.horses as any)[k]||0)+((b.equip.horses as any)[k]||0)])) as any,
    }
  }
}

export const trainingGainPerDay = (r: Rank) =>
  (RankIndex[r] >= 3 ? 0 : 25 + 10 * RankIndex[r])
