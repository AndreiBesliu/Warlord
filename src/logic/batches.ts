
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
    /**
     * XP per man that these recruits walked in with, from whatever source bought them.
     * Photographed when the batch is QUEUED, because the pool average will have moved by
     * the time it finishes — these specific men left the pool then. Absent = 0 = a batch
     * from before recruit sources existed, i.e. today's behaviour exactly.
     */
    carriedXp?: number
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
    carriedXp: draft.carriedXp,
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
 * The most XP a batch may ever hand over, however it was paid for: enough to leave NOVICE,
 * and everything short of enough to leave TRAINED. One rank out of the barracks, no more.
 *
 * Without it, a player with the training techs stacked (trainXpMult goes to ×3) would get
 * ADVANCED soldiers straight out of the barracks — the whole ~22-day climb through Training
 * Mode skipped in one purchase. Was buried arithmetic; named because the recruit screen has
 * to explain it now, and because it is the same ceiling for both XP channels.
 */
export const BATCH_XP_CAP = (PROMOTE_AT.NOVICE ?? Infinity) + (PROMOTE_AT.TRAINED ?? Infinity) - 1

// Both channels before the ceiling: what intensity and research drilled INTO them, plus
// what they walked in with. Carried XP is deliberately NOT multiplied by `xpMult` — that
// is a multiplier on training, and this is what these men already had.
function rawTrainingXp(intensity: Intensity | undefined, xpMult: number, carriedXp: number): number {
  const granted = Math.round(trainingXpOf(intensity) * (Number.isFinite(xpMult) ? xpMult : 1))
  const carried = Math.max(0, Number.isFinite(carriedXp) ? carriedXp : 0)
  return Math.max(0, granted + carried)
}

/**
 * XP a finished batch actually carries, after research, momentum and the recruits' own
 * head start. Intensity and a paid source buy a head start, not a shortcut. THE single
 * source: the tick and the pre-press forecast both call this.
 */
export function trainingXpFor(intensity: Intensity | undefined, xpMult = 1, carriedXp = 0): number {
  return Math.min(rawTrainingXp(intensity, xpMult, carriedXp), BATCH_XP_CAP)
}

/**
 * How much the ceiling throws away — 0 whenever it does not bite. The screen states this
 * before the press: paying for men whose head start is about to be clipped is a fair trade
 * only if you can see it coming.
 */
export function trainingXpLost(intensity: Intensity | undefined, xpMult = 1, carriedXp = 0): number {
  return Math.max(0, rawTrainingXp(intensity, xpMult, carriedXp) - BATCH_XP_CAP)
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
