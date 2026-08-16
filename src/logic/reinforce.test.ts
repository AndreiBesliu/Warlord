import { describe, it, expect } from 'vitest'
import { reinforceBuckets, teachableXp, PROMOTE_AT } from './units'
import type { Rank } from './types'

type B = { r: Rank; count: number; avgXP: number }
const xp = (bs: B[]) => bs.reduce((a, b) => a + b.count * b.avgXP, 0)
const men = (bs: B[]) => bs.reduce((a, b) => a + b.count, 0)

describe('reinforcement can never mint experience', () => {
  it('the army total never goes UP — the whole point of the change', () => {
    // What it used to do: a 40-strong VETERAN unit taking 10 recruits gained 700 XP out of
    // nothing, every single time, and the richer average bought a bigger bonus next time.
    const vets: B[] = [{ r: 'VETERAN', count: 40, avgXP: 700 }]
    const news: B[] = [{ r: 'NOVICE', count: 10, avgXP: 0 }]
    const after = reinforceBuckets(vets, news)
    expect(xp(after)).toBeLessThanOrEqual(xp(vets) + xp(news))
    expect(men(after)).toBe(50)
  })

  it('holds across every shape, not just the one that was reported', () => {
    const ranks: Rank[] = ['NOVICE', 'TRAINED', 'ADVANCED', 'VETERAN', 'ELITE']
    for (const vr of ranks) for (const nr of ranks) {
      for (const [vc, va, nc, na] of [[40, 700, 10, 0], [3, 50, 30, 400], [1, 999, 1, 0], [20, 0, 20, 0]]) {
        const vets: B[] = [{ r: vr, count: vc, avgXP: va }]
        const news: B[] = [{ r: nr, count: nc, avgXP: na }]
        const after = reinforceBuckets(vets, news)
        expect(xp(after)).toBeLessThanOrEqual(xp(vets) + xp(news))
        expect(men(after)).toBe(vc + nc)
      }
    }
  })

  it('the replenish → disband loop stops paying', () => {
    // Reinforce, then send everyone back, then reinforce again — the cycle that printed
    // ranks. A hundred turns of it must not leave the army richer than it started.
    let pool = 0
    let unit: B[] = [{ r: 'TRAINED', count: 20, avgXP: 300 }]
    const startTotal = xp(unit)
    for (let i = 0; i < 100; i++) {
      const arrivals: B[] = [{ r: 'NOVICE', count: 5, avgXP: pool }]
      const before = xp(unit) + xp(arrivals)
      unit = reinforceBuckets(unit, arrivals)
      expect(xp(unit)).toBeLessThanOrEqual(before)
      // disband: everyone goes back to the pool at the unit's average
      pool = Math.floor(xp(unit) / men(unit))
      unit = [{ r: 'TRAINED', count: 20, avgXP: pool }]
    }
    expect(xp(unit)).toBeLessThanOrEqual(startTotal)
  })
})

describe('the teaching itself survives — it just gets paid for', () => {
  it('newcomers really are lifted, and the teachers really pay', () => {
    const vets: B[] = [{ r: 'VETERAN', count: 40, avgXP: 700 }]
    const news: B[] = [{ r: 'NOVICE', count: 10, avgXP: 0 }]
    const after = reinforceBuckets(vets, news)
    const novice = after.find((b) => b.r === 'NOVICE')!
    const veteran = after.find((b) => b.r === 'VETERAN')!
    expect(novice.avgXP).toBeGreaterThan(0)   // they learned something
    expect(veteran.avgXP).toBeLessThan(700)   // and it came from somebody
  })

  it('a teacher cannot take a pupil past himself', () => {
    // The bound is not a clamp bolted on afterwards — it is where the transfer runs out.
    const vets: B[] = [{ r: 'TRAINED', count: 1, avgXP: 300 }]
    const news: B[] = [{ r: 'NOVICE', count: 50, avgXP: 0 }]
    const after = reinforceBuckets(vets, news)
    const t = after.find((b) => b.r === 'TRAINED')!
    const n = after.find((b) => b.r === 'NOVICE')!
    expect(t.avgXP).toBeGreaterThanOrEqual(n.avgXP)
  })

  it('nothing is taught when the newcomers already know more', () => {
    const vets: B[] = [{ r: 'NOVICE', count: 10, avgXP: 10 }]
    const news: B[] = [{ r: 'VETERAN', count: 10, avgXP: 700 }]
    const after = reinforceBuckets(vets, news)
    expect(after.find((b) => b.r === 'NOVICE')!.avgXP).toBe(10) // untouched, not drained
    expect(teachableXp(10, 100, 10, 7000, 999)).toBe(0)
  })

  it('reinforcement DILUTES, which is the honest outcome', () => {
    // A veteran unit topped up with green men is worth less per head afterwards. The old
    // bonus hid that; conserving the total is what makes it visible again.
    const vets: B[] = [{ r: 'VETERAN', count: 10, avgXP: 700 }]
    const news: B[] = [{ r: 'NOVICE', count: 10, avgXP: 0 }]
    const after = reinforceBuckets(vets, news)
    expect(Math.floor(xp(after) / men(after))).toBeLessThan(700)
  })

  it('cannot promote anyone by itself', () => {
    // Reinforcement redistributes; it must never hand a bucket a rank it did not earn.
    const vets: B[] = [{ r: 'NOVICE', count: 30, avgXP: (PROMOTE_AT.NOVICE ?? 100) - 1 }]
    const news: B[] = [{ r: 'NOVICE', count: 5, avgXP: 0 }]
    const after = reinforceBuckets(vets, news)
    expect(after[0].avgXP).toBeLessThan(PROMOTE_AT.NOVICE ?? Infinity)
  })
})

describe('the edges', () => {
  it('a unit with nobody in it just receives the arrivals', () => {
    const news: B[] = [{ r: 'NOVICE', count: 5, avgXP: 40 }]
    expect(reinforceBuckets([], news)).toEqual(news)
  })

  it('no arrivals leaves the unit exactly as it was', () => {
    const vets: B[] = [{ r: 'VETERAN', count: 7, avgXP: 700 }]
    expect(reinforceBuckets(vets, [])).toEqual(vets)
  })

  it('empty buckets are dropped, not carried as ghosts', () => {
    const vets: B[] = [{ r: 'VETERAN', count: 0, avgXP: 700 }, { r: 'NOVICE', count: 4, avgXP: 10 }]
    const after = reinforceBuckets(vets, [{ r: 'NOVICE', count: 2, avgXP: 0 }])
    expect(after.map((b) => b.r)).toEqual(['NOVICE'])
  })

  it('comes back in rank order, so the sheet does not shuffle', () => {
    const after = reinforceBuckets(
      [{ r: 'VETERAN', count: 5, avgXP: 700 }, { r: 'NOVICE', count: 5, avgXP: 0 }],
      [{ r: 'TRAINED', count: 5, avgXP: 200 }],
    )
    expect(after.map((b) => b.r)).toEqual(['NOVICE', 'TRAINED', 'VETERAN'])
  })
})
