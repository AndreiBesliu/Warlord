// src/logic/training.ts
import {
    Ranks, Rank, SoldierType, TrainingDiscipline, BarracksPool, RecruitPool,
    Inventories, Horse, Armor, SoldierTypes
  } from './types'
  
  /** Train untyped recruits into a typed LIGHT or HEAVY infantry/archer pool.
   *  - resultType: one of the LIGHT_* or HEAVY_* types
   *  - qty recruits taken from recruitPool (NOVICE rank, avgXP 0)
   *  - If HEAVY_* selected, caller should have already ensured heavy armor exists (and consumes it outside or here).
   */
  export function trainRecruitsInto(
    recruitPool: RecruitPool,
    barracks: BarracksPool,
    resultType: SoldierType,
    qty: number
  ): { recruitPool: RecruitPool; barracks: BarracksPool } {
    if (qty<=0) return { recruitPool, barracks }
    if (!recruitPool.count || recruitPool.count < qty) return { recruitPool, barracks }
  
    // Only allow LIGHT_* or HEAVY_* infantry/archer targets (not cavalry)
    if (![
      'LIGHT_INF_SWORD','LIGHT_INF_SPEAR','LIGHT_INF_HALBERD',
      'HEAVY_INF_SWORD','HEAVY_INF_SPEAR','HEAVY_INF_HALBERD',
      'LIGHT_ARCHER','HEAVY_ARCHER'
    ].includes(resultType)) {
      throw new Error('Invalid training target: ' + resultType)
    }
  
    const np = { ...recruitPool, count: recruitPool.count - qty }
    const bp = structuredClone(barracks)
    bp[resultType].NOVICE.count += qty
    // avgXP stays 0 for NOVICE
    return { recruitPool: np, barracks: bp }
  }
  
  /** Convert infantry/archers to cavalry.
   *  - LIGHT_CAV from any LIGHT_INF_* (1 light horse per soldier)
   *  - HEAVY_CAV from any HEAVY_INF_* (1 heavy horse + 1 horse armor per soldier)
   *  - HORSE_ARCHER from LIGHT_ARCHER of rank >= ADVANCED (1 light horse per soldier)
   *  Depletes source pools and increments target pools at same rank counts.
   *  Consumes horses/horse armor from inventory.
   */
  export function convertToCavalry(
    barracks: BarracksPool,
    inv: Inventories,
    fromType: SoldierType,
    toType: 'LIGHT_CAV' | 'HEAVY_CAV' | 'HORSE_ARCHER',
    qtyByRank: Partial<Record<Rank, number>>
  ): { barracks: BarracksPool; inv: Inventories } {
    const bp = structuredClone(barracks)
    const ni = structuredClone(inv)
  
    const takeRanks: Rank[] = ['NOVICE','TRAINED','ADVANCED','VETERAN','ELITE']
    const sumQty = (r: Rank) => Math.max(0, qtyByRank[r] || 0)
  
    // Check source and constraints
    if (toType === 'LIGHT_CAV') {
      if (!fromType.startsWith('LIGHT_INF_')) throw new Error('LIGHT_CAV must convert from LIGHT_INF_*')
      const need = takeRanks.reduce((a,r)=>a+sumQty(r),0)
      if ((ni.horses.LIGHT_HORSE?.active || 0) < need) throw new Error('Not enough LIGHT_HORSE')
      // move by rank
      takeRanks.forEach(r=>{
        const q = sumQty(r)
        if (q>0){
          if (bp[fromType][r].count < q) throw new Error(`Not enough ${fromType} ${r}`)
          bp[fromType][r].count -= q
          bp['LIGHT_CAV'][r].count += q
        }
      })
      ni.horses.LIGHT_HORSE.active -= need
    }
    else if (toType === 'HEAVY_CAV') {
      if (!fromType.startsWith('HEAVY_INF_')) throw new Error('HEAVY_CAV must convert from HEAVY_INF_*')
      const need = takeRanks.reduce((a,r)=>a+sumQty(r),0)
      if ((ni.horses.HEAVY_HORSE?.active || 0) < need) throw new Error('Not enough HEAVY_HORSE')
      if ((ni.armors.HORSE_ARMOR || 0) < need) throw new Error('Not enough HORSE_ARMOR')
      takeRanks.forEach(r=>{
        const q = sumQty(r)
        if (q>0){
          if (bp[fromType][r].count < q) throw new Error(`Not enough ${fromType} ${r}`)
          bp[fromType][r].count -= q
          bp['HEAVY_CAV'][r].count += q
        }
      })
      ni.horses.HEAVY_HORSE.active -= need
      ni.armors.HORSE_ARMOR -= need
    }
    else if (toType === 'HORSE_ARCHER') {
      if (fromType !== 'LIGHT_ARCHER') throw new Error('HORSE_ARCHER converts from LIGHT_ARCHER')
      // restriction: only ranks >= ADVANCED
      const allowed: Rank[] = ['ADVANCED','VETERAN','ELITE']
      const need = allowed.reduce((a,r)=>a+sumQty(r),0)
      if ((ni.horses.LIGHT_HORSE?.active || 0) < need) throw new Error('Not enough LIGHT_HORSE')
      allowed.forEach(r=>{
        const q = sumQty(r)
        if (q>0){
          if (bp[fromType][r].count < q) throw new Error(`Not enough ${fromType} ${r}`)
          bp[fromType][r].count -= q
          bp['HORSE_ARCHER'][r].count += q
        }
      })
      ni.horses.LIGHT_HORSE.active -= need
      // NOTE: lower ranks in qtyByRank (Novice/Trained) are ignored by rule
    }
  
    return { barracks: bp, inv: ni }
  }
  