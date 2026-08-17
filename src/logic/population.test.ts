import { describe, it, expect, beforeEach } from 'vitest'
import {
  CREW_SIZE, STARTING_SOULS, assignBlocker, crewSizeOf, emptyPopulation, growthFromHarvest,
  handsAt, hydratePopulation, idleHands, levyBlocker, staffMultOf, totalCrewPosts,
  type PopulationState,
} from './population'
import { POP_MAX_CREW, POP_MAX_STAFF_BONUS, GameConfig } from './config'
import { simulateEconomyDay } from './economy'
import { checkRecruit } from './barracks'
import { forecastDay } from './forecast'
import { makeEmptyInventories } from './helpers'
import { Registry } from './registry'
import type { Building, ResourceMap } from './types'

Registry.init()
beforeEach(() => GameConfig.init(null))

const res = (over: Partial<ResourceMap> = {}): ResourceMap => ({
  WOOD: 0, STONE: 0, IRON_ORE: 0, COAL: 0, COPPER_ORE: 0, SILVER_ORE: 0,
  IRON_INGOT: 0, COPPER_INGOT: 0, SILVER_INGOT: 0, FOOD: 0, ...over,
})

const build = (type: Building['type'], focusCoinPct: Building['focusCoinPct'] = 100, id = type): Building =>
  ({ id, type, focusCoinPct, fractionalBuffer: 0, level: 1 })

const pop = (souls: number, at: Record<string, number> = {}): PopulationState => ({ souls, at })

const day = (over: Partial<Parameters<typeof simulateEconomyDay>[0]> = {}) =>
  simulateEconomyDay({ buildings: [], resources: res(), inv: makeEmptyInventories(), units: [], ...over })

describe('a crew is a property of the building, and an admin may resize it but not invent one', () => {
  it('the four buildings that skip the day have no crew at all', () => {
    for (const t of ['BARRACKS', 'MARKET', 'STABLE', 'SCRIPTORIUM'] as const) {
      expect(crewSizeOf(t)).toBe(0)
    }
  })

  it('a config override cannot CREATE a crew where the table has no row', () => {
    // Otherwise a config edit hands the barracks a production bonus it has no way to earn.
    GameConfig.init({ crew: { BARRACKS: 40 } })
    expect(crewSizeOf('BARRACKS')).toBe(0)
  })

  it('but it can resize one, up to the ceiling in the getter', () => {
    GameConfig.init({ crew: { LUMBER_MILL: 9 } })
    expect(crewSizeOf('LUMBER_MILL')).toBe(9)
    GameConfig.init({ crew: { LUMBER_MILL: 9999 } })
    expect(crewSizeOf('LUMBER_MILL')).toBe(POP_MAX_CREW)
  })

  it('a crew of zero is not a way to disable a building — it falls back to the table', () => {
    // `num(v, fallback, min)` returns the DEFAULT below its minimum, it does not clamp to
    // the floor. Getting this backwards is how a "safe" admin edit silently zeroes a system.
    GameConfig.init({ crew: { LUMBER_MILL: 0 } })
    expect(crewSizeOf('LUMBER_MILL')).toBe(CREW_SIZE.LUMBER_MILL)
  })

  it('the standing domain offers 138 posts across thirteen buildings', () => {
    const all = (Object.keys(CREW_SIZE) as Building['type'][]).map((t) => build(t, 100, t))
    expect(totalCrewPosts(all)).toBe(138)
  })
})

describe('what hands are worth', () => {
  const mill = build('LUMBER_MILL')

  it('nobody working is exactly today — the multiplier is 1, never 0', () => {
    // A factor of 0 would fall through the `!basePerDay` guard and silently zero the
    // building's Research% slider with no message anywhere.
    expect(staffMultOf(mill, pop(60))).toBe(1)
    expect(staffMultOf(mill, null)).toBe(1)
  })

  it('a full crew is worth half again', () => {
    expect(staffMultOf(mill, pop(60, { LUMBER_MILL: 3 }))).toBeCloseTo(1.5)
  })

  it('and it scales with how much of the crew turned up', () => {
    expect(staffMultOf(mill, pop(60, { LUMBER_MILL: 1 }))).toBeCloseTo(1 + 0.5 / 3)
  })

  it('the ceiling is on the aggregate, so no admin value doubles a day twice', () => {
    GameConfig.init({ population: { staffBonus: 99 } })
    expect(staffMultOf(mill, pop(60, { LUMBER_MILL: 3 }))).toBe(1 + POP_MAX_STAFF_BONUS)
  })

  it('hands over the crew ceiling do nothing, and come back on their own', () => {
    // Lossless, which is why the clamp is at READ and not at hydration: lowering a crew
    // from the admin cannot strand people inside a building with no control.
    const p = pop(60, { LUMBER_MILL: 40 })
    expect(handsAt(p, mill)).toBe(3)
    expect(idleHands(p, [mill])).toBe(57)
  })

  it('garbage in the postings reads as nobody rather than NaN', () => {
    // NaN here would make basePerDay NaN, the building would silently stop paying, and
    // `NaN < need` would make recruiting free.
    const p = { souls: 60, at: { LUMBER_MILL: 'x' } } as unknown as PopulationState
    expect(handsAt(p, mill)).toBe(0)
    expect(idleHands(p, [mill])).toBe(60)
    expect(Number.isFinite(staffMultOf(mill, p))).toBe(true)
  })

  it('idle never goes negative, whatever the save claims', () => {
    expect(idleHands(pop(2, { LUMBER_MILL: 3 }), [build('LUMBER_MILL')])).toBe(0)
  })
})

describe('the town grows from what was harvested today, never from the granary', () => {
  it('one farm at full material focus feeds exactly one birth a day', () => {
    // 800 value / (0.7 × 50c) = 22 food; half of that is 11, and a head eats 10.
    const d = day({ buildings: [build('FARM', 0)], population: pop(100) })
    expect(d.foodProduced).toBe(22)
    expect(d.peopleGrown).toBe(1)
    expect(d.peopleFoodSpent).toBe(10)
  })

  it('A FULL GRANARY BUYS NOBODY — this is the whole reason growth reads the harvest', () => {
    // FOOD is a market good at 50c in BOTH directions with no spread and no stock, so a
    // granary-fed town is a town you can buy: 10,000 food costs 500,000c and sells back for
    // the same, which would make a head cost 1,000c and pay for itself in days.
    const d = day({ resources: res({ FOOD: 100_000 }), population: pop(1000) })
    expect(d.peopleGrown).toBe(0)
    expect(d.resources.FOOD).toBe(100_000)
    expect(d.growthBlocked).toBe('no harvest today')
  })

  it('the newcomers eat before the army does, in both callers', () => {
    const input = { buildings: [build('FARM', 0)], resources: res({ FOOD: 5 }), inv: makeEmptyInventories(), units: [], population: pop(100) }
    const d = simulateEconomyDay(input)
    // 5 in store + 22 grown − 10 eaten by the newcomer.
    expect(d.resources.FOOD).toBe(17)
    expect(forecastDay(input).peopleGrown).toBe(d.peopleGrown)
  })

  it('a domain that recruited every last soul is not dead for ever', () => {
    const g = growthFromHarvest(0, 22)
    expect(g.grown).toBe(1) // the floor of 1 — but it still costs the full ration
    expect(g.foodSpent).toBe(10)
  })

  it('…and the floor still needs a harvest', () => {
    expect(growthFromHarvest(0, 0).grown).toBe(0)
    expect(growthFromHarvest(1000, 5).reason).toBe('the harvest is too small')
  })

  it('a bigger town wants more, up to what the farms allow', () => {
    expect(growthFromHarvest(1000, 22).grown).toBe(1) // wants 10, the harvest allows 1
    expect(growthFromHarvest(1000, 1000).grown).toBe(10) // wants 10, gets 10
  })

  it('an absent population is today exactly: no growth, no multiplier, same numbers', () => {
    // The property every untouched test in this repo relies on.
    const before = day({ buildings: [build('LUMBER_MILL', 100)] })
    expect(before.peopleGrown).toBe(0)
    expect(before.breakdown[0].staffMult).toBe(1)
    expect(before.breakdown[0].workers).toBe(0)
  })

  it('an admin cannot make heads free', () => {
    GameConfig.init({ population: { foodPerPerson: 0 } })
    expect(GameConfig.population().foodPerPerson).toBe(10) // below the minimum → the default
  })

  it('nor starve the army by giving the whole harvest to the cradle', () => {
    GameConfig.init({ population: { growthFoodSharePct: 100 } })
    expect(GameConfig.population().growthFoodSharePct).toBe(90)
  })
})

describe('a crewed building turns out more of everything, on one rule', () => {
  it('coin', () => {
    const bare = day({ buildings: [build('LUMBER_MILL', 100)] })
    const crewed = day({ buildings: [build('LUMBER_MILL', 100)], population: pop(60, { LUMBER_MILL: 3 }) })
    expect(crewed.breakdown[0].coinGain).toBe(Math.round(bare.breakdown[0].coinGain * 1.5))
  })

  it('goods', () => {
    const crewed = day({ buildings: [build('LUMBER_MILL', 0)], population: pop(60, { LUMBER_MILL: 3 }) })
    const bare = day({ buildings: [build('LUMBER_MILL', 0)] })
    expect(crewed.breakdown[0].itemsFloat).toBeCloseTo(bare.breakdown[0].itemsFloat * 1.5)
  })

  it('and study — it multiplies the day BEFORE research is taken off the top', () => {
    const b = { ...build('LUMBER_MILL', 100), focusResearchPct: 40 as const }
    const crewed = day({ buildings: [b], population: pop(60, { LUMBER_MILL: 3 }) })
    const bare = day({ buildings: [b] })
    expect(crewed.breakdown[0].researchValue).toBe(Math.round(bare.breakdown[0].researchValue * 1.5))
  })

  it('the line says who was there and what they were worth', () => {
    const d = day({ buildings: [build('MINTER')], population: pop(60, { MINTER: 8 }) })
    expect(d.breakdown[0].workers).toBe(8)
    expect(d.breakdown[0].staffMult).toBeCloseTo(1.25)
  })
})

describe('refusals, in the words the control shows', () => {
  const mill = build('LUMBER_MILL')
  const buildings = [mill]

  it('recruiting is refused when the town has no hands left, and says what to do', () => {
    expect(levyBlocker(80, 60)).toMatch(/Only 60 hands free — 80 asked for/)
    expect(levyBlocker(80, 0)).toMatch(/No hands left/)
    expect(levyBlocker(80, 80)).toBeNull()
  })

  it('and the check the button reads carries it', () => {
    const have = { wallet: 1e9, resources: res(), inv: makeEmptyInventories() }
    const check = checkRecruit(80, have, { quartered: 0, capacity: 500 }, 'LEVY', { idle: 60 })
    expect(check.ok).toBe(false)
    expect(check.reasons.join(' ')).toMatch(/Only 60 hands free/)
  })

  it('an absent people argument is unbounded — every older caller is unaffected', () => {
    const have = { wallet: 1e9, resources: res(), inv: makeEmptyInventories() }
    expect(checkRecruit(80, have, { quartered: 0, capacity: 500 }, 'LEVY').ok).toBe(true)
  })

  it('posting is refused with the number that stopped it, in each direction', () => {
    expect(assignBlocker(mill, 1, pop(0), buildings)).toMatch(/No hands free/)
    expect(assignBlocker(mill, 5, pop(2), buildings)).toMatch(/Only 2 hands free/)
    expect(assignBlocker(mill, 1, pop(60, { LUMBER_MILL: 3 }), buildings)).toMatch(/fully crewed at 3/)
    expect(assignBlocker(mill, 3, pop(60, { LUMBER_MILL: 2 }), buildings)).toMatch(/Room for 1 more/)
    expect(assignBlocker(mill, -1, pop(60), buildings)).toMatch(/Nobody is posted/)
    expect(assignBlocker(build('BARRACKS'), 1, pop(60), buildings)).toMatch(/no work for hands/)
    expect(assignBlocker(mill, 0, pop(60), buildings)).toMatch(/Nothing to move/)
  })

  it('and allows the moves that make sense', () => {
    expect(assignBlocker(mill, 3, pop(60), buildings)).toBeNull()
    expect(assignBlocker(mill, -2, pop(60, { LUMBER_MILL: 2 }), buildings)).toBeNull()
  })
})

describe('what a save may carry', () => {
  it('a new game and an emptied one are the SAME town — not zero, which refuses everything', () => {
    // Every sibling slice's `empty…()` is genuine zeroes, so somebody copying the nearest
    // neighbour lands on 0 souls and a game that refuses every action there is.
    expect(hydratePopulation(null)).toEqual(emptyPopulation())
    expect(emptyPopulation().souls).toBe(STARTING_SOULS)
  })

  it('a day-500 save with no population key is seeded to roughly crew what it built', () => {
    const buildings = (Object.keys(CREW_SIZE) as Building['type'][]).map((t) => build(t, 100, t))
    const p = hydratePopulation({ day: 500, buildings })
    expect(p.souls).toBe(STARTING_SOULS + 138)
    expect(p.at).toEqual({}) // everyone at home; posting them is the player's first decision
  })

  it('a day-1 save gets exactly the starting grant — barracks and market have no crews', () => {
    const p = hydratePopulation({ buildings: [build('BARRACKS'), build('MARKET')] })
    expect(p.souls).toBe(STARTING_SOULS)
  })

  it('a real population survives the round trip', () => {
    const p = hydratePopulation(JSON.parse(JSON.stringify({ population: pop(84, { mill1: 3, mine1: 7 }) })))
    expect(p).toEqual({ souls: 84, at: { mill1: 3, mine1: 7 } })
  })

  it('nonsense in the blob reads as nobody, and cannot come back inflated', () => {
    const p = hydratePopulation({
      population: { souls: '900', at: { a: -5, b: 1e9, c: null, d: 4 } },
    })
    expect(p.souls).toBe(900) // a numeric string is a number a JSON round trip can produce
    expect(p.at).toEqual({ b: POP_MAX_CREW, d: 4 })
  })

  it('a souls count that is not a number at all reads as an empty town, not NaN', () => {
    expect(hydratePopulation({ population: { souls: 'many', at: {} } }).souls).toBe(0)
  })

  it('the starting grant is a module constant, so a config that failed to load cannot freeze it', () => {
    // `loadWarlordConfig` returns null in silence when Firestore does not answer. If this
    // were a getter, a player who first loaded offline would have the default frozen into
    // their save for ever while everyone else got the tuned one.
    GameConfig.init({ population: { staffBonus: 0.9 } })
    expect(hydratePopulation(null).souls).toBe(STARTING_SOULS)
  })
})
