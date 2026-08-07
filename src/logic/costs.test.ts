import { describe, it, expect } from 'vitest'
import { evaluateCost } from './costs'
import { makeEmptyInventories } from './helpers'
import type { ResourceMap } from './types'

const res = (over: Partial<ResourceMap> = {}): ResourceMap => ({
  WOOD: 0, STONE: 0, IRON_ORE: 0, COAL: 0, COPPER_ORE: 0, SILVER_ORE: 0,
  IRON_INGOT: 0, COPPER_INGOT: 0, SILVER_INGOT: 0, FOOD: 0, ...over,
})

const holdings = (over: { wallet?: number; resources?: Partial<ResourceMap> } = {}) => ({
  wallet: over.wallet ?? 0,
  resources: res(over.resources),
  inv: makeEmptyInventories(),
})

describe('evaluateCost tells you WHAT is missing, not just that something is', () => {
  it('reports every line with need and have, even the covered ones', () => {
    const r = evaluateCost({ copper: 500, resources: { WOOD: 10 } }, holdings({ wallet: 1000, resources: { WOOD: 4 } }))
    expect(r.lines).toHaveLength(2)
    expect(r.lines.find((l) => l.key === 'COPPER')).toMatchObject({ need: 500, have: 1000, short: 0 })
    expect(r.lines.find((l) => l.key === 'WOOD')).toMatchObject({ need: 10, have: 4, short: 6 })
  })

  it('is affordable only when nothing is short', () => {
    expect(evaluateCost({ copper: 100 }, holdings({ wallet: 100 })).ok).toBe(true)
    expect(evaluateCost({ copper: 101 }, holdings({ wallet: 100 })).ok).toBe(false)
  })

  it('builds a button-ready shortfall label naming every gap', () => {
    const r = evaluateCost(
      { copper: 20000, resources: { IRON_INGOT: 30, WOOD: 5 } },
      holdings({ wallet: 10000, resources: { IRON_INGOT: 2, WOOD: 5 } }),
    )
    expect(r.shortfallLabel).toContain('28 Iron Ingot')
    expect(r.shortfallLabel).not.toContain('Wood') // covered, so not named
    expect(r.shortfallLabel.startsWith('Need ')).toBe(true)
  })

  it('says nothing when everything is covered', () => {
    expect(evaluateCost({ copper: 1 }, holdings({ wallet: 5 })).shortfallLabel).toBe('')
  })

  it('spends only ACTIVE horses — the stabled ones do not count', () => {
    const h = holdings()
    h.inv.horses.LIGHT_HORSE = { active: 3, inactive: 40 }
    const r = evaluateCost({ horses: { LIGHT_HORSE: 10 } }, h)
    expect(r.missing[0]).toMatchObject({ have: 3, short: 7 })
  })

  it('reads weapons and armour out of the inventory', () => {
    const h = holdings()
    h.inv.weapons.SPEAR = 12
    const r = evaluateCost({ weapons: { SPEAR: 20 }, armors: { SHIELD: 20 } }, h)
    expect(r.missing).toHaveLength(2)
    expect(r.missing.find((l) => l.key === 'SPEAR')).toMatchObject({ have: 12, short: 8 })
    expect(r.missing.find((l) => l.key === 'SHIELD')).toMatchObject({ have: 0, short: 20 })
  })

  it('ignores zero and missing entries instead of rendering empty rows', () => {
    const r = evaluateCost({ copper: 0, resources: { WOOD: 0 } }, holdings())
    expect(r.lines).toHaveLength(0)
    expect(r.ok).toBe(true)
  })

  it('treats an unknown resource key as zero held rather than crashing', () => {
    const r = evaluateCost({ resources: { UNOBTAINIUM: 3 } }, holdings())
    expect(r.missing[0]).toMatchObject({ have: 0, short: 3 })
  })
})
