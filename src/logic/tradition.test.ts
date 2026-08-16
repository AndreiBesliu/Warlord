import { describe, it, expect, beforeEach } from 'vitest'
import {
  TRADITIONS, adoptBlocker, classesOf, describeTradition, joinBan, legionEffectsByUnit,
  outOfKeeping, traditionById, traditionEffects, victoryCount,
} from './tradition'
import { GameConfig } from './config'
import { SoldierTypes, type SoldierType, type Unit } from './types'
import { applyBattleResult } from './combat/army'
import { XP_CAP } from './combat/stats'
import type { BattleState, Combatant } from './combat/types'
import { hydrateLegions } from '../state/useLegions'

const unit = (id: string, type: SoldierType, count = 20, avgXP = 0): Unit => ({
  id, type, buckets: [{ r: 'NOVICE', count, avgXP }], avgXP, training: false, morale: 100,
  equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
})

const def = (id: string) => traditionById(id)!
const legion = (unitIds: string[], tradition: string | null = null, wins = 0) => ({
  id: 'L1', name: 'The First Host', foundedDay: 1, unitIds,
  honours: wins > 0 ? [{ key: 'W', label: 'Victor', count: wins, firstDay: 1 }] : [],
  tradition,
})

beforeEach(() => GameConfig.init(null))

describe('type classes are derived, not listed', () => {
  it('every soldier type lands in at least one class', () => {
    // The whole point of deriving from DEFAULT_COMBAT_STATS: a soldier type added later
    // cannot be forgotten here and silently slip past an oath it should have failed.
    for (const t of SoldierTypes) expect(classesOf(t).length).toBeGreaterThan(0)
  })

  it('MOUNTED and FOOT partition the roster', () => {
    for (const t of SoldierTypes) {
      const c = classesOf(t)
      expect(c.includes('MOUNTED')).toBe(!c.includes('FOOT'))
    }
  })

  it('a horse archer is BOTH mounted and an archer, and is heavy foot in neither sense', () => {
    expect(classesOf('HORSE_ARCHER').sort()).toEqual(['ARCHER', 'MOUNTED'])
    expect(classesOf('HEAVY_ARCHER').sort()).toEqual(['ARCHER', 'FOOT'])
    expect(classesOf('HEAVY_INF_SWORD').sort()).toEqual(['FOOT', 'HEAVY_FOOT'])
  })
})

describe('bans refuse at the door — they are monotone, so the door is enough', () => {
  it('the Shieldwall will not take a horseman, and says which kind it refuses', () => {
    expect(joinBan(def('SHIELDWALL'), 'HEAVY_CAV', 0)).toMatch(/horsemen/)
    expect(joinBan(def('SHIELDWALL'), 'HEAVY_INF_SWORD', 0)).toBeNull()
  })

  it("the Wind's Own is the mirror: it will not take men on foot", () => {
    expect(joinBan(def('WINDS_OWN'), 'HEAVY_INF_SWORD', 0)).toMatch(/on foot/)
    expect(joinBan(def('WINDS_OWN'), 'HORSE_ARCHER', 0)).toBeNull()
  })

  it('the Iron Vow refuses horsemen AND archers, including the type that is both', () => {
    expect(joinBan(def('IRON_VOW'), 'HORSE_ARCHER', 0)).not.toBeNull()
    expect(joinBan(def('IRON_VOW'), 'HEAVY_ARCHER', 0)).toMatch(/archers/)
    expect(joinBan(def('IRON_VOW'), 'LIGHT_INF_SPEAR', 0)).toBeNull()
  })

  it('a tighter cohort ceiling is a ban too', () => {
    expect(joinBan(def('WINDS_OWN'), 'LIGHT_CAV', 5)).toBeNull()
    expect(joinBan(def('WINDS_OWN'), 'LIGHT_CAV', 6)).toMatch(/no more than 6/)
  })

  it('no oath, no ban', () => {
    expect(joinBan(null, 'HEAVY_CAV', 99)).toBeNull()
  })
})

describe('standing requirements SUSPEND — they never refuse and never revoke', () => {
  it('a legion mauled below its share keeps the oath and loses the bonus', () => {
    const d = def('SHIELDWALL')
    const inKeeping = [unit('a', 'HEAVY_INF_SWORD'), unit('b', 'LIGHT_INF_SPEAR')]
    expect(outOfKeeping(d, inKeeping)).toBeNull()
    expect(traditionEffects('SHIELDWALL', inKeeping).moraleBonus).toBeGreaterThan(0)

    // 'a' is wiped out in a battle. Nothing was assigned, nothing was refused — and the
    // legion is still sworn; only the bonus goes to sleep.
    const mauled = [unit('b', 'LIGHT_INF_SPEAR')]
    expect(outOfKeeping(d, mauled)).toMatch(/needs 1 of 1 cohorts to be heavy foot, has 0/)
    expect(traditionEffects('SHIELDWALL', mauled).moraleBonus).toBe(0)
    expect(traditionEffects('SHIELDWALL', mauled).xpMult).toBe(1)
  })

  it('"at least half" of an odd number is the LARGER half', () => {
    // Ceiling, not floor: 2 of 3 heavy foot. Rounding the requirement down would let a
    // legion be a minority of what it swore to be and still call itself in keeping.
    const three = [unit('a', 'HEAVY_INF_SWORD'), unit('b', 'HEAVY_INF_SPEAR'), unit('c', 'LIGHT_INF_SPEAR')]
    expect(outOfKeeping(def('SHIELDWALL'), three)).toBeNull()
    const worse = [unit('a', 'HEAVY_INF_SWORD'), unit('b', 'LIGHT_INF_SPEAR'), unit('c', 'LIGHT_INF_SPEAR')]
    expect(outOfKeeping(def('SHIELDWALL'), worse)).toMatch(/needs 2 of 3/)
  })

  it('a count requirement says the real numbers, not just that something is wrong', () => {
    const five = Array.from({ length: 5 }, (_, i) => unit(`u${i}`, 'HEAVY_INF_SWORD'))
    expect(outOfKeeping(def('IRON_VOW'), five)).toBe('needs 8 cohorts under arms, has 5')
    const eight = Array.from({ length: 8 }, (_, i) => unit(`u${i}`, 'HEAVY_INF_SWORD'))
    expect(outOfKeeping(def('IRON_VOW'), eight)).toBeNull()
  })

  it('an empty legion with a share requirement is quiet, not nagging', () => {
    // 0 of 0 is satisfied. A legion that has not been given cohorts yet should not be
    // scolded for a proportion it cannot possibly hold.
    expect(outOfKeeping(def('SHIELDWALL'), [])).toBeNull()
  })

  it('a tradition with no standing requirement is always in keeping', () => {
    expect(outOfKeeping(def('WINDS_OWN'), [])).toBeNull()
  })

  it('no oath means no effects, and "no effects" is the identity for both channels', () => {
    expect(traditionEffects(null, [])).toEqual({ moraleBonus: 0, xpMult: 1 })
    expect(traditionEffects('NOT_A_TRADITION', [])).toEqual({ moraleBonus: 0, xpMult: 1 })
  })
})

describe('swearing', () => {
  const cohorts = [unit('a', 'HEAVY_INF_SWORD')]

  it('refuses below the victory count, and says how far off it is', () => {
    expect(adoptBlocker(legion(['a'], null, 2), def('SHIELDWALL'), cohorts, 1e6))
      .toBe('Needs 3 victories to its name, has 2')
    expect(adoptBlocker(legion(['a'], null, 3), def('SHIELDWALL'), cohorts, 1e6)).toBeNull()
  })

  it('refuses without the copper', () => {
    expect(adoptBlocker(legion(['a'], null, 3), def('SHIELDWALL'), cohorts, 4999)).toMatch(/Costs/)
  })

  it('refuses a legion holding cohorts the oath forbids, and names what to release', () => {
    const withHorse = [unit('a', 'HEAVY_INF_SWORD'), unit('b', 'LIGHT_CAV')]
    expect(adoptBlocker(legion(['a', 'b'], null, 3), def('SHIELDWALL'), withHorse, 1e6))
      .toMatch(/Release its horsemen first/)
  })

  it('refuses a host too big for a tradition that wants a smaller one', () => {
    const seven = Array.from({ length: 7 }, (_, i) => unit(`u${i}`, 'LIGHT_CAV'))
    expect(adoptBlocker(legion(seven.map(u => u.id), null, 3), def('WINDS_OWN'), seven, 1e6))
      .toMatch(/no more than 6 cohorts/)
  })

  it('a legion swears ONCE', () => {
    expect(adoptBlocker(legion(['a'], 'SHIELDWALL', 9), def('IRON_VOW'), cohorts, 1e6))
      .toMatch(/Already sworn to The Shieldwall/)
  })

  it('ALLOWS swearing to something you have to grow into', () => {
    // Deliberate: the Iron Vow wants eight cohorts and this legion has one. That is an
    // aspiration, not a contradiction — the bonus simply sleeps until it gets there.
    expect(adoptBlocker(legion(['a'], null, 3), def('IRON_VOW'), cohorts, 1e6)).toBeNull()
    expect(outOfKeeping(def('IRON_VOW'), cohorts)).not.toBeNull()
  })

  it('counts victories, not honour lines', () => {
    expect(victoryCount([{ count: 4 }, { count: 3 }])).toBe(7)
  })
})

describe('the XP ceiling is absolute — no tradition can lift it', () => {
  const combatant = (unitId: string, kills: number): Combatant => ({
    id: 'P0', side: 'PLAYER', unitId, type: 'HEAVY_INF_SWORD', name: 'x', x: 0, y: 0,
    hp: 20, hpStart: 20, morale: 100, vet: 0, kills, hasMoved: false, hasActed: false,
    routed: false, buckets: [{ r: 'NOVICE', count: 20, avgXP: 0 }],
  })
  const battle = (kills: number): BattleState => ({
    version: 1, seed: 1, rngCursor: 0, width: 4, height: 4, terrain: {},
    combatants: [combatant('a', kills)], turn: 1, side: 'PLAYER', phase: 'RESOLVED',
    status: 'PLAYER_WON', winner: 'PLAYER', log: [], config: { lethality: 0.35, maxTurns: 20 },
    difficulty: 'BANDIT_RAID',
  })
  const xpOf = (kills: number, mult: number) =>
    applyBattleResult([unit('a', 'HEAVY_INF_SWORD')], battle(kills), ['a'], 'PLAYER', () => mult)
      .report[0].xpGain

  it('a massacre gives exactly the cap, with or without a tradition', () => {
    // 100 kills over 20 survivors is 500 raw — far past the cap either way. The cap exists
    // so that ONE battle can never manufacture veterans, and a multiplier applied after it
    // would be exactly the battle that does.
    expect(xpOf(100, 1)).toBe(XP_CAP)
    expect(xpOf(100, 1.35)).toBe(XP_CAP)
    expect(xpOf(100, 3)).toBe(XP_CAP)
  })

  it('an ordinary fight is where the tradition actually pays', () => {
    const plain = xpOf(4, 1)
    const sworn = xpOf(4, 1.35)
    expect(plain).toBe(20)
    expect(sworn).toBeGreaterThan(plain)
    expect(sworn).toBeLessThanOrEqual(XP_CAP)
  })

  it('no multiplier passed behaves exactly as before', () => {
    const before = applyBattleResult([unit('a', 'HEAVY_INF_SWORD')], battle(4), ['a'])
    expect(before.report[0].xpGain).toBe(xpOf(4, 1))
  })

  it('the boosted XP still goes through promotion, never around it', () => {
    // 99 XP + a boost crosses NOVICE's threshold of 100. Granting the bonus after the
    // write-back instead would leave these men above their own threshold, un-promoted,
    // until some later battle happened to notice.
    const near = [unit('a', 'HEAVY_INF_SWORD', 20, 99)]
    const out = applyBattleResult(near, battle(4), ['a'], 'PLAYER', () => 1.35)
    expect(out.report[0].promotions.length).toBeGreaterThan(0)
    expect(out.units[0].buckets.every(b => b.r !== 'NOVICE')).toBe(true)
  })
})

describe('resolving a whole army at once', () => {
  it('only cohorts of a legion in keeping are owed anything', () => {
    const units = [
      unit('a', 'HEAVY_INF_SWORD'), unit('b', 'HEAVY_INF_SPEAR'), // sworn + in keeping
      unit('c', 'LIGHT_INF_SPEAR'),                               // sworn but out of keeping
      unit('d', 'LIGHT_CAV'),                                     // unattached
    ]
    const map = legionEffectsByUnit([
      { unitIds: ['a', 'b'], tradition: 'SHIELDWALL' },
      { unitIds: ['c'], tradition: 'SHIELDWALL' },
      { unitIds: ['d'], tradition: null },
    ], units)
    expect(map.get('a')?.moraleBonus).toBeGreaterThan(0)
    expect(map.get('b')?.moraleBonus).toBeGreaterThan(0)
    expect(map.has('c')).toBe(false)
    expect(map.has('d')).toBe(false)
  })

  it('ignores ids whose units are gone, like every other legion read', () => {
    const map = legionEffectsByUnit(
      [{ unitIds: ['ghost', 'a'], tradition: 'SHIELDWALL' }],
      [unit('a', 'HEAVY_INF_SWORD')],
    )
    expect(map.get('a')?.moraleBonus).toBeGreaterThan(0)
    expect(map.has('ghost')).toBe(false)
  })
})

describe('the admin can retune it, but not out of its bounds', () => {
  it('what the screen promises comes from the same numbers the game applies', () => {
    GameConfig.init({ traditions: { SHIELDWALL: { moraleBonus: 7 } } })
    expect(describeTradition(def('SHIELDWALL')).gives).toContain('+7 morale')
    expect(traditionEffects('SHIELDWALL', [unit('a', 'HEAVY_INF_SWORD')]).moraleBonus).toBe(7)
  })

  it('morale cannot be tuned into never losing your nerve', () => {
    GameConfig.init({ traditions: { SHIELDWALL: { moraleBonus: 9999 } } })
    expect(traditionEffects('SHIELDWALL', [unit('a', 'HEAVY_INF_SWORD')]).moraleBonus).toBe(40)
  })

  it('a corrupt override falls back rather than turning a bonus into NaN', () => {
    GameConfig.init({ traditions: { SHIELDWALL: { xpMult: NaN } } } as never)
    expect(traditionEffects('SHIELDWALL', [unit('a', 'HEAVY_INF_SWORD')]).xpMult).toBe(1)
  })

  it('every catalogued tradition describes itself without empty fields', () => {
    for (const t of TRADITIONS) {
      const d = describeTradition(t)
      expect(d.refuses).not.toBe('')
      expect(d.keeps).not.toBe('')
      expect(d.gives).not.toBe('—') // a tradition that gives nothing is not a tradition
    }
  })
})

describe('what a save may carry', () => {
  it('a save written before traditions existed loads as no oath, not as undefined', () => {
    const [l] = hydrateLegions([{ id: 'L1', name: 'Old', foundedDay: 3, unitIds: [], honours: [] }])
    expect(l.tradition).toBeNull()
    expect(traditionEffects(l.tradition, [])).toEqual({ moraleBonus: 0, xpMult: 1 })
  })

  it('an id the catalog no longer knows reads as no oath', () => {
    // Resolved against the catalog rather than trusted, so dropping or renaming a tradition
    // cannot leave a legion sworn to rules nothing can look up.
    const [l] = hydrateLegions([
      { id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [], tradition: 'DELETED_ONE' },
    ])
    expect(l.tradition).toBeNull()
  })

  it('a real oath survives the round trip with its day', () => {
    const [l] = hydrateLegions([
      { id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [], tradition: 'IRON_VOW', traditionDay: 42 },
    ])
    expect(l.tradition).toBe('IRON_VOW')
    expect(l.traditionDay).toBe(42)
  })
})
