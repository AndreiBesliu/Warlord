// src/logic/barracksPool.ts
// The typed barracks pool — and the same lesson `recruitSources.ts` already paid for once.
//
// ── The bug this closes ────────────────────────────────────────────────────────────────
//
// A slot used to store `{ count, avgXP }`: an AVERAGE. Every merge into it re-derived the
// mean and floored it, so the loss compounded across merges instead of cancelling. Three
// separate places did that same floored blend — a batch graduating, a unit disbanding, and a
// unit being filled — so a man could go pool → unit → pool and arrive worth less than he left,
// with no error and nowhere to see it. Measured on the real code: a 10-strong unit at 60 XP
// filled from a pool of 100 and disbanded lands at 550 XP where 600 went in.
//
// `RecruitPool` had exactly this and was fixed by storing a TOTAL. Its comment even says why:
// "the old shape re-derived the mean and floored it on every write, so the loss compounded
// across recruitings instead of cancelling". One of the two pools was fixed and the other was
// left on the old shape. This is the other one.
//
// Storing the total makes the blend exact by construction, and makes "taking men out does not
// move the average" true by construction rather than true only while the slot is uniform.
//
// Pure: no React, no Date.now, no Math.random.

import { Ranks, type Rank, type SoldierType, type UnitBucket } from './types'

export interface PoolSlot {
  r: Rank
  count: number
  /** The TOTAL carried by everyone in the slot. The average is derived, never stored. */
  totalXp: number
}

export type TypedPool = Record<SoldierType, Record<Rank, PoolSlot>>

export const POOL_TYPES: SoldierType[] = [
  'LIGHT_INF_SWORD', 'LIGHT_INF_SPEAR', 'LIGHT_INF_HALBERD',
  'HEAVY_INF_SWORD', 'HEAVY_INF_SPEAR', 'HEAVY_INF_HALBERD',
  'LIGHT_ARCHER', 'HEAVY_ARCHER', 'LIGHT_CAV', 'HEAVY_CAV', 'HORSE_ARCHER',
]

export function emptyPool(): TypedPool {
  const pool = {} as TypedPool
  for (const t of POOL_TYPES) {
    const byRank = {} as Record<Rank, PoolSlot>
    for (const r of Ranks) byRank[r] = { r, count: 0, totalXp: 0 }
    pool[t] = byRank
  }
  return pool
}

/** What one man in this slot is worth. Floored for display; the total keeps the remainder. */
export function slotAvg(slot: { count: number; totalXp: number } | undefined): number {
  if (!slot || slot.count <= 0) return 0
  return Math.floor(slot.totalXp / slot.count)
}

/** Men arriving. Exact: the slot gains precisely the experience that walked in. */
export function addMen(slot: PoolSlot, count: number, xpEach: number): PoolSlot {
  const men = Math.max(0, Math.floor(count || 0));
  const xp = Math.max(0, Math.round(Number.isFinite(xpEach) ? xpEach : 0));
  return { r: slot.r, count: slot.count + men, totalXp: slot.totalXp + men * xp };
}

/** A whole bucket arriving — a unit's rank-group coming home. */
export function addBucket(slot: PoolSlot, bucket: { count: number; avgXP: number }): PoolSlot {
  return addMen(slot, bucket.count, bucket.avgXP);
}

/**
 * Men leaving. They carry the slot's average out, so exactly that much leaves the total and
 * the average of those left behind is unchanged — which is the property an average-shaped
 * slot could only ever approximate.
 */
export function takeMen(slot: PoolSlot, count: number): { slot: PoolSlot; taken: number; xpEach: number } {
  const men = Math.min(slot.count, Math.max(0, Math.floor(count || 0)));
  if (men <= 0) return { slot, taken: 0, xpEach: slotAvg(slot) };
  const xpEach = slotAvg(slot);
  const remaining = slot.count - men;
  // The remainder stays with the men still here, so nothing is rounded away.
  const totalXp = remaining > 0 ? slot.totalXp - men * xpEach : 0;
  return { slot: { r: slot.r, count: remaining, totalXp: Math.max(0, totalXp) }, taken: men, xpEach };
}

/** The whole pool as buckets, for anything that wants to read it like a unit. */
export function slotBucket(slot: PoolSlot): UnitBucket {
  return { r: slot.r, count: slot.count, avgXP: slotAvg(slot) };
}

const n0 = (v: unknown): number => {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/**
 * Rebuild the pool on a closed list, migrating the old average-shaped slots.
 *
 * `useBarracks` had NO hydration — `saved?.barracks ?? emptyBarracks()`, a raw door with no
 * coercion, the same shape that made `econ.buildings` the one slice a bad value could poison.
 * A save written before this change carries `avgXP`; `totalXp = count * avgXP` is the exact
 * value that shape was trying to represent, so the migration loses nothing that was not
 * already lost.
 */
export function hydratePool(saved: unknown): TypedPool {
  const pool = emptyPool();
  if (!saved || typeof saved !== 'object') return pool;
  const src = saved as Record<string, unknown>;
  for (const t of POOL_TYPES) {
    const byRank = src[t];
    if (!byRank || typeof byRank !== 'object') continue;
    for (const r of Ranks) {
      const raw = (byRank as Record<string, unknown>)[r];
      if (!raw || typeof raw !== 'object') continue;
      const s = raw as Record<string, unknown>;
      const count = n0(s.count);
      const totalXp = 'totalXp' in s ? n0(s.totalXp) : count * n0(s.avgXP);
      pool[t][r] = { r, count, totalXp };
    }
  }
  return pool;
}

/** Everyone the pool is housing, across every type and rank. */
export function pooledCount(pool: TypedPool): number {
  let total = 0;
  for (const t of POOL_TYPES) for (const r of Ranks) total += pool[t][r].count;
  return total;
}

/** Every scrap of experience the pool holds — the number a conservation test asserts on. */
export function pooledXp(pool: TypedPool): number {
  let total = 0;
  for (const t of POOL_TYPES) for (const r of Ranks) total += pool[t][r].totalXp;
  return total;
}
