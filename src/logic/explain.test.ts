import { describe, it, expect, beforeEach } from 'vitest'
import { explainBuilding, buildingFormula, compareConfigs, referenceDomain } from './explain'
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
