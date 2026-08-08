import { describe, it, expect, beforeEach } from 'vitest'
import { simulateEconomyDay, ResourceBuildingCosts, buildingResourceCost } from './economy'
import { GameConfig } from './config'
import { makeEmptyInventories } from './helpers'
import { Registry } from './registry'
import type { Building, ResourceMap } from './types'

Registry.init()
beforeEach(() => GameConfig.init(null))

const res = (over: Partial<ResourceMap> = {}): ResourceMap => ({
  WOOD: 0, STONE: 0, IRON_ORE: 0, COAL: 0, COPPER_ORE: 0, SILVER_ORE: 0,
  IRON_INGOT: 0, COPPER_INGOT: 0, SILVER_INGOT: 0, FOOD: 0, ...over,
})
const build = (type: Building['type'], focusCoinPct: Building['focusCoinPct'], outputItem?: string, level = 1): Building =>
  ({ id: `${type}${level}`, type, focusCoinPct, outputItem, fractionalBuffer: 0, level })

const woodPerDay = (buildings: Building[], resources = res({ WOOD: 5000, IRON_INGOT: 5000, COAL: 5000 })) => {
  const after = simulateEconomyDay({ buildings, resources, inv: makeEmptyInventories(), units: [] })
  return (after.resources.WOOD ?? 0) - (resources.WOOD ?? 0)
}

// The owner's report: "I changed wood production and a building's wood cost and saw no
// change — and wood production is not balanced against the buildings that need wood.
// I have a level-3 lumber mill." These tests pin BOTH halves: that the admin levers
// really move the numbers, and what the numbers actually are.
describe('the admin levers reach wood', () => {
  it('resourceBaseValue.WOOD changes what a lumber mill produces', () => {
    const mill = [build('LUMBER_MILL', 0, 'WOOD', 3)]
    const before = woodPerDay(mill)
    GameConfig.init({ resourceBaseValue: { WOOD: 2000 } })
    const after = woodPerDay(mill)
    expect(after).toBeGreaterThan(before)
    expect(after / before).toBeCloseTo(4, 0) // 2000 vs the built-in 500
  })

  it('buildingResourceCost changes what a building costs in wood', () => {
    expect(buildingResourceCost('BLACKSMITH').WOOD).toBe(ResourceBuildingCosts.BLACKSMITH.WOOD)
    GameConfig.init({ buildingResourceCost: { BLACKSMITH: { WOOD: 7 } } })
    expect(buildingResourceCost('BLACKSMITH').WOOD).toBe(7)
    expect(buildingResourceCost('BLACKSMITH').STONE).toBe(ResourceBuildingCosts.BLACKSMITH.STONE)
  })
})

describe('what a level-3 lumber mill actually yields', () => {
  it('produces nothing at all while its focus is on coin — the default for a new building', () => {
    expect(woodPerDay([build('LUMBER_MILL', 100, 'WOOD', 3)])).toBe(1) // only nature's +1
  })

  it('yields about 24 wood a day at full material focus', () => {
    const perDay = woodPerDay([build('LUMBER_MILL', 0, 'WOOD', 3)])
    expect(perDay).toBeGreaterThanOrEqual(22)
    expect(perDay).toBeLessThanOrEqual(26)
  })
})

// This is the actual imbalance: one crafting building can eat a week of milling in a day.
describe('what consumes wood, measured against that mill', () => {
  const millL3 = build('LUMBER_MILL', 0, 'WOOD', 3)

  it('a woodworker making bows outspends the mill many times over', () => {
    const net = woodPerDay([millL3, build('WOODWORKER', 0, 'BOW', 1)])
    expect(net).toBeLessThan(0)
    // The mill adds ~23; the net tells us the workshop's appetite.
    expect(Math.abs(net)).toBeGreaterThan(100)
  })

  it('a blacksmith making spears is in a different league entirely', () => {
    const net = woodPerDay([millL3, build('BLACKSMITH', 0, 'SPEAR', 1)])
    expect(net).toBeLessThan(-1000)
  })

  it('the buildings themselves are cheap by comparison — days, not weeks', () => {
    const perDay = woodPerDay([millL3])
    const dearest = Math.max(...Object.values(ResourceBuildingCosts).map((c) => c.WOOD ?? 0))
    expect(dearest).toBe(200) // SILVER_MINE
    expect(dearest / perDay).toBeLessThan(10) // under ten days of milling for the priciest
  })
})
