import { describe, it, expect, beforeEach } from 'vitest'
import {
  DUTIES, creditDuty, dutyBlocker, dutyById, dutyCostCopper, dutyNumbers, marchBlocker,
} from './duty'
import { GameConfig, DUTY_MAX_PAY, DUTY_MAX_CHARGE } from './config'
import { RENOWN_KEYS, renownOf, legionLevel, DEED_LABEL } from './practice'

beforeEach(() => GameConfig.init(null))

describe('duties buy direction, never depth', () => {
  it('a thousand days of every duty buys not one level', () => {
    // The whole reason duty counters are safe. A day is had by WAITING — and the day clock
    // even retro-credits an absence — so anything a day could buy would be bought by
    // leaving the tab open. Level comes from winning; duties only prove a character.
    let led = {}
    for (let i = 0; i < 1000; i++) for (const d of DUTIES) led = creditDuty(led, d)
    expect(renownOf(led)).toBe(0)
    expect(legionLevel(led)).toBe(1)
  })

  it('no duty writes a renown key', () => {
    for (const d of DUTIES) {
      expect((RENOWN_KEYS as readonly string[]).includes(d.deed)).toBe(false)
    }
  })

  it('each duty fills its OWN counter — one duty, one proof', () => {
    const deeds = DUTIES.map((d) => d.deed)
    expect(new Set(deeds).size).toBe(deeds.length)
    for (const d of DUTIES) {
      expect(creditDuty({}, d)).toEqual({ [d.deed]: 1 })
    }
  })

  it('counts up, one day at a time', () => {
    const g = DUTIES.find((d) => d.id === 'GARRISON')!
    let led = {}
    for (let i = 0; i < 7; i++) led = creditDuty(led, g)
    expect(led).toEqual({ daysGarrisoned: 7 })
  })

  it('every duty counter is spelled for a reader, both forms', () => {
    for (const d of DUTIES) {
      expect(DEED_LABEL[d.deed].one).not.toBe(DEED_LABEL[d.deed].many)
    }
  })
})

describe('the three duties are three ECONOMIC SHAPES, not three names', () => {
  it('one costs a little, one costs a lot, one pays', () => {
    const bill = (id: string) => dutyCostCopper(dutyById(id)!, 100)
    expect(bill('GARRISON')).toBeGreaterThan(0)
    expect(bill('DRILL')).toBeGreaterThan(bill('GARRISON'))
    expect(bill('PATROL')).toBeLessThan(0)
  })

  it('the bill scales with the men, and an empty legion costs nothing', () => {
    const drill = dutyById('DRILL')!
    expect(dutyCostCopper(drill, 200)).toBe(2 * dutyCostCopper(drill, 100))
    expect(dutyCostCopper(drill, 0)).toBe(0)
    // Negative headcounts cannot happen, but a bill that PAID for them would be a mint.
    expect(dutyCostCopper(drill, -50)).toBe(0)
  })

  it('the same men cost the same however they are split into cohorts', () => {
    // Rounded once at the end, not per cohort: otherwise reorganising a legion changes
    // its bill, which is a difference a player can see and cannot explain.
    const patrol = dutyById('PATROL')!
    expect(dutyCostCopper(patrol, 33) + dutyCostCopper(patrol, 67)).toBe(dutyCostCopper(patrol, 100))
  })
})

describe('the admin may retune it, but cannot turn it into a printer', () => {
  it('a duty that pays is bounded harder than one that charges', () => {
    GameConfig.init({ duties: { PATROL: { copperPerSoldier: -9999 } } })
    // Out of range falls back to the catalog value rather than clamping to the floor,
    // so there is no number that removes the bound.
    expect(dutyNumbers(dutyById('PATROL')!).copperPerSoldier).toBe(-2)
    GameConfig.init({ duties: { PATROL: { copperPerSoldier: -DUTY_MAX_PAY } } })
    expect(dutyNumbers(dutyById('PATROL')!).copperPerSoldier).toBe(-DUTY_MAX_PAY)
  })

  it('an absurd charge is clamped rather than obeyed', () => {
    GameConfig.init({ duties: { GARRISON: { copperPerSoldier: 999_999 } } })
    expect(dutyNumbers(dutyById('GARRISON')!).copperPerSoldier).toBe(DUTY_MAX_CHARGE)
  })

  it('nonsense falls back to the catalog', () => {
    GameConfig.init({ duties: { DRILL: { copperPerSoldier: NaN } } })
    expect(dutyNumbers(dutyById('DRILL')!).copperPerSoldier).toBe(4)
  })

  it('what the screen quotes is what the tick will charge', () => {
    GameConfig.init({ duties: { GARRISON: { copperPerSoldier: 3 } } })
    expect(dutyCostCopper(dutyById('GARRISON')!, 100)).toBe(300)
  })
})

describe('the occupation is the price', () => {
  it('a legion on any duty may not march, and the reason names the duty', () => {
    for (const d of DUTIES) {
      expect(marchBlocker(d.id, 'The First Host')).toContain('The First Host')
      expect(marchBlocker(d.id, 'The First Host')).toContain(d.name.toLowerCase())
    }
  })

  it('a legion standing ready may march', () => {
    expect(marchBlocker(null, 'The First Host')).toBeNull()
    expect(marchBlocker(undefined, 'The First Host')).toBeNull()
  })

  it('a duty the game no longer has does not strand a legion forever', () => {
    // Same policy as an unknown tradition id: unresolvable means "none", never an
    // occupation nothing can look up or lift.
    expect(marchBlocker('SIEGEWORKS', 'The First Host')).toBeNull()
    expect(dutyById('SIEGEWORKS')).toBeNull()
  })

  it('a legion with no cohorts has nobody to send', () => {
    expect(dutyBlocker(0)).toMatch(/nobody to send/)
    expect(dutyBlocker(1)).toBeNull()
  })
})
