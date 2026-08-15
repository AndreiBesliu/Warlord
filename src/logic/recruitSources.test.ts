import { describe, it, expect, beforeEach } from 'vitest'
import { GameConfig, DEFAULT_RECRUIT_COST, DEFAULT_RECRUIT_SOURCES } from './config'
import {
  RECRUIT_SOURCES,
  avgAfterRecruiting,
  avgXpOf,
  blendIn,
  sourceCostCopper,
  startingXpOf,
  takeFrom,
  type RecruitSourceId,
} from './recruitSources'
import { BATCH_XP_CAP, survivorsOf, trainingXpFor, trainingXpLost } from './batches'
import { PROMOTE_AT, promoteBuckets, nextRank } from './units'
import { demandFor } from './equipment'
import { Registry } from './registry'
import { hydrateRecruits } from '../state/useBarracks'
import type { Rank, RecruitPool } from './types'

// Equipment demand is read through the Registry, and an uninitialised one answers "nothing
// required" — which would make the gear test below pass while proving nothing.
Registry.init()
beforeEach(() => GameConfig.init(null))

const empty = (): RecruitPool => ({ count: 0, totalXp: 0 })

// What a finished batch becomes, through the same two functions the tick uses. Kept here
// so the expectations are about the RULES, not about a copy of them.
const outcome = (qty: number, intensity: Parameters<typeof survivorsOf>[1], xpMult = 1, carried = 0) => {
  const out = survivorsOf(qty, intensity)
  const xp = trainingXpFor(intensity, xpMult, carried)
  const { buckets } = promoteBuckets([{ r: 'NOVICE' as Rank, count: out, avgXP: xp }])
  return { out, xp, buckets }
}

describe('LEVY is exactly what recruiting did before sources existed', () => {
  it('same price, no head start — and an absent source is LEVY', () => {
    // Every save in the wild recruited without naming a source. This is that guard.
    for (const n of [1, 7, 50, 500]) {
      expect(sourceCostCopper(n, 'LEVY')).toBe(DEFAULT_RECRUIT_COST * n)
      expect(sourceCostCopper(n, undefined)).toBe(DEFAULT_RECRUIT_COST * n)
    }
    expect(startingXpOf('LEVY')).toBe(0)
    expect(startingXpOf(undefined)).toBe(0)
  })

  it('a batch with nothing carried is bit-identical to the two-argument call', () => {
    // trainingXpFor grew a third parameter. Every existing call site passes two.
    for (const intensity of ['RUSHED', 'STANDARD', 'DRILLED'] as const) {
      for (const mult of [1, 1.25, 1.75, 3]) {
        expect(trainingXpFor(intensity, mult, 0)).toBe(trainingXpFor(intensity, mult))
        expect(trainingXpFor(intensity, mult, undefined as unknown as number)).toBe(
          trainingXpFor(intensity, mult),
        )
      }
    }
    expect(outcome(20, 'STANDARD').buckets).toEqual([{ r: 'NOVICE', count: 20, avgXP: 0 }])
  })
})

describe('money buys a head start, never a rank', () => {
  it('no shipped source reaches the first promotion threshold on its own', () => {
    const threshold = PROMOTE_AT.NOVICE ?? Infinity
    for (const s of RECRUIT_SOURCES) {
      expect(startingXpOf(s)).toBeLessThan(threshold)
    }
    // And the defaults themselves, so a retune of the table is caught at its source.
    for (const cfg of Object.values(DEFAULT_RECRUIT_SOURCES)) {
      expect(cfg.startingXp).toBeLessThan(threshold)
    }
  })

  it('the admin cannot buy a rank either', () => {
    // The ceiling lives in the getter, not in the default values, precisely so that a
    // number typed into the admin cannot turn copper into rank.
    GameConfig.init({ recruitSources: { MERCENARIES: { startingXp: 500 } } })
    expect(startingXpOf('MERCENARIES')).toBeLessThan(PROMOTE_AT.NOVICE ?? Infinity)

    // Stated as the rule rather than the number: the men still come out Novice.
    const { buckets } = outcome(20, 'STANDARD', 1, startingXpOf('MERCENARIES'))
    expect(buckets).toEqual([{ r: 'NOVICE', count: 20, avgXP: startingXpOf('MERCENARIES') }])
  })

  it('the most expensive men, drilled, with research maxed, still gain at most one rank', () => {
    // The invariant the whole cap exists for: the ~22-day climb through Training Mode
    // cannot be bought past, however the XP was paid for.
    const carried = startingXpOf('MERCENARIES')
    const { buckets } = outcome(20, 'DRILLED', 3, carried)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].r).toBe(nextRank('NOVICE'))
    expect(buckets[0].avgXP).toBeLessThan(PROMOTE_AT.TRAINED ?? Infinity)
  })

  it('the ceiling is the same one for both XP channels, and it accounts for what it drops', () => {
    const carried = startingXpOf('MERCENARIES')
    for (const mult of [1, 1.75, 3]) {
      const kept = trainingXpFor('DRILLED', mult, carried)
      const lost = trainingXpLost('DRILLED', mult, carried)
      expect(kept).toBeLessThanOrEqual(BATCH_XP_CAP)
      // Nothing vanishes unaccounted: what is kept plus what is dropped is what was earned.
      expect(kept + lost).toBe(Math.round(120 * mult) + carried)
      expect(lost > 0).toBe(Math.round(120 * mult) + carried > BATCH_XP_CAP)
    }
  })

  it('carried XP is not multiplied by the training multiplier', () => {
    // trainXpMult is research into TRAINING. What these men walked in with is not that.
    const carried = 90
    expect(trainingXpFor('STANDARD', 3, carried)).toBe(carried)
  })
})

describe('the pool conserves XP instead of leaking it', () => {
  it('fifty single recruitings equal one recruiting of fifty', () => {
    // The old shape re-derived and floored the mean on every write, so the loss compounded
    // across recruitings. Storing the total makes this exact by construction.
    let drip = empty()
    for (let i = 0; i < 50; i++) drip = blendIn(drip, 1, 90)
    const bulk = blendIn(empty(), 50, 90)
    expect(drip).toEqual(bulk)
    expect(avgXpOf(drip)).toBe(90)
  })

  it('alternating cheap and expensive men lands on the exact arithmetic mean', () => {
    let pool = empty()
    for (let i = 0; i < 20; i++) {
      pool = blendIn(pool, 1, 90)
      pool = blendIn(pool, 1, 0)
    }
    expect(pool.count).toBe(40)
    expect(pool.totalXp).toBe(20 * 90)
    expect(avgXpOf(pool)).toBe(45)
  })

  it('taking men out does not move the average of the men left', () => {
    const pool = blendIn(blendIn(empty(), 10, 90), 50, 0) // 60 men, 900 XP → 15 each
    expect(avgXpOf(pool)).toBe(15)
    const after = takeFrom(pool, 20)
    expect(after.count).toBe(40)
    expect(avgXpOf(after)).toBe(15)
  })

  it('an emptied pool holds no XP', () => {
    // Otherwise the sub-1 remainder integer division leaves behind would belong to nobody
    // and would make the next recruit's average lie.
    const pool = blendIn(empty(), 7, 90)
    expect(takeFrom(pool, 7)).toEqual({ count: 0, totalXp: 0 })
    expect(takeFrom(pool, 999)).toEqual({ count: 0, totalXp: 0 })
    expect(avgXpOf(empty())).toBe(0)
  })

  it('the screen previews the dilution with the same function that performs it', () => {
    const pool = blendIn(empty(), 10, 90)
    const previewed = avgAfterRecruiting(pool, 50, 'LEVY')
    const actual = avgXpOf(blendIn(pool, 50, startingXpOf('LEVY')))
    expect(previewed).toBe(actual)
    expect(previewed).toBeLessThan(avgXpOf(pool)) // cheap men really do drag it down
  })
})

describe('save migration — the shape changed under an existing save', () => {
  it('an old pool storing an average is converted, not dropped', () => {
    // This slice has no hydrate function and reads an `any` blob, so a missed conversion
    // here would not be a type error — it would be XP quietly evaporating on load.
    expect(hydrateRecruits({ count: 10, avgXP: 90 })).toEqual({ count: 10, totalXp: 900 })
  })

  it('a new pool round-trips through JSON unchanged', () => {
    const pool = blendIn(empty(), 37, 40)
    expect(hydrateRecruits(JSON.parse(JSON.stringify(pool)))).toEqual(pool)
  })

  it('nothing, or nonsense, loads as an empty pool rather than undefined', () => {
    for (const bad of [undefined, null, 'x', 42, {}, { count: -5, avgXP: NaN }]) {
      const r = hydrateRecruits(bad)
      expect(r.count).toBeGreaterThanOrEqual(0)
      expect(r.totalXp).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(r.totalXp)).toBe(true)
    }
    expect(hydrateRecruits(undefined)).toEqual({ count: 0, totalXp: 0 })
  })
})

describe('the price tiers are a trade, not a ladder', () => {
  it('the expensive tier costs more per point of XP than the cheap one', () => {
    // If the premium tier were also the efficient one, the middle tier would be dead.
    const per = (s: RecruitSourceId) =>
      (sourceCostCopper(1, s) - sourceCostCopper(1, 'LEVY')) / startingXpOf(s)
    expect(per('MERCENARIES')).toBeGreaterThan(per('VOLUNTEERS'))
  })

  it('but delivers more XP per man, so it wins when room or time is the limit', () => {
    expect(startingXpOf('MERCENARIES')).toBeGreaterThan(startingXpOf('VOLUNTEERS'))
  })

  it('an unknown source falls back to LEVY instead of throwing', () => {
    expect(sourceCostCopper(10, 'NOT_A_SOURCE' as RecruitSourceId)).toBe(
      sourceCostCopper(10, 'LEVY'),
    )
  })

  it('an admin typo cannot make recruiting free or NaN', () => {
    GameConfig.init({ recruitSources: { LEVY: { costMult: NaN, startingXp: -50 } } })
    expect(Number.isFinite(sourceCostCopper(10, 'LEVY'))).toBe(true)
    expect(sourceCostCopper(10, 'LEVY')).toBe(DEFAULT_RECRUIT_COST * 10)
    expect(startingXpOf('LEVY')).toBe(0)
  })
})

describe('rushed training destroys the gear too — deliberately', () => {
  it('gear is bought for the whole batch and the washed-out men take theirs with them', () => {
    // This is the design's only self-correcting interaction: the more expensive the men,
    // the more RUSHED costs you. It is accidental in the code — queueLightTraining charges
    // demandFor(target, n) up front and nothing refunds the survivors' shortfall — so it is
    // pinned here before somebody "fixes" it into a refund and makes RUSHED dominant.
    const qty = 50
    const survivors = survivorsOf(qty, 'RUSHED')
    expect(survivors).toBeLessThan(qty)
    // EquipDemand is grouped {weapons, armors, horses}; count every piece in all of them.
    const pieces = (d: ReturnType<typeof demandFor>) =>
      Object.values(d).reduce(
        (sum: number, group) =>
          sum + Object.values(group as Record<string, number>).reduce((a, b) => a + (b || 0), 0),
        0,
      )
    const paidFor = pieces(demandFor('LIGHT_INF_SPEAR', qty))
    const neededByFinishers = pieces(demandFor('LIGHT_INF_SPEAR', survivors))
    expect(paidFor).toBeGreaterThan(0) // an uninitialised Registry would make this 0 and prove nothing
    expect(paidFor).toBeGreaterThan(neededByFinishers)
  })
})
