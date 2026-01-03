
import {
    Ranks, type Rank, type BarracksPool, type RecruitPool, type Inventories,
    type SoldierType, GOLD, isLightInf, isHeavyInf, isLightArcher, isHeavyArcher
  } from './types'

  export type BatchKind = 'LIGHT_TRAIN' | 'LIGHT_CAV' | 'HEAVY_CAV' | 'HORSE_ARCHER'

  export type RankCount = Partial<Record<Rank, number>>

  export interface TrainingBatch {
    id: string
    kind: BatchKind
    target?: SoldierType        // e.g., 'LIGHT_INF_SPEAR', 'LIGHT_ARCHER'
    fromType?: SoldierType      // e.g., 'LIGHT_CAV' or 'HEAVY_INF_*' for heavy cav
    qty: number                 // 1..50
    daysRemaining: number
    takeByRank?: RankCount      // if conversion, what ranks were consumed
  }

// Rules: L1 = 2 slots, +1 slot per level, cap 5
export function batchSlots(level: number) {
  return Math.min(2 + (level - 1), 5)
}

export function batchDurationDays(level: number) {
  return Math.max(7 - (level - 1), 3)
}

export function newBatchId() {
  return `B_${Math.random().toString(36).slice(2, 8)}`
}

export function enqueueBatch(
  current: TrainingBatch[],
  draft: Omit<TrainingBatch, 'id' | 'daysRemaining'> & { level: number }
): TrainingBatch[] {
  const id = newBatchId()
  const daysRemaining = batchDurationDays(draft.level)
  const next: TrainingBatch = {
    id,
    kind: draft.kind,
    target: draft.target,
    fromType: draft.fromType,
    qty: draft.qty,
    daysRemaining,
    takeByRank: draft.takeByRank
  }
  return [next, ...current]
}

export function canEnqueue(current: TrainingBatch[], level: number) {
  return current.length < batchSlots(level)
}

export function buildBatch(
  level: number,
  payload: { kind: BatchKind; target: SoldierType; qty: number; fromType?: SoldierType; takeByRank?: RankCount }
): TrainingBatch {
  return {
    id: newBatchId(),
    kind: payload.kind,
    target: payload.target,
    fromType: payload.fromType,
    qty: payload.qty,
    daysRemaining: batchDurationDays(level),
    takeByRank: payload.takeByRank
  }
}

// export function enqueueBatch(args: {
//   level: number
//   batches: TrainingBatch[]
//   setBatches: (updater: (prev: TrainingBatch[]) => TrainingBatch[]) => void
//   payload: { kind: BatchKind; target: SoldierType; qty: number; fromType?: SoldierType }
//   addLog: (s: string) => void
// }) {
//   const { level, batches, setBatches, payload, addLog } = args
//   if (payload.qty <= 0) return false
//   if (payload.qty > 50) { addLog('Batch too large (max 50).'); return false }
//   if (!canEnqueue(batches, level)) { addLog('No free training slots.'); return false }

//   const b = buildBatch(level, payload)
//   setBatches(list => [b, ...list])
//   addLog(`Queued ${payload.kind.replace('_',' ')}: ${payload.qty} → ${payload.target} (${b.daysRemaining} days).`)
//   return true
// }

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
  
  // /** Create a batch id */
  // export const newBatchId = () => `B_${Math.random().toString(36).slice(2,8)}`
  
  // /** Duration formula: base 7 days - (level-1), min 1 day */
  // export const batchDurationDays = (level:number) => Math.max(1, 7 - (level-1))
  
  // /** Slot formula: base 2 + (level-1) */
  // export const batchSlots = (level:number) => 2 + (level-1)
  