// src/logic/xpConservation.test.ts
// Can the army mint experience out of nothing?
//
// This was carried as an OPEN defect for over a week: "fill a unit from the pool, disband it,
// repeat — XP grows, costs nothing, needs no days". Probed numerically on 2026-08-24 and it
// DOES NOT REPRODUCE. Two things had to be true for the report to be right, and only one ever
// was:
//
//   1. Replenishing had to CREATE experience. It used to — `xpBonus = floor(avgXP * 0.10)` was
//      added on top. `reinforceBuckets` has since been rewritten into a TRANSFER: the veterans
//      are debited first and the pupils receive exactly what was debited, with the 10% acting
//      as a cap on how much teaching the veterans part with, not as newly created XP.
//   2. Disbanding had to preserve it. It did the opposite — the average-shaped pool slot lost
//      XP on every merge, which is the bug `barracksPool.ts` closes.
//
// So the loop LOST experience and the report had the sign backwards. Fixing the pool removed
// the loss; these tests prove that removing it did not turn a leak into a fountain.
import { describe, it, expect } from 'vitest'
import { reinforceBuckets } from './units'
import { addBucket, emptyPool, pooledXp, takeMen, slotAvg } from './barracksPool'
import { Ranks } from './types'
import type { UnitBucket } from './types'

const totalOf = (bs: UnitBucket[]) => bs.reduce((a, b) => a + b.count * b.avgXP, 0)

// Deterministic PRNG so a failure is reproducible.
let seed = 12345
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }

describe('THE MINT: can fill -> disband -> fill create experience?', () => {
  it('reinforceBuckets never returns more than went in, over 2000 random cases', () => {
    let worstGain = -Infinity
    for (let i = 0; i < 2000; i++) {
      const vets: UnitBucket[] = Ranks.filter(() => rnd(2) === 0)
        .map(r => ({ r, count: rnd(200), avgXP: rnd(400) }))
      const news: UnitBucket[] = Ranks.filter(() => rnd(2) === 0)
        .map(r => ({ r, count: rnd(200), avgXP: rnd(400) }))
      const before = totalOf(vets) + totalOf(news)
      const after = totalOf(reinforceBuckets(vets, news))
      worstGain = Math.max(worstGain, after - before)
    }
    expect(worstGain).toBeLessThanOrEqual(0)
  })

  it('and the LOOP itself converges downward, never upward, over 500 cycles', () => {
    const pool = emptyPool()
    pool.LIGHT_INF_SWORD.NOVICE = { r: 'NOVICE', count: 500, totalXp: 500 * 80 }
    let unit: UnitBucket[] = [{ r: 'NOVICE', count: 20, avgXP: 300 }]
    const start = pooledXp(pool) + totalOf(unit)
    let peak = start
    for (let c = 0; c < 500; c++) {
      const { slot, taken, xpEach } = takeMen(pool.LIGHT_INF_SWORD.NOVICE, 20)
      pool.LIGHT_INF_SWORD.NOVICE = slot
      unit = reinforceBuckets(unit, [{ r: 'NOVICE', count: taken, avgXP: xpEach }])
      for (const b of unit) pool.LIGHT_INF_SWORD[b.r] = addBucket(pool.LIGHT_INF_SWORD[b.r], b)
      unit = [{ r: 'NOVICE', count: 0, avgXP: 0 }]
      peak = Math.max(peak, pooledXp(pool))
    }
    // If the loop minted, `peak` would climb past where it started. It must not.
    expect(peak).toBeLessThanOrEqual(start)
    expect(slotAvg(pool.LIGHT_INF_SWORD.NOVICE)).toBeLessThanOrEqual(300)
  })
})
