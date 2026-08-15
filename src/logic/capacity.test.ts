import { describe, it, expect, beforeEach } from 'vitest'
import { GameConfig, DEFAULT_BARRACKS } from './config'
import { barracksCapacity, quarteredCount, checkRecruit, recruitCostCopper } from './barracks'
import { emptyBarracks } from '../state/useBarracks'
import { makeEmptyInventories } from './helpers'
import { ResourceTypes, type ResourceMap } from './types'

beforeEach(() => GameConfig.init(null))

const rich = () => ({
  wallet: 10_000_000,
  resources: Object.fromEntries(ResourceTypes.map((r) => [r, 1000])) as ResourceMap,
  inv: makeEmptyInventories(),
})

const poolWith = (type: 'LIGHT_INF_SPEAR', rank: 'NOVICE' | 'TRAINED', count: number) => {
  const p = emptyBarracks()
  p[type][rank].count = count
  return p
}

describe('the barracks has a bottom now', () => {
  it('grows with the level, by the configured step', () => {
    expect(barracksCapacity(1)).toBe(DEFAULT_BARRACKS.capacityBase)
    expect(barracksCapacity(2)).toBe(DEFAULT_BARRACKS.capacityBase + DEFAULT_BARRACKS.capacityPerLevel)
    expect(barracksCapacity(5)).toBeGreaterThan(barracksCapacity(4))
  })

  it('can never be zero, whatever the admin types', () => {
    // A capacity of 0 would make the game unstartable — you could not hold one recruit.
    GameConfig.init({ barracks: { capacityBase: 0 } })
    expect(barracksCapacity(1)).toBeGreaterThanOrEqual(1)
    GameConfig.init({ barracks: { capacityBase: 'lots' as never } })
    expect(barracksCapacity(1)).toBe(DEFAULT_BARRACKS.capacityBase)
  })
})

describe('who counts as quartered', () => {
  it('counts untyped recruits and trained soldiers alike', () => {
    expect(quarteredCount(30, poolWith('LIGHT_INF_SPEAR', 'NOVICE', 20))).toBe(50)
  })

  it('does NOT count soldiers already formed into units', () => {
    // This is the whole release valve: forming a unit marches those men out of the
    // barracks and frees their places. If units counted, the cap would be a dead end.
    const pool = poolWith('LIGHT_INF_SPEAR', 'NOVICE', 20)
    const before = quarteredCount(0, pool)
    pool.LIGHT_INF_SPEAR.NOVICE.count = 0 // the 20 became a Unit
    expect(quarteredCount(0, pool)).toBe(before - 20)
  })

  it('an empty barracks quarters nobody', () => {
    expect(quarteredCount(0, emptyBarracks())).toBe(0)
  })
})

describe('the cap is enforced where men ENTER, and nowhere else', () => {
  it('training and conversion are net-zero, so they never need checking', () => {
    // A batch takes N recruits and returns N trained; a conversion moves between pools.
    // Neither can push the total up — which is why recruiting is the only gate.
    const before = quarteredCount(20, emptyBarracks())
    const afterTraining = quarteredCount(0, poolWith('LIGHT_INF_SPEAR', 'NOVICE', 20))
    expect(afterTraining).toBe(before)

    const converted = poolWith('LIGHT_INF_SPEAR', 'NOVICE', 0)
    converted.LIGHT_CAV.NOVICE.count = 20
    expect(quarteredCount(0, converted)).toBe(before)
  })

  it('refuses a recruitment that would not fit, and says how much room is left', () => {
    const r = checkRecruit(50, rich(), { quartered: 70, capacity: 80 })
    expect(r.ok).toBe(false)
    expect(r.reasons.join(' ')).toContain('Only room for 10')
  })

  it('says plainly when the barracks is full, and points at the way out', () => {
    const r = checkRecruit(1, rich(), { quartered: 80, capacity: 80 })
    expect(r.ok).toBe(false)
    expect(r.reasons.join(' ')).toMatch(/Barracks full/)
    expect(r.reasons.join(' ')).toMatch(/Form units/)
  })

  it('allows exactly the number that fits', () => {
    expect(checkRecruit(10, rich(), { quartered: 70, capacity: 80 }).ok).toBe(true)
    expect(checkRecruit(11, rich(), { quartered: 70, capacity: 80 }).ok).toBe(false)
  })

  it('still refuses when the money is short, cap or no cap', () => {
    const broke = { ...rich(), wallet: 0 }
    const r = checkRecruit(10, broke, { quartered: 0, capacity: 80 })
    expect(r.ok).toBe(false)
    expect(recruitCostCopper(10)).toBeGreaterThan(0)
  })

  it('an existing save over the new cap is not broken — it just cannot recruit', () => {
    // The cap is new. A kingdom that already houses more than it must not become invalid.
    const over = checkRecruit(1, rich(), { quartered: 500, capacity: 80 })
    expect(over.ok).toBe(false)
    expect(quarteredCount(500, emptyBarracks())).toBe(500) // still counted, still legal
  })
})
