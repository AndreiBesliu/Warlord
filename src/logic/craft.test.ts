import { describe, it, expect, beforeEach } from 'vitest'
import {
  availableCraftPoints, channelsOf, contextFor, craftBlocker, craftChannelsFor, craftFaults,
  outOfKeeping, sharesOf, spentPoints, standingOf, validateDesign, type CraftDesign,
} from './craft'
import { CRAFT_FLOOR, clampCraftChannels, isMonotone, isProportional, type CraftDemand } from './craftPalette'
import { CRAFT_CHANNEL_CAP, GameConfig } from './config'
import { emptyRecord, hydratePopulation, type PopulationState } from './population'
import { simulateEconomyDay } from './economy'
import { makeEmptyInventories } from './helpers'
import { Registry } from './registry'
import type { Building, ResourceMap } from './types'

Registry.init()
beforeEach(() => GameConfig.init(null))

const res = (over: Partial<ResourceMap> = {}): ResourceMap => ({
  WOOD: 0, STONE: 0, IRON_ORE: 0, COAL: 0, COPPER_ORE: 0, SILVER_ORE: 0,
  IRON_INGOT: 0, COPPER_INGOT: 0, SILVER_INGOT: 0, FOOD: 0, ...over,
})

const smelter = (over: Partial<Building> = {}): Building =>
  ({ id: 'S', type: 'SMELTER', focusCoinPct: 100, fractionalBuffer: 0, level: 1, ...over })

const design = (over: Partial<CraftDesign> = {}): CraftDesign => ({
  v: 1, name: 'Iron Hearth', creed: 'It sells what it smelts.', sworeDay: 3,
  demands: [{ kind: 'CAP_STUDY', pct: 0 }, { kind: 'MIN_HANDS', hands: 8 }],
  nodes: [{ id: 'n0', parent: null, prim: 'COINWISE', steps: 1 }],
  ...over,
})

const pop = (over: Partial<PopulationState> = {}): PopulationState => ({
  souls: 200, at: { S: 12 }, work: {}, record: {}, craft: {}, kept: {}, sworn: {}, ...over,
})

const swornPop = (d: CraftDesign = design(), at = 12): PopulationState =>
  pop({ at: { S: at }, craft: { S: d } })

const ctxOf = (b = smelter(), p = pop()) => contextFor(b, p, false)

const day = (over: Partial<Parameters<typeof simulateEconomyDay>[0]> = {}) =>
  simulateEconomyDay({ buildings: [], resources: res(), inv: makeEmptyInventories(), units: [], ...over })

describe('a craft is what a house gives up — points come only from demands', () => {
  it('the budget IS the rebate, so there is no free wallet anywhere', () => {
    expect(availableCraftPoints(design(), ctxOf())).toBe(8)
    expect(spentPoints(design())).toBe(2)
  })

  it('a craft that buys more than it gives up is refused', () => {
    const greedy = design({
      nodes: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, parent: null, prim: 'COINWISE', steps: 4 })),
    })
    const check = validateDesign(greedy, ctxOf())
    expect(check.ok).toBe(false)
    expect(check.reasons.join(' ')).toMatch(/every point comes from a demand/)
  })

  it('and one that gives up nothing at all is refused before it can be sworn', () => {
    expect(validateDesign(design({ demands: [] }), ctxOf()).reasons.join(' ')).toMatch(/at least one demand/)
  })
})

describe('the two kinds of demand, and why they are enforced in different places', () => {
  it('the kind is DERIVED, never a flag that could be set wrong', () => {
    expect(isMonotone({ kind: 'CAP_COIN', pct: 20 })).toBe(true)
    expect(isMonotone({ kind: 'MIN_HANDS', hands: 8 })).toBe(false)
    expect(isProportional({ kind: 'MIN_HANDS', hands: 8 })).toBe(true)
  })

  it('a monotone demand refuses AT the control, before the move is made', () => {
    const p = swornPop(design({ demands: [{ kind: 'CAP_STUDY', pct: 20 }, { kind: 'MIN_HANDS', hands: 8 }] }))
    expect(craftBlocker(p.craft!.S, { b: smelter(), studyPct: 40 }, p, false)).toMatch(/study at or under 20%/)
    expect(craftBlocker(p.craft!.S, { b: smelter(), studyPct: 20 }, p, false)).toBeNull()
  })

  it('a proportional demand refuses NOTHING — it only puts the craft to sleep', () => {
    const p = swornPop()
    expect(craftBlocker(p.craft!.S, { b: smelter(), hands: 2 }, p, false)).toBeNull()
    expect(outOfKeeping(p.craft!.S, smelter(), { ...p, at: { S: 2 } }, [smelter()], false))
      .toMatch(/it asks for 8 hands and has 2/)
  })

  it('and a monotone one is checked AGAIN in the day, because a save can arrive over the line', () => {
    const p = swornPop(design({ demands: [{ kind: 'CAP_STUDY', pct: 20 }, { kind: 'MIN_HANDS', hands: 8 }] }))
    const over = smelter({ focusResearchPct: 60 })
    expect(outOfKeeping(p.craft!.S, over, p, [over], false)).toMatch(/study at or under 20%/)
  })
})

describe('a demand that demands nothing buys points for free', () => {
  const bad = (d: CraftDemand) =>
    validateDesign(design({ demands: [d, { kind: 'MIN_HANDS', hands: 8 }] }), ctxOf()).reasons.join(' ')

  it('a coin cap above the floor refuses nothing', () => {
    expect(bad({ kind: 'CAP_COIN', pct: CRAFT_FLOOR.capCoinMaxPct })).toMatch(/refuses nothing/)
  })

  it('a goods floor below the floor refuses nothing', () => {
    expect(bad({ kind: 'MIN_GOODS', pct: 0 })).toMatch(/refuses nothing/)
  })

  it('a hand cap at or above the crew refuses nothing', () => {
    expect(bad({ kind: 'MAX_HANDS', hands: 12 })).toMatch(/refuses nothing/)
  })

  it('AND A HAND FLOOR AT OR UNDER HALF promises what the game already demands', () => {
    // `creditsADayOfWork` already requires half the crew for a day to count at all, so a
    // MIN_HANDS at six would be a rebate for a promise the game was making for you.
    const check = validateDesign(
      design({ demands: [{ kind: 'MIN_HANDS', hands: 6 }, { kind: 'CAP_STUDY', pct: 0 }] }), ctxOf(),
    )
    expect(check.reasons.join(' ')).toMatch(/already needs half the crew/)
  })

  it('a house whose whole day is coin cannot promise to cap its coin', () => {
    const check = validateDesign(
      design({ demands: [{ kind: 'CAP_COIN', pct: 20 }, { kind: 'MIN_HANDS', hands: 9 }] }),
      contextFor(smelter({ type: 'MINTER' }), pop(), true),
    )
    expect(check.reasons.join(' ')).toMatch(/whole day is coin/)
  })
})

describe('a craft must refuse something AND cost something', () => {
  it('with nothing monotone it refuses no act', () => {
    expect(validateDesign(design({ demands: [{ kind: 'MIN_HANDS', hands: 8 }] }), ctxOf()).reasons.join(' '))
      .toMatch(/must REFUSE something/)
  })

  it('with nothing proportional it costs nothing on any given day', () => {
    expect(validateDesign(design({ demands: [{ kind: 'CAP_STUDY', pct: 0 }] }), ctxOf()).reasons.join(' '))
      .toMatch(/must COST something every day/)
  })

  it('a craft sworn while already breaking it is not a promise', () => {
    const check = validateDesign(
      design({ demands: [{ kind: 'CAP_STUDY', pct: 0 }, { kind: 'MIN_HANDS', hands: 8 }] }),
      ctxOf(smelter({ focusResearchPct: 40 })),
    )
    expect(check.reasons.join(' ')).toMatch(/not in keeping now/)
  })
})

describe('what it is worth, and what it can never be worth', () => {
  it('nothing at all while it is out of keeping', () => {
    expect(craftChannelsFor(smelter(), { ...swornPop(), at: { S: 2 } }, [smelter()], false).coinMult).toBe(1)
  })

  it('and it scales with the crew, so an empty house earns an empty bonus', () => {
    const d = design({ demands: [{ kind: 'CAP_STUDY', pct: 0 }, { kind: 'MIN_HANDS', hands: 7 }] })
    const full = craftChannelsFor(smelter(), swornPop(d, 12), [smelter()], false).coinMult
    const half = craftChannelsFor(smelter(), swornPop(d, 7), [smelter()], false).coinMult
    expect(full).toBeGreaterThan(half)
    expect(half).toBeGreaterThan(1)
  })

  it('THE CEILING IS ON THE SUM, so no config value gets past it', () => {
    GameConfig.init({ craftPrims: { COINWISE: { step: 99 } } })
    expect(channelsOf(design()).coinMult).toBe(CRAFT_CHANNEL_CAP.coinMult)
    expect(clampCraftChannels({ coinMult: 99 }).coinMult).toBe(CRAFT_CHANNEL_CAP.coinMult)
  })

  it('a step of zero is a piece that costs points and does nothing — the config refuses it', () => {
    GameConfig.init({ craftPrims: { COINWISE: { step: 0 } } })
    expect(channelsOf(design()).coinMult).toBeGreaterThan(1)
  })
})

describe('the day pays the craft, and only for a day actually kept', () => {
  it('a kept day is credited, and it is worth more coin than the same day unsworn', () => {
    const b = smelter()
    const bare = day({ buildings: [b], population: pop() })
    const withCraft = day({ buildings: [b], population: swornPop() })
    expect(withCraft.breakdown[0].coinGain).toBeGreaterThan(bare.breakdown[0].coinGain)
    expect(withCraft.craftKeptIds).toEqual(['S'])
  })

  it('a broken oath pays nothing AND credits nothing, in the same day', () => {
    const b = smelter()
    const bare = day({ buildings: [b], population: pop({ at: { S: 2 } }) })
    const broken = day({ buildings: [b], population: { ...swornPop(), at: { S: 2 } } })
    expect(broken.breakdown[0].coinGain).toBe(bare.breakdown[0].coinGain)
    expect(broken.craftKeptIds).toEqual([])
  })

  it('A HOUSE SWORN AND LEFT IDLE CLIMBS NOTHING — keeping is not the passage of time', () => {
    // Without this, a sworn house that deliberately does no work rises at exactly the rate of
    // one that works, and "it stops the moment you stop paying for it" is false.
    const idle = smelter({ focusCoinPct: 0, outputItem: 'IRON_INGOT' }) // no ore, so no coin
    const d = day({ buildings: [idle], population: swornPop() })
    expect(d.breakdown[0].coinGain).toBe(0)
    expect(d.craftKeptIds).toEqual([])
  })

  it('a house with no oath is exactly today', () => {
    expect(day({ buildings: [smelter()], population: pop() }).craftKeptIds).toEqual([])
    expect(day({ buildings: [smelter()] }).craftKeptIds).toEqual([])
  })
})

describe('a piece this build no longer knows FAULTS the whole design', () => {
  it('rather than being skipped, which would refill the wallet', () => {
    // A skipped node prices at 0, so `spentPoints` would FALL and the budget would look as
    // though it had room again — a point fountain, opened by a build downgrade.
    const alien = design({ nodes: [{ id: 'n0', parent: null, prim: 'FROM_THE_FUTURE', steps: 3 }] })
    expect(craftFaults(alien)).toMatch(/does not know/)
    expect(craftChannelsFor(smelter(), swornPop(alien), [smelter()], false).coinMult).toBe(1)
  })

  it('a demand it does not know faults it too', () => {
    expect(craftFaults(design({ demands: [{ kind: 'FROM_THE_FUTURE' } as unknown as CraftDemand] })))
      .toMatch(/does not know/)
  })

  it('and a faulted craft refuses nothing at any control — it is simply not in force', () => {
    const alien = design({ nodes: [{ id: 'n0', parent: null, prim: 'NOPE', steps: 1 }] })
    expect(craftBlocker(alien, { b: smelter(), studyPct: 100 }, swornPop(alien), false)).toBeNull()
  })
})

describe('the proof reads the delta since the oath, never the total', () => {
  it('so a domain on day 300 does not qualify for everything the moment it swears', () => {
    const since = { ...emptyRecord(), days: 10, coinVal: 900, goodsVal: 100, daysFull: 6, daysLean: 2 }
    const sh = sharesOf(since)
    expect(sh.coinShare).toBe(90)
    expect(sh.fullShare).toBe(60)
    expect(sh.leanShare).toBe(20)
  })

  it('and shares of nothing are zero rather than NaN', () => {
    expect(sharesOf(emptyRecord())).toEqual({ coinShare: 0, fullShare: 0, leanShare: 0, days: 0 })
  })
})

describe('what a save may carry', () => {
  it('an oath survives the round trip', () => {
    const p = hydratePopulation(JSON.parse(JSON.stringify({ population: swornPop() })))
    expect(p.craft!.S.name).toBe('Iron Hearth')
    expect(p.craft!.S.nodes).toEqual([{ id: 'n0', parent: null, prim: 'COINWISE', steps: 1 }])
  })

  it('AN UNKNOWN PIECE IS KEPT, not dropped', () => {
    // Dropping it would make the oath silently cheaper, and would lose the house's craft for
    // good if the piece ever came back. This is the opposite of what a tradition does with an
    // id it cannot read, and the difference is exactly why `craftFaults` exists.
    const p = hydratePopulation({
      population: {
        ...swornPop(),
        craft: { S: { ...design(), nodes: [{ id: 'n0', parent: null, prim: 'ALIEN', steps: 2 }] } },
      },
    })
    expect(p.craft!.S.nodes[0].prim).toBe('ALIEN')
    expect(craftFaults(p.craft!.S)).toBeTruthy()
  })

  it('a nameless oath is no oath, and garbage cannot inflate one', () => {
    const p = hydratePopulation({
      population: {
        souls: 10, at: {},
        craft: {
          A: { ...design(), name: '   ' },
          B: { ...design(), nodes: [{ id: 'n', parent: 5, prim: 'COINWISE', steps: 1e9 }] },
        },
      },
    })
    expect(p.craft!.A).toBeUndefined()
    expect(p.craft!.B.nodes[0].parent).toBeNull()
    expect(p.craft!.B.nodes[0].steps).toBe(99)
  })

  it('the days kept survive, and a save from before oaths existed reads as none', () => {
    expect(standingOf(hydratePopulation({ population: { souls: 1, at: {}, kept: { S: 14 } } }), smelter())).toBe(14)
    expect(standingOf(hydratePopulation(null), smelter())).toBe(0)
  })
})
