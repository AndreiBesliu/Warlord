// src/logic/recruitSources.ts
// Where the men come from.
//
// Recruiting was one number field and one button: the only decision was "how many". Half
// the mechanic was already written and dead — `RecruitPool` has carried an XP figure since
// the beginning, `recruit()` already blended it count-weighted, and nothing ever put
// anything but zero into it or ever read it back out.
//
// A source is a price and a starting XP. The governing rule, enforced as a ceiling in
// `GameConfig.recruitSource`, is that no source reaches the first promotion threshold on
// its own: money buys a head start toward a rank, never the rank.

import { GameConfig, type RecruitSourceConfig } from './config'
import type { RecruitPool } from './types'

export type RecruitSourceId = 'LEVY' | 'VOLUNTEERS' | 'MERCENARIES'

/** Cheapest first — the order the recruit screen offers them in. */
export const RECRUIT_SOURCES: RecruitSourceId[] = ['LEVY', 'VOLUNTEERS', 'MERCENARIES']

/** Absent = LEVY, which is priced ×1 at 0 XP — i.e. recruiting exactly as it always was. */
export function sourceConfig(source: RecruitSourceId | undefined): RecruitSourceConfig {
  return GameConfig.recruitSource(source ?? 'LEVY')
}

export function sourceCostCopper(qty: number, source: RecruitSourceId | undefined): number {
  const n = Math.max(0, Math.floor(qty || 0))
  return Math.round(GameConfig.recruitCost() * sourceConfig(source).costMult * n)
}

export function startingXpOf(source: RecruitSourceId | undefined): number {
  return sourceConfig(source).startingXp
}

/**
 * The pool stores a TOTAL, not an average, and this is the whole reason.
 *
 * The old shape re-derived the mean and floored it on every write, so the loss compounded
 * across recruitings instead of cancelling: ten mercenaries followed by fifty levies landed
 * at 21 XP where the arithmetic says 25 — a sixth of what was paid for, gone with no error
 * and nowhere to see it. Keeping the total makes the blend exact by construction, and makes
 * "taking men out does not move the average" true by construction rather than true only
 * while the pool happens to be uniform.
 */
export function blendIn(pool: RecruitPool, n: number, xpEach: number): RecruitPool {
  const men = Math.max(0, Math.floor(n || 0))
  const xp = Math.max(0, Math.round(Number.isFinite(xpEach) ? xpEach : 0))
  return { count: pool.count + men, totalXp: pool.totalXp + men * xp }
}

export function avgXpOf(pool: RecruitPool): number {
  return pool.count > 0 ? Math.floor(pool.totalXp / pool.count) : 0
}

/**
 * Men leaving for a training batch. They carry the pool average out with them, so exactly
 * that much leaves the total and the average of those left behind is unchanged.
 */
export function takeFrom(pool: RecruitPool, n: number): RecruitPool {
  const men = Math.min(pool.count, Math.max(0, Math.floor(n || 0)))
  const left = pool.count - men
  // An empty pool holds no XP. The sub-1 remainder that integer division leaves behind
  // belonged to nobody, and carrying it would make the next recruit's average lie.
  if (left <= 0) return { count: 0, totalXp: 0 }
  return { count: left, totalXp: Math.max(0, pool.totalXp - men * avgXpOf(pool)) }
}

/**
 * What the pool average becomes if this purchase goes through — the recruit screen states
 * it before the click. Same function as the real blend, deliberately: a preview that
 * re-derives the formula is how a screen starts lying, and this project has shipped that
 * three times.
 */
export function avgAfterRecruiting(
  pool: RecruitPool,
  n: number,
  source: RecruitSourceId | undefined,
): number {
  return avgXpOf(blendIn(pool, n, startingXpOf(source)))
}
