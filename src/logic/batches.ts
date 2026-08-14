
import { Ranks, type Rank, type BarracksPool, type SoldierType } from './types'
import { GameConfig } from './config'
import { PROMOTE_AT } from './units'

  export type BatchKind = 'LIGHT_TRAIN' | 'LIGHT_CAV' | 'HEAVY_CAV' | 'HORSE_ARCHER'

  export type RankCount = Partial<Record<Rank, number>>

  /**
   * How hard the batch is drilled. Absent means STANDARD, so every batch already in a
   * save — and every conversion, which does not take an intensity — behaves exactly as
   * it did. Basic training was a pure wait: same days, same output, no choice in it.
   */
  export type Intensity = 'RUSHED' | 'STANDARD' | 'DRILLED'

  export interface TrainingBatch {
    id: string
    kind: BatchKind
    target?: SoldierType        // e.g., 'LIGHT_INF_SPEAR', 'LIGHT_ARCHER'
    fromType?: SoldierType      // e.g., 'LIGHT_CAV' or 'HEAVY_INF_*' for heavy cav
    qty: number                 // 1..50
    daysRemaining: number
    takeByRank?: RankCount      // if conversion, what ranks were consumed
    intensity?: Intensity       // basic training only; absent = STANDARD
  }

// L1=2 slots, +1 per level, cap 5 (reached at L4)
export function batchSlots(level: number, extra = 0) {
  const { maxSlots } = GameConfig.training()
  return Math.min(level + 1, maxSlots) + Math.max(0, Math.round(extra))
}

// L1=7 days, -1 per level, min 3 days
// `daysDelta` (negative) lets research shorten training; never below 1 day.
export function batchDurationDays(level: number, daysDelta = 0) {
  const { baseDays, minDays } = GameConfig.training()
  return Math.max(1, Math.max(baseDays - (level - 1), minDays) + Math.round(daysDelta))
}

export function newBatchId() {
  return `B_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Days a batch takes at a given intensity. The base duration (level, research) is
 * unchanged and still the single source; intensity scales it and the 1-day floor holds.
 */
export function batchDaysAt(level: number, intensity: Intensity | undefined, daysDelta = 0) {
  const base = batchDurationDays(level, daysDelta)
  const { dayMult } = GameConfig.intensity(intensity ?? 'STANDARD')
  return Math.max(1, Math.round(base * dayMult))
}

export function enqueueBatch(
  current: TrainingBatch[],
  draft: Omit<TrainingBatch, 'id' | 'daysRemaining'> & { level: number },
  daysDelta = 0, // research: negative shortens training
): TrainingBatch[] {
  const id = newBatchId()
  const daysRemaining = batchDaysAt(draft.level, draft.intensity, daysDelta)
  const next: TrainingBatch = {
    id,
    kind: draft.kind,
    target: draft.target,
    fromType: draft.fromType,
    qty: draft.qty,
    daysRemaining,
    takeByRank: draft.takeByRank,
    intensity: draft.intensity,
  }
  return [next, ...current]
}

/** Soldiers who actually finish. Rushed training loses some of them. */
export function survivorsOf(qty: number, intensity: Intensity | undefined): number {
  const { washoutPct } = GameConfig.intensity(intensity ?? 'STANDARD')
  if (washoutPct <= 0) return qty
  // Never wipe a batch out entirely — a training choice must not be able to cost
  // everything, or nobody would ever take it twice.
  return Math.max(1, qty - Math.floor(qty * (washoutPct / 100)))
}

/** XP the finished soldiers carry, before research/momentum multipliers. */
export function trainingXpOf(intensity: Intensity | undefined): number {
  return GameConfig.intensity(intensity ?? 'STANDARD').xpGranted
}

/**
 * XP a finished batch actually carries, after research and momentum — capped so a batch
 * can promote AT MOST ONE rank.
 *
 * Without the cap, a player with the training techs stacked (trainXpMult goes to ×3) would
 * get ADVANCED soldiers straight out of the barracks, which is the whole ~22-day climb
 * through Training Mode skipped in one purchase. Intensity buys a head start, not a
 * shortcut. THE single source: the tick and the pre-press forecast both call this.
 */
export function trainingXpFor(intensity: Intensity | undefined, xpMult = 1): number {
  const granted = Math.round(trainingXpOf(intensity) * (Number.isFinite(xpMult) ? xpMult : 1))
  const first = PROMOTE_AT.NOVICE ?? Infinity
  const second = PROMOTE_AT.TRAINED ?? Infinity
  return Math.max(0, Math.min(granted, first + second - 1))
}

/** Copper of drill pay for the whole batch, charged when it is queued. */
export function drillPayFor(qty: number, intensity: Intensity | undefined): number {
  const { payPerSoldier } = GameConfig.intensity(intensity ?? 'STANDARD')
  return Math.max(0, Math.round(payPerSoldier * Math.max(0, qty)))
}

export function canEnqueue(current: TrainingBatch[], level: number, extraSlots = 0) {
  return current.length < batchSlots(level, extraSlots)
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
