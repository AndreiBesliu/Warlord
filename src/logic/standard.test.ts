import { describe, it, expect } from 'vitest'
import {
  describeLoss, isStandardLost, standardBlocker, standardFalls, standardRecovered,
} from './standard'
import { channelsOf, legionChannelsByUnit, type TraditionDesign } from './tradition'
import { hydrateLegions } from '../state/useLegions'
import type { SoldierType, Unit } from './types'

const unit = (id: string, type: SoldierType = 'HEAVY_INF_SWORD'): Unit => ({
  id, type, buckets: [{ r: 'NOVICE', count: 20, avgXP: 0 }], avgXP: 0, training: false, morale: 100,
  equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
})

const design = (): TraditionDesign => ({
  v: 1, name: 'The Unmoved', creed: 'They hold.', sworeDay: 3,
  constraints: [{ kind: 'DENY', cls: 'MOUNTED' }],
  nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 2 }],
})

describe('the eagle falls only on a total wipe', () => {
  it('falls when every cohort that marched is destroyed', () => {
    expect(standardFalls(['a', 'b'], new Set(['a', 'b']))).toBe(true)
  })

  it('holds while one cohort comes back — that is the fiction and the mechanic at once', () => {
    expect(standardFalls(['a', 'b'], new Set(['a']))).toBe(false)
  })

  it('a legion that put nothing in the line cannot lose anything', () => {
    // `every` over an empty list is vacuously true, which would take the eagle from a
    // legion that never left camp. The empty case is answered explicitly.
    expect(standardFalls([], new Set(['a']))).toBe(false)
    expect(standardFalls([], new Set())).toBe(false)
  })

  it('a snapshot naming a cohort twice does not change the verdict', () => {
    expect(standardFalls(['a', 'a'], new Set(['a']))).toBe(true)
    expect(standardFalls(['a', 'a', 'b'], new Set(['a']))).toBe(false)
  })
})

describe('winning it back', () => {
  const lost = { lostTo: 'RIVAL_BARON' as const, lostDay: 12 }

  it('comes home on a victory at the mission that took it', () => {
    expect(standardRecovered(lost, true, 'RIVAL_BARON', ['a'])).toBe(true)
  })

  it('not on a defeat there', () => {
    expect(standardRecovered(lost, false, 'RIVAL_BARON', ['a'])).toBe(false)
  })

  it('not on a victory somewhere else — it is where the eagle IS that matters', () => {
    expect(standardRecovered(lost, true, 'BANDIT_RAID', ['a'])).toBe(false)
    expect(standardRecovered(lost, true, 'INVASION', ['a'])).toBe(false)
  })

  it('not for a legion that did not march', () => {
    expect(standardRecovered(lost, true, 'RIVAL_BARON', [])).toBe(false)
  })

  it('a legion that never lost one has nothing to win back', () => {
    expect(standardRecovered(null, true, 'RIVAL_BARON', ['a'])).toBe(false)
    expect(standardRecovered(undefined, true, 'RIVAL_BARON', ['a'])).toBe(false)
  })

  it('there is nothing to farm here: losing costs a whole deployment, winning returns what you had', () => {
    // Stated as a test because it is the reason this feature needs no cap, no cooldown and
    // no counter — the loop has no profitable direction.
    expect(standardFalls(['a', 'b', 'c'], new Set(['a', 'b', 'c']))).toBe(true)
    expect(standardRecovered({ lostTo: 'BANDIT_RAID', lostDay: 1 }, true, 'BANDIT_RAID', ['a'])).toBe(true)
  })
})

describe('while it is gone, the tradition sleeps', () => {
  it('a legion without its eagle is owed nothing', () => {
    const held = legionChannelsByUnit([{ unitIds: ['a'], tradition: design() }], [unit('a')])
    expect(held.size).toBe(1)
    const taken = legionChannelsByUnit(
      [{ unitIds: ['a'], tradition: design(), standardLost: true }], [unit('a')])
    expect(taken.size).toBe(0)
  })

  it('but the tradition itself is untouched — dormant, not revoked', () => {
    // A legion does not stop being what it swore because it was beaten.
    expect(channelsOf(design()).victoryStipend).toBeGreaterThan(0)
  })

  it('nothing about a tradition may move while the eagle is held', () => {
    const why = standardBlocker({ lostTo: 'INVASION', lostDay: 4 }, 'The Wall', 'Invasion')
    expect(why).toContain('The Wall')
    expect(why).toContain('Invasion')
    expect(standardBlocker(null, 'The Wall', 'Invasion')).toBeNull()
  })

  it('says where it is and what it costs, in one sentence', () => {
    const line = describeLoss({ lostTo: 'RIVAL_BARON', lostDay: 12 }, 'Rival Baron')
    expect(line).toContain('Rival Baron')
    expect(line).toContain('day 12')
    expect(line).toMatch(/sleeps/)
  })
})

describe('what a save may carry', () => {
  it('a save from before standards existed loads holding its own', () => {
    const [l] = hydrateLegions([{ id: 'L1', name: 'Old', foundedDay: 1, unitIds: [], honours: [] }])
    expect(l.standard).toBeNull()
    expect(isStandardLost(l.standard)).toBe(false)
  })

  it('a mission the game no longer has does not strand a legion forever', () => {
    // Otherwise the eagle would sit at a field that cannot be fought, and the tradition
    // would sleep for good with no way back.
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      standard: { lostTo: 'SIEGE_OF_NOWHERE', lostDay: 3 },
    }])
    expect(l.standard).toBeNull()
  })

  it('a real loss survives the round trip', () => {
    const [l] = hydrateLegions(JSON.parse(JSON.stringify([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      standard: { lostTo: 'INVASION', lostDay: 42 },
    }])))
    expect(l.standard).toEqual({ lostTo: 'INVASION', lostDay: 42 })
  })

  it('a garbled day reads as zero rather than NaN', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      standard: { lostTo: 'INVASION', lostDay: 'ages ago' },
    }])
    expect(l.standard?.lostDay).toBe(0)
  })
})
