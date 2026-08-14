import { describe, it, expect, beforeEach } from 'vitest'
import { GameConfig, DEFAULT_STUDY } from '../config'
import {
  BRANCHES, emptyPools, branchOfBuilding, studyCostOf, scriptoriumStudy,
  studyFromValue, studyPerDay, addStudy, spendStudy, daysAtRate,
} from './study'
import { DEFAULT_TECHS } from './catalog'
import { hydrateResearch, emptyResearch } from '../../state/useResearch'
import type { Building } from '../types'
import { ResourceTypes } from '../types'
import { simulateEconomyDay } from '../economy'
import { makeEmptyInventories } from '../helpers'

beforeEach(() => GameConfig.init(null))

const b = (id: string, type: Building['type'], level = 1): Building => ({
  id, type, focusCoinPct: 100, fractionalBuffer: 0, level,
})
const withResearch = (base: Building, pct: Building['focusResearchPct']): Building =>
  ({ ...base, focusResearchPct: pct })

describe('a tech costs what it used to take', () => {
  it('derives the cost from `days`, so the shipped balance survives the model change', () => {
    for (const t of DEFAULT_TECHS) {
      expect(studyCostOf(t)).toBe(t.days * DEFAULT_STUDY.baselinePerDay)
    }
  })

  it('never costs zero, whatever the admin types', () => {
    GameConfig.init({ study: { baselinePerDay: 0 } })
    expect(studyCostOf({ days: 3 })).toBeGreaterThan(0)
  })
})

describe('where Study comes from', () => {
  it('a Scriptorium feeds every branch — otherwise Doctrine could never be researched', () => {
    const pools = studyPerDay([b('s', 'SCRIPTORIUM')])
    for (const br of BRANCHES) expect(pools[br]).toBeGreaterThan(0)
  })

  it('a lone Scriptorium is SLOWER than the old day clock, at every level', () => {
    // The old speed has to be bought with production. If a maxed Scriptorium reached the
    // baseline on its own, the Research% slider would be a bonus rather than a decision.
    for (const level of [1, 2, 3]) {
      expect(scriptoriumStudy(level)).toBeLessThan(DEFAULT_STUDY.baselinePerDay)
    }
    expect(scriptoriumStudy(3)).toBeGreaterThan(scriptoriumStudy(1))
  })

  it('a diverted workshop pays into ITS branch, not another', () => {
    const pools = studyPerDay([b('m', 'LUMBER_MILL'), b('f', 'BLACKSMITH')], { m: 5000, f: 5000 })
    expect(pools.ECONOMY).toBe(studyFromValue(5000))
    expect(pools.ARMY).toBe(studyFromValue(5000))
    expect(pools.CAMPAIGN).toBe(0)
  })

  it('a building with no branch cannot study at all', () => {
    expect(branchOfBuilding('MARKET')).toBeNull()
    expect(studyPerDay([b('k', 'MARKET')], { k: 100_000 }).ECONOMY).toBe(0)
  })

  it('reads the admin rate, not a hardcoded one', () => {
    const base = studyPerDay([b('m', 'LUMBER_MILL')], { m: 1000 }).ECONOMY
    GameConfig.init({ study: { copperPerStudy: 10 } })
    expect(studyPerDay([b('m', 'LUMBER_MILL')], { m: 1000 }).ECONOMY).toBeGreaterThan(base)
  })
})

describe('the bank', () => {
  it('accumulates so you can prepare before you can afford the tech', () => {
    const after = addStudy(emptyPools(), { ECONOMY: 30, ARMY: 0, CAMPAIGN: 0, UNLOCKS: 0 })
    expect(after.ECONOMY).toBe(30)
  })

  it('is capped, so a branch cannot bank forever while nothing runs', () => {
    const cap = DEFAULT_STUDY.poolCap
    const full = addStudy({ ...emptyPools(), ECONOMY: cap }, { ECONOMY: 500, ARMY: 0, CAMPAIGN: 0, UNLOCKS: 0 })
    expect(full.ECONOMY).toBe(cap)
  })
})

describe('spending', () => {
  it('a project draws only from its own branch', () => {
    const pools = { ...emptyPools(), ECONOMY: 100 }
    const r = spendStudy(pools, [{ id: 'a', branch: 'ARMY', studyRemaining: 50 }])
    expect(r.applied.a).toBeUndefined()
    expect(r.pools.ECONOMY).toBe(100)
  })

  it('never spends more than the project still needs', () => {
    const pools = { ...emptyPools(), ECONOMY: 100 }
    const r = spendStudy(pools, [{ id: 'a', branch: 'ECONOMY', studyRemaining: 30 }])
    expect(r.applied.a).toBe(30)
    expect(r.pools.ECONOMY).toBe(70)
  })

  it('two projects in one branch SHARE the day, they do not each get it', () => {
    // The queue has no length cap: without sharing, starting every tech would advance them
    // all at full rate for free.
    const pools = { ...emptyPools(), ECONOMY: 50 }
    const r = spendStudy(pools, [
      { id: 'a', branch: 'ECONOMY', studyRemaining: 40 },
      { id: 'b', branch: 'ECONOMY', studyRemaining: 40 },
    ])
    expect(r.applied.a).toBe(40)
    expect(r.applied.b).toBe(10)
    expect(r.pools.ECONOMY).toBe(0)
  })

  it('reports no ETA when nothing is coming in, rather than Infinity days', () => {
    expect(daysAtRate(100, 0)).toBeNull()
    expect(daysAtRate(100, 25)).toBe(4)
  })
})

describe('save migration — the trap that loses state silently', () => {
  it('carries an in-flight day-countdown project over WITHOUT losing progress', () => {
    const tech = DEFAULT_TECHS[0]
    const r = hydrateResearch({
      unlocked: [], buffs: [],
      queue: [{ id: tech.id, name: tech.name, daysRemaining: 2 }],
    })
    const p = r.queue[0]
    expect(p.studyTotal).toBe(studyCostOf(tech))
    // 2 of 3 days left ⇒ two thirds of the cost left.
    expect(p.studyRemaining).toBe(Math.round(studyCostOf(tech) * (2 / tech.days)))
    expect(p.branch).toBe(tech.branch)
  })

  it('SURVIVES a round trip through the save — pools are not dropped', () => {
    // hydrateResearch enumerates its fields, so a field written to localStorage but missing
    // there vanishes on reload with no error. This is that guard.
    const state = { ...emptyResearch(), pools: { ECONOMY: 120, ARMY: 5, CAMPAIGN: 0, UNLOCKS: 3 } }
    const round = hydrateResearch(JSON.parse(JSON.stringify(state)))
    expect(round.pools).toEqual(state.pools)
  })

  it('a save with no pools at all loads as empty rather than undefined', () => {
    const r = hydrateResearch({ unlocked: ['X'], queue: [], buffs: [] })
    expect(r.pools).toEqual(emptyPools())
  })

  it('drops a garbage queue entry instead of crashing the load', () => {
    const r = hydrateResearch({ unlocked: [], buffs: [], queue: [null, { name: 'no id' }, 7] })
    expect(r.queue).toEqual([])
  })
})

describe('the economy day is where Study is actually produced', () => {
  const day = (buildings: Building[]) => simulateEconomyDay({
    buildings,
    resources: Object.fromEntries(ResourceTypes.map((r) => [r, 10_000])) as never,
    inv: makeEmptyInventories(),
    units: [],
  })

  it('a building with no research focus behaves EXACTLY as before', () => {
    // The whole point of taking research off the top rather than making the slider
    // three-way: every existing save must be untouched.
    const plain = day([b('m', 'LUMBER_MILL')])
    const explicitZero = day([withResearch(b('m', 'LUMBER_MILL'), 0)])
    expect(explicitZero.breakdown[0]).toEqual(plain.breakdown[0])
    expect(explicitZero.incomeWalletDelta).toBe(plain.incomeWalletDelta)
    expect(plain.studyByBranch).toEqual(emptyPools())
  })

  it('diverting output produces Study and costs exactly that much coin', () => {
    const full = day([b('m', 'LUMBER_MILL')])
    const half = day([withResearch(b('m', 'LUMBER_MILL'), 40)])
    const lost = full.incomeWalletDelta - half.incomeWalletDelta
    expect(lost).toBeGreaterThan(0)
    expect(half.studyByBranch.ECONOMY).toBeCloseTo(studyFromValue(lost), 2)
  })

  it('a Scriptorium produces Study without touching the copper economy', () => {
    const d = day([b('s', 'SCRIPTORIUM')])
    expect(d.incomeWalletDelta).toBe(0)
    expect(d.breakdown[0].skipped).toBe(true)
    expect(d.studyByBranch.UNLOCKS).toBeGreaterThan(0)
  })

  it('the study a day reports is the study the forecast shows', () => {
    const buildings = [b('s', 'SCRIPTORIUM'), withResearch(b('m', 'LUMBER_MILL'), 60)]
    const d = day(buildings)
    expect(d.studyByBranch).toEqual(studyPerDay(buildings, { m: d.breakdown[1].researchValue }))
  })
})
