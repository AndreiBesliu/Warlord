import { describe, it, expect, beforeEach } from 'vitest'
import { simulateEconomyDay, ResourceBuildingCosts, buildingResourceCost, ManufacturingRecipes } from './economy'
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

// These pinned the imbalance while it existed. They now pin the fix: a workshop's
// appetite has to be something an extraction building can actually feed.
describe('a workshop can now be fed by the buildings that supply it', () => {
  const millL3 = build('LUMBER_MILL', 0, 'WOOD', 3)

  it('one level-3 mill sustains one woodworker — the balance that was missing', () => {
    const net = woodPerDay([millL3, build('WOODWORKER', 0, 'BOW', 1)])
    expect(Math.abs(net)).toBeLessThanOrEqual(5) // was -376 before the rebalance
  })

  it('a blacksmith on spears is within reach of a mill or two, not a hundred', () => {
    const alone = woodPerDay([build('BLACKSMITH', 0, 'SPEAR', 1)])
    expect(alone).toBeGreaterThan(-40) // was -2379
    expect(Math.abs(alone) / 23).toBeLessThan(2) // under two level-3 mills
  })

  it('one smelter covers several blacksmiths worth of iron', () => {
    const smelted = simulateEconomyDay({
      buildings: [build('SMELTER', 0, 'IRON_INGOT', 1)],
      resources: res({ IRON_ORE: 1000, COAL: 1000 }),
      inv: makeEmptyInventories(), units: [],
    })
    const produced = (smelted.resources.IRON_INGOT ?? 0)
    const consumed = -(simulateEconomyDay({
      buildings: [build('BLACKSMITH', 0, 'SWORD', 1)],
      resources: res({ IRON_INGOT: 1000, COAL: 1000 }),
      inv: makeEmptyInventories(), units: [],
    }).resources.IRON_INGOT - 1000)
    expect(produced).toBeGreaterThan(consumed)
  })

  it('crafting ADDS value instead of destroying it', () => {
    // Every recipe used to cost more in materials than the item was worth, which made a
    // workshop a way to convert resources into less than you started with.
    const price: Record<string, number> = { WOOD: 50, COAL: 100, IRON_INGOT: 300 }
    const item: Record<string, number> = { BOW: 70, SHIELD: 100, SPEAR: 300, HALBERD: 1200, SWORD: 1500 }
    for (const [name, recipe] of Object.entries(ManufacturingRecipes)) {
      const cost = Object.entries(recipe).reduce((n, [r, q]) => n + (price[r] ?? 0) * (q as number), 0)
      expect(cost, `${name} costs ${cost}c of materials but is worth ${item[name]}c`).toBeLessThan(item[name])
    }
  })
})

describe('the new output axis is admin-tunable', () => {
  it('buildingOutputValue overrides what a workshop turns out', () => {
    const base = woodPerDay([build('LUMBER_MILL', 0, 'WOOD', 1)])
    GameConfig.init({ buildingOutputValue: { LUMBER_MILL: 2000 } })
    expect(woodPerDay([build('LUMBER_MILL', 0, 'WOOD', 1)])).toBeGreaterThan(base * 2)
  })

  it('a legacy resourceBaseValue override still applies — an existing config must not go quiet', () => {
    GameConfig.init({ resourceBaseValue: { WOOD: 5000 } })
    expect(woodPerDay([build('LUMBER_MILL', 0, 'WOOD', 1)])).toBeGreaterThan(100)
  })

  it('recipes are tunable too', () => {
    const before = woodPerDay([build('WOODWORKER', 0, 'BOW', 1)])
    GameConfig.init({ recipes: { BOW: { WOOD: 10 } } })
    expect(woodPerDay([build('WOODWORKER', 0, 'BOW', 1)])).toBeLessThan(before)
  })
})
