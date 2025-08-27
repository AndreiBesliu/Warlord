// src/logic/batches.ts
import {
    Ranks, type Rank, type RankCount,
    type BarracksPool, type RecruitPool, type Inventories,
    type SoldierType, type TrainingBatch, GOLD,
    isLightInf, isHeavyInf, isLightArcher, isHeavyArcher
  } from './types'
  
  /** take from pool by rank using a plan, throws if insufficient */
  export function deductByRank(pool: BarracksPool, fromType: SoldierType, plan: RankCount) {
    for (const r of Ranks) {
      const want = plan[r] || 0
      if (want > 0 && pool[fromType][r].count < want) {
        throw new Error(`Not enough ${fromType} ${r}`)
      }
    }
    for (const r of Ranks) {
      const want = plan[r] || 0
      if (want > 0) pool[fromType][r].count -= want
    }
  }
  
  export function addByRank(pool: BarracksPool, toType: SoldierType, plan: RankCount) {
    for (const r of Ranks) {
      const q = plan[r] || 0
      if (q > 0) pool[toType][r].count += q
    }
  }
  
  export function sumPlan(plan: RankCount) {
    return Ranks.reduce((a,r)=>a+(plan[r]||0),0)
  }
  
  /** Create a batch id */
  export const newBatchId = () => `B_${Math.random().toString(36).slice(2,8)}`
  
  /** Duration formula: base 7 days - (level-1), min 1 day */
  export const batchDurationDays = (level:number) => Math.max(1, 7 - (level-1))
  
  /** Slot formula: base 2 + (level-1) */
  export const batchSlots = (level:number) => 2 + (level-1)
  