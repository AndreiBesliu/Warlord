import { describe, it, expect, beforeEach } from 'vitest'
import { GameConfig, DEFAULT_INTENSITY } from './config'
import {
  batchDurationDays, batchDaysAt, enqueueBatch, survivorsOf, trainingXpOf, trainingXpFor, drillPayFor,
} from './batches'
import { promoteBuckets, PROMOTE_AT } from './units'
import type { Rank } from './types'

beforeEach(() => GameConfig.init(null))

// What a finished batch turns into, using the same two functions the tick uses. Kept
// here so the expectations are about the RULES, not about a copy of them.
const outcome = (qty: number, intensity: Parameters<typeof survivorsOf>[1], xpMult = 1) => {
  const out = survivorsOf(qty, intensity)
  const xp = trainingXpFor(intensity, xpMult)
  const { buckets } = promoteBuckets([{ r: 'NOVICE' as Rank, count: out, avgXP: xp }])
  return { out, buckets }
}

describe('STANDARD is exactly what training did before intensity existed', () => {
  it('same days, same men, same rank, no pay', () => {
    // The regression guard that matters most: every save in the wild is on STANDARD.
    for (const level of [1, 2, 3, 5]) {
      expect(batchDaysAt(level, 'STANDARD')).toBe(batchDurationDays(level))
      expect(batchDaysAt(level, undefined)).toBe(batchDurationDays(level))
    }
    const { out, buckets } = outcome(20, 'STANDARD')
    expect(out).toBe(20)
    expect(buckets).toEqual([{ r: 'NOVICE', count: 20, avgXP: 0 }])
    expect(drillPayFor(20, 'STANDARD')).toBe(0)
  })

  it('a batch queued with no intensity at all behaves as STANDARD', () => {
    const [b] = enqueueBatch([], { level: 1, kind: 'LIGHT_TRAIN', target: 'LIGHT_ARCHER', qty: 5 })
    expect(b.daysRemaining).toBe(batchDurationDays(1))
    expect(b.intensity).toBeUndefined()
  })

  it('still honours the research day discount and its one-day floor', () => {
    const plain = batchDaysAt(1, 'STANDARD', 0)
    expect(batchDaysAt(1, 'STANDARD', -2)).toBe(plain - 2)
    expect(batchDaysAt(1, 'STANDARD', -99)).toBe(1)
    expect(batchDaysAt(1, 'RUSHED', -99)).toBe(1)
  })
})

describe('DRILLED buys a head start, not a shortcut', () => {
  it('comes out TRAINED', () => {
    const { buckets } = outcome(20, 'DRILLED')
    expect(buckets).toHaveLength(1)
    expect(buckets[0].r).toBe('TRAINED')
    expect(buckets[0].count).toBe(20)
  })

  it('can NEVER reach ADVANCED, however hard research pushes the XP', () => {
    // Otherwise a single batch would replace the ~22-day climb through Training Mode.
    // trainXpMult is capped at 3 by the research engine; try well past it anyway.
    for (const mult of [1, 1.25, 1.4, 3, 10]) {
      const { buckets } = outcome(20, 'DRILLED', mult)
      const ranks = buckets.map((b) => b.r)
      expect(ranks).not.toContain('ADVANCED')
    }
  })

  it('grants less XP than the two thresholds together', () => {
    // The structural reason for the test above, stated as the rule it depends on.
    expect(DEFAULT_INTENSITY.DRILLED.xpGranted).toBeGreaterThanOrEqual(PROMOTE_AT.NOVICE!)
    expect(DEFAULT_INTENSITY.DRILLED.xpGranted).toBeLessThan(PROMOTE_AT.NOVICE! + PROMOTE_AT.TRAINED!)
  })

  it('takes longer and costs drill pay', () => {
    expect(batchDaysAt(1, 'DRILLED')).toBeGreaterThan(batchDaysAt(1, 'STANDARD'))
    expect(drillPayFor(20, 'DRILLED')).toBeGreaterThan(0)
  })
})

describe('RUSHED trades men for time', () => {
  it('is faster but fewer soldiers finish', () => {
    expect(batchDaysAt(1, 'RUSHED')).toBeLessThan(batchDaysAt(1, 'STANDARD'))
    expect(survivorsOf(20, 'RUSHED')).toBeLessThan(20)
  })

  it('never wipes a batch out entirely', () => {
    // A training choice that can cost everything is one nobody takes twice.
    GameConfig.init({ intensity: { RUSHED: { washoutPct: 99 } } })
    expect(survivorsOf(1, 'RUSHED')).toBe(1)
    expect(survivorsOf(50, 'RUSHED')).toBeGreaterThan(0)
  })

  it('comes out green — speed does not buy quality', () => {
    expect(outcome(20, 'RUSHED').buckets[0].r).toBe('NOVICE')
  })
})

describe('the admin can retune it, and cannot break it', () => {
  it('a retuned day multiplier reaches the queue', () => {
    const before = batchDaysAt(1, 'DRILLED')
    GameConfig.init({ intensity: { DRILLED: { dayMult: 4 } } })
    expect(batchDaysAt(1, 'DRILLED')).toBeGreaterThan(before)
  })

  it('a zero or absurd multiplier cannot make a batch instant', () => {
    GameConfig.init({ intensity: { DRILLED: { dayMult: 0 } } })
    expect(batchDaysAt(1, 'DRILLED')).toBeGreaterThanOrEqual(1)
    GameConfig.init({ intensity: { DRILLED: { dayMult: 'soon' as never } } })
    expect(batchDaysAt(1, 'DRILLED')).toBe(batchDaysAt(1, 'DRILLED'))
  })

  it('an unknown intensity key falls back to STANDARD rather than throwing', () => {
    expect(GameConfig.intensity('NONSENSE')).toEqual(DEFAULT_INTENSITY.STANDARD)
  })
})

describe('the two defects the completion path carried', () => {
  it('a conversion keeps the rank it consumed', () => {
    // Heavy cav is GATED on ADVANCED+, and completion then handed back NOVICE: the rank
    // you were required to have was destroyed by the step that required it. `takeByRank`
    // was written at enqueue and never read. This is the shape the tick now reads.
    const takeByRank: Partial<Record<Rank, number>> = { ADVANCED: 6, VETERAN: 4 }
    const arrivals = Object.entries(takeByRank)
      .filter((e): e is [Rank, number] => typeof e[1] === 'number' && e[1] > 0)
      .map(([r, count]) => ({ r, count, avgXP: 0 }))
    expect(arrivals).toEqual([
      { r: 'ADVANCED', count: 6, avgXP: 0 },
      { r: 'VETERAN', count: 4, avgXP: 0 },
    ])
    expect(arrivals.reduce((a, b) => a + b.count, 0)).toBe(10)
    expect(arrivals.some((a) => a.r === 'NOVICE')).toBe(false)
  })

  it('arrivals dilute the slot XP instead of inheriting it', () => {
    // Completion used to do `count += qty` and nothing else, so 50 green recruits landing
    // in a slot that held 20 disbanded veterans came out at the veterans' average.
    const slot = { count: 20, avgXP: 300 }
    const arrival = { count: 50, avgXP: 0 }
    const merged = slot.count + arrival.count
    const blended = Math.floor((slot.count * slot.avgXP + arrival.count * arrival.avgXP) / merged)
    expect(blended).toBe(85) // 20*300 / 70
    expect(blended).toBeLessThan(slot.avgXP)
  })
})
