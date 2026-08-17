import { describe, it, expect, beforeEach } from 'vitest'
import {
  COMMANDER_MAX_RANK, TRAITS, appointBlocker, commanderChannels, commanderFalls, commanderRank,
  describeTrait, traitById, traitFor, transferBlocker, type Commander,
} from './commander'
import { GameConfig } from './config'
import { CHANNEL_CAP, NO_CHANNELS } from './traditionPalette'
import { legionChannelsByUnit, type TraditionDesign } from './tradition'
import { hydrateLegions } from '../state/useLegions'
import type { DeedLedger } from './practice'
import type { SoldierType, Unit } from './types'

beforeEach(() => GameConfig.init(null))

const man = (over: Partial<Commander> = {}): Commander =>
  ({ name: 'Aulus', trait: 'VICTOR', appointedDay: 3, battles: 0, ...over })

const unit = (id: string, type: SoldierType = 'HEAVY_INF_SWORD'): Unit => ({
  id, type, buckets: [{ r: 'NOVICE', count: 20, avgXP: 0 }], avgXP: 0, training: false, morale: 100,
  equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
})

describe('the army makes the man', () => {
  it('a legion that spent its life on walls raises a warden', () => {
    expect(traitFor({ daysGarrisoned: 300, victories: 2 }).id).toBe('WARDEN')
  })

  it('one that ground out bloody wins raises somebody who does not flinch', () => {
    expect(traitFor({ heldTheLine: 9, daysGarrisoned: 20 }).id).toBe('STUBBORN')
  })

  it('one that has mostly lost raises a survivor', () => {
    expect(traitFor({ defeats: 12, victories: 3 }).id).toBe('SURVIVOR')
  })

  it('a legion with no record at all raises somebody with no stories', () => {
    expect(traitFor({}).id).toBe('STEADY')
    expect(traitFor({ battles: 40 }).id).toBe('STEADY')
  })

  it('days count for less than deeds, or every commander would be a warden by month two', () => {
    // A hundred days on a wall is a career; a hundred victories is not a thing that
    // happens. Without the weighting the day counters would swamp everything.
    expect(traitFor({ daysGarrisoned: 60, victories: 12 }).id).toBe('VICTOR')
    expect(traitFor({ daysGarrisoned: 200, victories: 12 }).id).toBe('WARDEN')
  })

  it('the same record always raises the same man', () => {
    // The list order is the tie-break, so this cannot depend on enumeration order.
    const record: DeedLedger = { victories: 10, defeats: 10 }
    const first = traitFor(record).id
    for (let i = 0; i < 20; i++) expect(traitFor({ ...record }).id).toBe(first)
  })

  it('every trait is reachable from some record — none is decoration', () => {
    const reachable = new Set(TRAITS.filter((t) => t.from).map((t) => traitFor({ [t.from!]: 10_000 }).id))
    for (const t of TRAITS) if (t.from) expect(reachable.has(t.id)).toBe(true)
  })
})

describe('rank is the only thing about him that grows', () => {
  it('starts at one and rises with battles commanded', () => {
    expect(commanderRank(man({ battles: 0 }))).toBe(1)
    expect(commanderRank(man({ battles: 4 }))).toBe(2)
    expect(commanderRank(man({ battles: 8 }))).toBe(3)
  })

  it('is bounded, so a long career is not an unbounded one', () => {
    expect(commanderRank(man({ battles: 10_000 }))).toBe(COMMANDER_MAX_RANK)
  })

  it('nobody is nothing', () => {
    expect(commanderRank(null)).toBe(0)
    expect(commanderChannels(null)).toEqual(NO_CHANNELS)
  })

  it('a trait the game no longer has is worth nothing rather than crashing', () => {
    expect(commanderChannels({ ...man(), trait: 'SORCERER' as never })).toEqual(NO_CHANNELS)
  })

  it('what he is worth grows with him', () => {
    const green = commanderChannels(man({ trait: 'VICTOR', battles: 0 }))
    const grey = commanderChannels(man({ trait: 'VICTOR', battles: 16 }))
    expect(grey.victoryStipend).toBeGreaterThan(green.victoryStipend)
  })

  it('an admin cannot hand out the ceiling on day one', () => {
    GameConfig.init({ commander: { battlesPerRank: 0 } })
    expect(commanderRank(man({ battles: 0 }))).toBe(1)
  })

  it('says what he is worth in the words the rest of the screen uses', () => {
    expect(describeTrait(man({ trait: 'VICTOR', battles: 0 }))).toMatch(/on every victory/)
    expect(describeTrait(man({ trait: 'STUBBORN' }))).toMatch(/morale/)
  })
})

describe('he is mortal, and deterministically so', () => {
  // A battle in this game replays exactly from its seed. A die roll here would be the one
  // part of a resolved battle that could not be replayed.
  it('falls on a defeat that cost more than half the legion', () => {
    expect(commanderFalls(man(), false, 100, 51)).toBe(true)
  })

  it('survives a defeat that did not', () => {
    expect(commanderFalls(man(), false, 100, 50)).toBe(false)
    expect(commanderFalls(man(), false, 100, 10)).toBe(false)
  })

  it('never falls in a victory, however bloody', () => {
    expect(commanderFalls(man(), true, 100, 99)).toBe(false)
  })

  it('a legion that fielded nobody cannot lose him', () => {
    expect(commanderFalls(man(), false, 0, 0)).toBe(false)
  })

  it('nobody to lose', () => {
    expect(commanderFalls(null, false, 100, 100)).toBe(false)
  })

  it('an admin can make him harder to kill but never immortal', () => {
    GameConfig.init({ commander: { fallsAboveLossPct: 100 } })
    expect(commanderFalls(man(), false, 100, 100)).toBe(false)
    expect(commanderFalls(man(), false, 100, 101)).toBe(true)
  })
})

describe('raising and moving one', () => {
  const legion = (over: Record<string, unknown> = {}) =>
    ({ id: 'L1', name: 'The First Host', commander: null, practice: { battles: 9 }, ...over }) as never

  it('a legion raises its OWN — it needs a history first', () => {
    expect(appointBlocker(legion({ practice: { battles: 2 } }), 3, 1e6)).toMatch(/5 battles behind it, has 2/)
    expect(appointBlocker(legion(), 3, 1e6)).toBeNull()
  })

  it('refuses without the copper, and without anybody to command', () => {
    expect(appointBlocker(legion(), 3, 10)).toMatch(/Costs/)
    expect(appointBlocker(legion(), 0, 1e6)).toMatch(/nobody to command/)
  })

  it('one at a time', () => {
    expect(appointBlocker(legion({ commander: man() }), 3, 1e6)).toMatch(/already has a commander/)
  })

  it('moving him is the whole point — a tradition cannot move and he can', () => {
    const from = { id: 'A', commander: man() }
    const to = { id: 'B', commander: null, name: 'The Second Host' }
    expect(transferBlocker(from, to, 3)).toBeNull()
  })

  it('refuses the moves that make no sense, each in its own words', () => {
    const from = { id: 'A', commander: man() }
    expect(transferBlocker({ id: 'A', commander: null }, { id: 'B', commander: null, name: 'X' }, 3))
      .toMatch(/nobody to move/)
    expect(transferBlocker(from, { id: 'A', commander: null, name: 'X' }, 3)).toMatch(/already there/)
    expect(transferBlocker(from, { id: 'B', commander: man(), name: 'X' }, 3)).toMatch(/already has a commander/)
    expect(transferBlocker(from, { id: 'B', commander: null, name: 'X' }, 0)).toMatch(/no cohorts/)
  })
})

describe('he answers to nobody’s oath', () => {
  const design = (): TraditionDesign => ({
    v: 1, name: 'The Unmoved', creed: 'They hold.', sworeDay: 3,
    constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MIN_COHORTS', n: 8 }],
    nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 2 }],
  })

  it('is worth something even when the tradition sleeps for want of an eagle', () => {
    // That is exactly what makes him the piece you reach for when everything else has gone
    // wrong — a tradition is dormant, a man is not.
    const map = legionChannelsByUnit([{
      unitIds: ['a'], tradition: design(), standardLost: true,
      commander: commanderChannels(man({ trait: 'STUBBORN', battles: 8 })),
    }], [unit('a')])
    expect(map.get('a')!.moraleFloor).toBeGreaterThan(0)
    // …and the sleeping tradition contributed nothing.
    expect(map.get('a')!.victoryStipend).toBe(0)
  })

  it('and when it is out of keeping', () => {
    const map = legionChannelsByUnit([{
      unitIds: ['a'], tradition: design(),
      commander: commanderChannels(man({ trait: 'STUBBORN' })),
    }], [unit('a')])
    expect(map.get('a')!.moraleFloor).toBeGreaterThan(0)
    expect(map.get('a')!.victoryStipend).toBe(0)
  })

  it('stacked on a tradition, the SUM is what gets clamped', () => {
    // A commander on top of a tradition must not slip past a ceiling either respects alone.
    const heavy: TraditionDesign = {
      ...design(), constraints: [{ kind: 'DENY', cls: 'MOUNTED' }],
      nodes: [{ id: 'n0', parent: null, prim: 'UNBROKEN', steps: 4 },
        { id: 'n1', parent: null, prim: 'STEADFAST', steps: 3 },
        { id: 'n2', parent: null, prim: 'SHAFTBREAKERS', steps: 3 }],
    }
    const map = legionChannelsByUnit([{
      unitIds: ['a'], tradition: heavy,
      commander: commanderChannels(man({ trait: 'STUBBORN', battles: 99 })),
    }], [unit('a')])
    expect(map.get('a')!.moraleFloor).toBe(CHANNEL_CAP.moraleFloor)
  })

  it('a legion with no cohorts is owed nothing, commander or not', () => {
    const map = legionChannelsByUnit([{
      unitIds: [], tradition: design(), commander: commanderChannels(man()),
    }], [])
    expect(map.size).toBe(0)
  })
})

describe('what a save may carry', () => {
  it('a save from before commanders existed loads without one', () => {
    const [l] = hydrateLegions([{ id: 'L1', name: 'Old', foundedDay: 1, unitIds: [], honours: [] }])
    expect(l.commander).toBeNull()
  })

  it('a trait the game no longer has reads as no commander', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      commander: { name: 'Aulus', trait: 'SORCERER', appointedDay: 2, battles: 4 },
    }])
    expect(l.commander).toBeNull()
  })

  it('a real commander survives the round trip', () => {
    const [l] = hydrateLegions(JSON.parse(JSON.stringify([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      commander: man({ name: 'Marcus', trait: 'WARDEN', battles: 7, appointedDay: 20 }),
    }])))
    expect(l.commander).toEqual({ name: 'Marcus', trait: 'WARDEN', battles: 7, appointedDay: 20 })
  })

  it('his name goes through the same sanitiser as every other authored one', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      commander: { name: '⚠ Aulus ', trait: 'VICTOR', appointedDay: 1, battles: 0 },
    }])
    expect(l.commander?.name).toBe('Aulus')
  })

  it('a nameless commander is no commander', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      commander: { name: '   ', trait: 'VICTOR', appointedDay: 1, battles: 0 },
    }])
    expect(l.commander).toBeNull()
  })
})
