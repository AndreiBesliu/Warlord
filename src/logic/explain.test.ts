import { describe, it, expect, beforeEach } from 'vitest'
import {
  explainBuilding, buildingFormula, compareConfigs, referenceDomain,
  explainRecipe, explainBuildingCost, explainCompany, explainMission,
} from './explain'
import { GameConfig } from './config'
import { Registry } from './registry'

Registry.init()
beforeEach(() => GameConfig.init(null))

// The panel's whole credibility rests on this: the preview is produced by the same
// function the daily tick commits, so it cannot advertise numbers the game won't pay.
describe('explainBuilding reports what a building really does in a day', () => {
  it('a lumber mill at full material focus produces wood and no coin', () => {
    const e = explainBuilding('LUMBER_MILL', { focusCoinPct: 0 })
    expect(e.coinPerDay).toBe(0)
    expect(e.itemsPerDay).toBeGreaterThan(10)
    expect(e.blocked).toBe(false)
  })

  it('the same mill at full coin focus produces coin and no wood', () => {
    const e = explainBuilding('LUMBER_MILL', { focusCoinPct: 100 })
    expect(e.coinPerDay).toBe(500)
    expect(e.itemsPerDay).toBe(0)
  })

  it('level multiplies the output, exactly as the tick does', () => {
    const l1 = explainBuilding('LUMBER_MILL', { focusCoinPct: 100 }).coinPerDay
    const l3 = explainBuilding('LUMBER_MILL', { focusCoinPct: 100, level: 3 }).coinPerDay
    expect(l3 / l1).toBeCloseTo(1.6, 2)
  })

  it('reports what a workshop consumes, not just what it makes', () => {
    const e = explainBuilding('WOODWORKER', { focusCoinPct: 0, outputItem: 'BOW' })
    expect(e.itemsPerDay).toBeGreaterThan(0)
    expect(e.consumesPerDay.WOOD).toBeGreaterThan(0)
  })

  it("does not blame a building for nature's free wood", () => {
    const e = explainBuilding('MINTER', { focusCoinPct: 100 })
    expect(e.consumesPerDay.WOOD ?? 0).toBe(0)
  })
})

describe('buildingFormula spells out the arithmetic with real numbers', () => {
  it('names the value, the focus split and the item conversion', () => {
    const lines = buildingFormula('LUMBER_MILL', 1, 40).join(' | ')
    expect(lines).toContain('value/day')
    expect(lines).toContain('coin/day')
    expect(lines).toContain('items/day')
    expect(lines).toContain('40%')
  })

  it('mentions the recipe for a building that consumes materials', () => {
    expect(buildingFormula('WOODWORKER').join(' | ')).toMatch(/consumes/)
  })

  it('says plainly when a building yields only coin', () => {
    expect(buildingFormula('MINTER').join(' | ')).toContain('no item')
  })
})

describe('compareConfigs answers "what would my change do?"', () => {
  it('an unchanged configuration changes nothing', () => {
    const d = compareConfigs(null, null)
    expect(d.wallet).toBe(0)
    expect(Object.keys(d.resources)).toHaveLength(0)
  })

  it('raising a building output shows up as more of that resource per day', () => {
    const d = compareConfigs(null, { buildingOutputValue: { LUMBER_MILL: 5000 } })
    expect(d.resources.WOOD).toBeGreaterThan(0)
  })

  it('a cheaper recipe shows up as less material consumed per day', () => {
    const expensive = { recipes: { BOW: { WOOD: 10 } } }
    const cheap = { recipes: { BOW: { WOOD: 1 } } }
    expect(compareConfigs(expensive, cheap).resources.WOOD).toBeGreaterThan(0)
  })

  it('NEVER leaves the live configuration on the previewed values', () => {
    GameConfig.init({ buildingOutputValue: { LUMBER_MILL: 777 } })
    compareConfigs(null, { buildingOutputValue: { LUMBER_MILL: 999 } })
    expect(GameConfig.buildingOutputValue('LUMBER_MILL')).toBe(777)
  })

  it('restores the live configuration even when the simulation throws', () => {
    GameConfig.init({ buildingOutputValue: { LUMBER_MILL: 777 } })
    try {
      // A proposal shaped wrongly enough to break the run must not strand the singleton.
      compareConfigs(null, { recipes: null as never })
    } catch {
      /* the throw is the point */
    }
    expect(GameConfig.buildingOutputValue('LUMBER_MILL')).toBe(777)
  })
})

describe('the reference domain', () => {
  it('includes every building that has an output value, so no change is invisible', () => {
    const types = referenceDomain().map((b) => b.type)
    expect(types).toContain('LUMBER_MILL')
    expect(types).toContain('BLACKSMITH')
    expect(new Set(types).size).toBe(types.length)
  })
})

describe('effects are shown for the configuration being EDITED', () => {
  it('explainBuilding evaluates under a supplied config, not the live one', () => {
    GameConfig.init(null)
    const base = explainBuilding('LUMBER_MILL', { focusCoinPct: 0 }).itemsPerDay
    const proposed = explainBuilding('LUMBER_MILL', {
      focusCoinPct: 0,
      config: { buildingOutputValue: { LUMBER_MILL: 2000 } },
    }).itemsPerDay
    expect(proposed).toBeCloseTo(base * 4, 1)
  })

  it('the formula quotes the value actually in force', () => {
    const lines = buildingFormula('LUMBER_MILL', 1, 0, { buildingOutputValue: { LUMBER_MILL: 2000 } })
    expect(lines[0]).toContain('20s') // 2000c, not the built-in 500
  })

  it('previewing under a config never leaves it applied', () => {
    GameConfig.init({ buildingOutputValue: { LUMBER_MILL: 777 } })
    explainBuilding('LUMBER_MILL', { config: { buildingOutputValue: { LUMBER_MILL: 999 } } })
    buildingFormula('LUMBER_MILL', 1, 0, { buildingOutputValue: { LUMBER_MILL: 111 } })
    expect(GameConfig.buildingOutputValue('LUMBER_MILL')).toBe(777)
  })
})

describe('explainRecipe measures the trap the panel warns about', () => {
  it('flags a recipe whose materials cost more than the item', () => {
    const r = explainRecipe('BOW', { recipes: { BOW: { WOOD: 50 } } })
    expect(r.destroysValue).toBe(true)
    expect(r.ratio).toBeGreaterThan(1)
  })

  it('does not flag the shipped recipes', () => {
    for (const item of ['BOW', 'SPEAR', 'SHIELD', 'SWORD', 'HALBERD']) {
      expect(explainRecipe(item).destroysValue).toBe(false)
    }
  })

  it('prices the materials at the values the game uses', () => {
    const r = explainRecipe('BOW')
    const sum = r.materials.reduce((s, m) => s + m.qty * m.unitValue, 0)
    expect(r.materialsValue).toBe(sum)
  })
})

describe('explainBuildingCost', () => {
  it('quotes the price being edited, not the built-in one', () => {
    const c = explainBuildingCost('LUMBER_MILL', { buildingCost: { LUMBER_MILL: 12_345 } })
    expect(c.build).toBe(12_345)
  })

  it('adds up the road to max level', () => {
    const c = explainBuildingCost('LUMBER_MILL')
    const last = c.upgrades[c.upgrades.length - 1]
    expect(last.cumulative).toBe(c.build + c.upgrades.reduce((s, u) => s + u.cost, 0))
  })

  it('reports the resources a building also costs', () => {
    const c = explainBuildingCost('BLACKSMITH', { buildingResourceCost: { BLACKSMITH: { WOOD: 40 } } })
    expect(c.resources.WOOD).toBe(40)
  })
})

describe('explainCompany prices an army at the size one actually reaches', () => {
  it('scales with the number of soldiers', () => {
    const ten = explainCompany('HEAVY_INF_SWORD', 'NOVICE', 10)
    const twenty = explainCompany('HEAVY_INF_SWORD', 'NOVICE', 20)
    expect(twenty.copperPerDay).toBe(ten.copperPerDay * 2)
    expect(twenty.foodPerDay).toBe(ten.foodPerDay * 2)
  })

  it('a veteran costs more to keep than a novice', () => {
    const novice = explainCompany('HEAVY_INF_SWORD', 'NOVICE', 10).copperPerDay
    const veteran = explainCompany('HEAVY_INF_SWORD', 'VETERAN', 10).copperPerDay
    expect(veteran).toBeGreaterThan(novice)
  })

  it('uses the edited upkeep, not the default', () => {
    const c = explainCompany('LIGHT_INF_SWORD', 'NOVICE', 10, { upkeepBase: { LIGHT_INF_SWORD: 100 } })
    expect(c.copperPerDay).toBe(1000)
  })
})

describe('explainMission', () => {
  it('sizes the enemy off the army you deploy', () => {
    const m = explainMission('BANDIT_RAID', 100)
    expect(m.enemyStrength).toBe(60)
  })

  it('pays out under the reward being edited', () => {
    const base = explainMission('BANDIT_RAID', 100).rewardCopper
    const richer = explainMission('BANDIT_RAID', 100, {
      missions: { BANDIT_RAID: { rewardCopperPerStrength: 400 } },
    }).rewardCopper
    expect(richer).toBe(base * 10)
  })
})
