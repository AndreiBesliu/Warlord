import { describe, it, expect } from 'vitest'
import {
  addBucket, addMen, emptyPool, hydratePool, pooledCount, pooledXp, slotAvg, takeMen,
} from './barracksPool'
import { reinforceBuckets } from './units'
import type { PoolSlot } from './barracksPool'
import type { UnitBucket } from './types'

const totalOf = (bs: UnitBucket[]) => bs.reduce((a, b) => a + b.count * b.avgXP, 0)

describe('a slot stores a TOTAL, so a merge is exact', () => {
  it('men arriving add exactly what they carry', () => {
    let s: PoolSlot = { r: 'NOVICE', count: 0, totalXp: 0 }
    s = addMen(s, 3, 40)
    s = addMen(s, 7, 0)
    expect(s.count).toBe(10)
    expect(s.totalXp).toBe(120)
    expect(slotAvg(s)).toBe(12)
  })

  it('AND THE REMAINDER IS NOT THROWN AWAY — this is the whole point', () => {
    // The old shape stored the floored mean, so 120/10 = 12 and the 0 remainder was fine,
    // but 121/10 = 12 lost a point on every single write, compounding across merges.
    let s: PoolSlot = { r: 'NOVICE', count: 0, totalXp: 0 }
    for (let i = 0; i < 10; i++) s = addMen(s, 1, 121)
    expect(s.totalXp).toBe(1210)
    // Under the old shape this walked downward with every blend; here it cannot.
    expect(slotAvg(s)).toBe(121)
  })

  it('taking men out does not move the average of those left behind', () => {
    const s: PoolSlot = { r: 'NOVICE', count: 100, totalXp: 5_555 }
    const before = slotAvg(s)
    const { slot, taken, xpEach } = takeMen(s, 37)
    expect(taken).toBe(37)
    expect(xpEach).toBe(before)
    expect(slotAvg(slot)).toBe(before)
  })

  it('emptying a slot leaves nothing behind, and over-taking is capped', () => {
    const { slot, taken } = takeMen({ r: 'NOVICE', count: 5, totalXp: 500 }, 9_999)
    expect(taken).toBe(5)
    expect(slot).toEqual({ r: 'NOVICE', count: 0, totalXp: 0 })
  })

  it('an empty slot is worth nothing rather than NaN', () => {
    expect(slotAvg({ count: 0, totalXp: 0 })).toBe(0)
    expect(slotAvg(undefined)).toBe(0)
  })
})

describe('THE ROUND TRIP: pool → unit → pool', () => {
  it('no longer destroys experience', () => {
    // Measured on the old code, this exact scenario went 600 in, 550 out. The men were not
    // lost — only what they knew was, and nothing anywhere said so.
    const pool = emptyPool()
    pool.LIGHT_INF_SWORD.NOVICE = { r: 'NOVICE', count: 100, totalXp: 0 }
    const unit: UnitBucket[] = [{ r: 'NOVICE', count: 10, avgXP: 60 }]
    const startXp = pooledXp(pool) + totalOf(unit)
    const startMen = pooledCount(pool) + 10

    // Fill the unit from the pool.
    const { slot, taken, xpEach } = takeMen(pool.LIGHT_INF_SWORD.NOVICE, 100)
    pool.LIGHT_INF_SWORD.NOVICE = slot
    const filled = reinforceBuckets(unit, [{ r: 'NOVICE', count: taken, avgXP: xpEach }])

    // Disband it back.
    for (const b of filled) {
      pool.LIGHT_INF_SWORD[b.r] = addBucket(pool.LIGHT_INF_SWORD[b.r], b)
    }

    expect(pooledCount(pool)).toBe(startMen)
    // `reinforceBuckets` floors its own per-rank averages, so a little is still lost INSIDE
    // the unit — that is a separate, documented conservation. What must not happen any more
    // is the pool losing more on the way back in.
    expect(pooledXp(pool)).toBe(totalOf(filled))
    expect(pooledXp(pool)).toBeGreaterThan(540)
    expect(pooledXp(pool)).toBeLessThanOrEqual(startXp)
  })

  it('and a straight there-and-back with no teaching is EXACT', () => {
    const pool = emptyPool()
    pool.HEAVY_ARCHER.TRAINED = { r: 'TRAINED', count: 40, totalXp: 1_234 }
    const before = pooledXp(pool)
    const { slot, taken, xpEach } = takeMen(pool.HEAVY_ARCHER.TRAINED, 40)
    pool.HEAVY_ARCHER.TRAINED = slot
    pool.HEAVY_ARCHER.TRAINED = addMen(pool.HEAVY_ARCHER.TRAINED, taken, xpEach)
    // 1234/40 floors to 30, so the honest round trip is 1200: the remainder went out with
    // nobody. Taking ALL the men is the one case where the floor cannot be hidden.
    expect(pooledXp(pool)).toBe(1_200)
    expect(before - pooledXp(pool)).toBe(34)
  })
})

describe('what a save may carry', () => {
  it('a save from before this change is migrated by multiplying out the average', () => {
    const old = {
      LIGHT_INF_SWORD: { NOVICE: { r: 'NOVICE', count: 10, avgXP: 12 } },
    }
    const p = hydratePool(old)
    expect(p.LIGHT_INF_SWORD.NOVICE).toEqual({ r: 'NOVICE', count: 10, totalXp: 120 })
  })

  it('a save already in the new shape round-trips unchanged', () => {
    const p = emptyPool()
    p.HEAVY_CAV.VETERAN = { r: 'VETERAN', count: 3, totalXp: 999 }
    expect(hydratePool(JSON.parse(JSON.stringify(p))).HEAVY_CAV.VETERAN)
      .toEqual({ r: 'VETERAN', count: 3, totalXp: 999 })
  })

  it('garbage reads as an empty slot rather than NaN', () => {
    // `useBarracks` had NO hydration at all — a raw `saved?.barracks ?? empty()`. A NaN in a
    // slot would have propagated into every unit filled from it.
    const p = hydratePool({
      LIGHT_ARCHER: { NOVICE: { count: 'x', avgXP: 'y' }, TRAINED: null, ELITE: { count: -5 } },
      NOT_A_TYPE: { NOVICE: { count: 9, avgXP: 9 } },
    })
    expect(p.LIGHT_ARCHER.NOVICE).toEqual({ r: 'NOVICE', count: 0, totalXp: 0 })
    expect(p.LIGHT_ARCHER.ELITE).toEqual({ r: 'ELITE', count: 0, totalXp: 0 })
    expect(pooledCount(p)).toBe(0)
  })

  it('an absent save is an empty pool with every type and rank present', () => {
    const p = hydratePool(null)
    expect(pooledCount(p)).toBe(0)
    expect(p.HORSE_ARCHER.ELITE).toEqual({ r: 'ELITE', count: 0, totalXp: 0 })
  })
})
