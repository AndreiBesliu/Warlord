import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEED_KEYS, RENOWN_KEYS, creditBattle, hydrateLedger, legionLevel, nextLevelAt,
  noCreditReason, renownForLevel, renownOf, sharesFromBattle,
  type BattleContext, type BattleShare, type DeedLedger,
} from './practice'
import { GameConfig } from './config'
import type { BattleState, Combatant } from './combat/types'
import type { UnitReport } from './combat/army'

beforeEach(() => GameConfig.init(null))

const share = (over: Partial<BattleShare> = {}): BattleShare => ({
  legionId: 'L1', fielded: 100, lost: 10, kills: 40, promotions: 0,
  killsMounted: 0, killsArcher: 0, killsHeavyFoot: 0, ...over,
})
const ctx = (over: Partial<BattleContext> = {}): BattleContext => ({
  won: true, difficulty: 'RIVAL_BARON', totalFielded: 100, ...over,
})

describe('renown cannot be bought for free — the whole point of splitting the registers', () => {
  it('retreating costs nothing, so it earns nothing', () => {
    // `abandonBattle` resolves a battle on which no command was ever issued: zero damage
    // dealt, zero taken. Start-and-retreat is two clicks. Anything renown-bearing here
    // would be a level vending machine.
    const after = creditBattle({}, share({ lost: 0, kills: 0 }), ctx({ retreated: true }))
    expect(renownOf(after)).toBe(0)
    expect(after.retreats).toBe(1)
    expect(after.battles).toBeUndefined()
  })

  it('sixty days of retreating leaves the legion at level 1', () => {
    let led: DeedLedger = {}
    for (let i = 0; i < 60; i++) {
      led = creditBattle(led, share({ lost: 0, kills: 0 }), ctx({ retreated: true }))
    }
    expect(renownOf(led)).toBe(0)
    expect(legionLevel(led)).toBe(1)
    expect(led.retreats).toBe(60)
  })

  it('losing is remembered but buys nothing', () => {
    const after = creditBattle({}, share(), ctx({ won: false }))
    expect(after.defeats).toBe(1)
    expect(after.battles).toBe(1)
    expect(renownOf(after)).toBe(0)
  })

  it('every renown key requires having won', () => {
    const lost = creditBattle({}, share({ lost: 0 }), ctx({ won: false, difficulty: 'INVASION' }))
    for (const k of RENOWN_KEYS) expect(lost[k]).toBeUndefined()
  })
})

describe('a legion is credited for a battle it actually fought', () => {
  it('a token cohort in a large host earns nothing at all', () => {
    // Five men beside a host of six hundred. Without this rule that cohort collects the
    // same victory as the twelve that bled — and collects "without a loss" too, for never
    // having been reached.
    const s = share({ fielded: 5, lost: 0, kills: 1 })
    const c = ctx({ totalFielded: 600 })
    expect(noCreditReason(s, c)).toMatch(/1% of the line/)
    expect(creditBattle({}, s, c)).toEqual({})
  })

  it('four legions can share a battle and all be credited', () => {
    const s = share({ fielded: 150 })
    expect(noCreditReason(s, ctx({ totalFielded: 600 }))).toBeNull()
  })

  it('a fifth cannot — the threshold is a real edge, not a suggestion', () => {
    expect(noCreditReason(share({ fielded: 120 }), ctx({ totalFielded: 600 }))).not.toBeNull()
  })

  it('a legion that never made contact was present, not fighting', () => {
    const s = share({ fielded: 100, lost: 0, kills: 0 })
    expect(noCreditReason(s, ctx())).toBe('never made contact')
  })

  it('taking losses counts as contact even with nothing to show for it', () => {
    expect(noCreditReason(share({ kills: 0, lost: 3 }), ctx())).toBeNull()
  })
})

describe('the two ways of being good at this are worth the same', () => {
  it('coming back without a scratch, having actually fought', () => {
    const after = creditBattle({}, share({ lost: 0, kills: 40 }), ctx())
    expect(after.flawless).toBe(1)
    expect(after.heldTheLine).toBeUndefined()
  })

  it('grinding it out bleeding', () => {
    const after = creditBattle({}, share({ fielded: 100, lost: 55 }), ctx())
    expect(after.heldTheLine).toBe(1)
    expect(after.flawless).toBeUndefined()
  })

  it('an ordinary win is neither', () => {
    const after = creditBattle({}, share({ fielded: 100, lost: 10 }), ctx())
    expect(after.flawless).toBeUndefined()
    expect(after.heldTheLine).toBeUndefined()
    expect(after.victories).toBe(1)
  })

  it('they are mutually exclusive by construction, on every loss fraction', () => {
    for (let lost = 0; lost <= 100; lost++) {
      const a = creditBattle({}, share({ fielded: 100, lost, kills: 40 }), ctx())
      expect(!!a.flawless && !!a.heldTheLine).toBe(false)
    }
  })

  it('the hardest mission is worth its own mark', () => {
    const after = creditBattle({}, share(), ctx({ difficulty: 'INVASION' }))
    expect(after.hardWon).toBe(1)
    expect(creditBattle({}, share(), ctx({ difficulty: 'BANDIT_RAID' })).hardWon).toBeUndefined()
  })
})

describe('one slaughter is not a specialisation', () => {
  it('kills are capped per battle', () => {
    const after = creditBattle({}, share({ kills: 5000, killsMounted: 5000 }), ctx())
    expect(after.slain).toBe(200)
    expect(after.slainMounted).toBe(200)
  })

  it('an admin cannot switch the cap OFF — an out-of-range value falls back to a real one', () => {
    // The getter's `num(v, fallback, min)` returns the FALLBACK below the minimum rather
    // than clamping to it, so 0 and -1 do not mean "uncapped", they mean "the default".
    // That is the property worth pinning: there is no value that removes the ceiling.
    for (const bad of [0, -1, NaN, Infinity]) {
      GameConfig.init({ legionDeeds: { killsPerBattleCap: bad } })
      expect(creditBattle({}, share({ kills: 900 }), ctx()).slain).toBe(200)
    }
  })

  it('an admin CAN tighten it', () => {
    GameConfig.init({ legionDeeds: { killsPerBattleCap: 25 } })
    expect(creditBattle({}, share({ kills: 900 }), ctx()).slain).toBe(25)
  })
})

describe('level is derived, and paced by the calendar', () => {
  it('a fresh legion is level 1 and a bare ledger is renown 0', () => {
    expect(legionLevel({})).toBe(1)
    expect(renownOf({})).toBe(0)
  })

  it('rises monotonically with renown and never past the ceiling', () => {
    let led: DeedLedger = {}
    let last = 1
    for (let i = 0; i < 200; i++) {
      led = creditBattle(led, share({ lost: 0, kills: 40 }), ctx({ difficulty: 'INVASION' }))
      const L = legionLevel(led)
      expect(L).toBeGreaterThanOrEqual(last)
      last = L
    }
    expect(last).toBe(GameConfig.legionDeeds().maxLevel)
  })

  it('an exceptional battle is worth several ordinary ones, and that is intended', () => {
    const plain = creditBattle({}, share({ lost: 10 }), ctx({ difficulty: 'BANDIT_RAID' }))
    const great = creditBattle({}, share({ lost: 0, kills: 40 }), ctx({ difficulty: 'INVASION' }))
    expect(renownOf(plain)).toBe(3)
    expect(renownOf(great)).toBe(12)
  })

  it('level 5 is roughly fifteen good battles — one per game-day', () => {
    let led: DeedLedger = {}
    let days = 0
    while (legionLevel(led) < 5 && days < 500) {
      led = creditBattle(led, share({ lost: 10 }), ctx())
      days++
    }
    expect(days).toBeGreaterThan(8)
    expect(days).toBeLessThan(40)
  })

  it('says how far the next level is, and stops saying it at the ceiling', () => {
    expect(nextLevelAt({})).toEqual({ level: 2, need: renownForLevel(2) })
    expect(nextLevelAt({ victories: 10_000 })).toBeNull()
  })

  it('a corrupt config cannot hand out the ceiling for one battle', () => {
    GameConfig.init({ legionDeeds: { levelBase: 0, levelCurve: 0 } })
    expect(legionLevel(creditBattle({}, share(), ctx()))).toBeLessThan(GameConfig.legionDeeds().maxLevel)
  })
})

describe('reducing a battle to who did what', () => {
  const combatant = (over: Partial<Combatant>): Combatant => ({
    id: 'P0', side: 'PLAYER', unitId: 'a', type: 'HEAVY_INF_SWORD', name: 'x', x: 0, y: 0,
    hp: 10, hpStart: 20, morale: 100, vet: 0, kills: 0, hasMoved: false, hasActed: false,
    routed: false, buckets: [{ r: 'NOVICE', count: 10, avgXP: 0 }], ...over,
  })
  const rep = (unitId: string, fielded: number, lost: number): UnitReport => ({
    unitId, name: unitId, type: 'HEAVY_INF_SWORD', fielded, lost, survivors: fielded - lost,
    xpGain: 0, destroyed: false, promotions: [],
  })
  const battle = (combatants: Combatant[], log: BattleState['log']): BattleState => ({
    version: 1, seed: 1, rngCursor: 0, width: 4, height: 4, terrain: {}, combatants,
    turn: 1, side: 'PLAYER', phase: 'RESOLVED', status: 'PLAYER_WON', winner: 'PLAYER',
    log, config: { lethality: 0.35, maxTurns: 20 }, difficulty: 'RIVAL_BARON',
  })

  it('attributes kills to the KIND of enemy killed, which is what a tradition will ask for', () => {
    const b = battle(
      [
        combatant({ id: 'P0', unitId: 'a', kills: 7 }),
        combatant({ id: 'E0', side: 'ENEMY', unitId: '', type: 'HEAVY_CAV' }),
        combatant({ id: 'E1', side: 'ENEMY', unitId: '', type: 'LIGHT_ARCHER' }),
      ],
      [
        { turn: 1, side: 'PLAYER', kind: 'attack', actorId: 'P0', targetId: 'E0', detail: { kills: 4 } },
        { turn: 1, side: 'PLAYER', kind: 'attack', actorId: 'P0', targetId: 'E1', detail: { kills: 3 } },
      ],
    )
    const { shares } = sharesFromBattle(b, [rep('a', 20, 10)], [{ id: 'L1', unitIds: ['a'] }])
    expect(shares[0].kills).toBe(7)
    expect(shares[0].killsMounted).toBe(4)
    expect(shares[0].killsArcher).toBe(3)
    expect(shares[0].killsHeavyFoot).toBe(0)
  })

  it('a horse archer counts for BOTH proofs, because it is both things', () => {
    const b = battle(
      [combatant({ id: 'P0', unitId: 'a', kills: 5 }), combatant({ id: 'E0', side: 'ENEMY', unitId: '', type: 'HORSE_ARCHER' })],
      [{ turn: 1, side: 'PLAYER', kind: 'attack', actorId: 'P0', targetId: 'E0', detail: { kills: 5 } }],
    )
    const { shares } = sharesFromBattle(b, [rep('a', 20, 0)], [{ id: 'L1', unitIds: ['a'] }])
    expect(shares[0].killsMounted).toBe(5)
    expect(shares[0].killsArcher).toBe(5)
  })

  it('retaliation kills count too — they were still put down by this cohort', () => {
    const b = battle(
      [combatant({ id: 'P0', unitId: 'a', kills: 2 }), combatant({ id: 'E0', side: 'ENEMY', unitId: '', type: 'HEAVY_CAV' })],
      [{ turn: 1, side: 'PLAYER', kind: 'retaliate', actorId: 'P0', targetId: 'E0', detail: { kills: 2 } }],
    )
    expect(sharesFromBattle(b, [rep('a', 20, 0)], [{ id: 'L1', unitIds: ['a'] }]).shares[0].killsMounted).toBe(2)
  })

  it('the enemy killing MY men is never credited to me', () => {
    const b = battle(
      [combatant({ id: 'P0', unitId: 'a', kills: 0 }), combatant({ id: 'E0', side: 'ENEMY', unitId: '', type: 'HEAVY_CAV' })],
      [{ turn: 1, side: 'ENEMY', kind: 'attack', actorId: 'E0', targetId: 'P0', detail: { kills: 9 } }],
    )
    const { shares } = sharesFromBattle(b, [rep('a', 20, 9)], [{ id: 'L1', unitIds: ['a'] }])
    expect(shares[0].kills).toBe(0)
    expect(shares[0].killsMounted).toBe(0)
    expect(shares[0].lost).toBe(9)
  })

  it('a snapshot naming a unit twice does not double its part in the line', () => {
    const b = battle([combatant({ id: 'P0', unitId: 'a', kills: 3 })], [])
    const { shares, totalFielded } = sharesFromBattle(b, [rep('a', 20, 5)], [{ id: 'L1', unitIds: ['a', 'a'] }])
    expect(shares[0].fielded).toBe(20)
    expect(shares[0].kills).toBe(3)
    expect(totalFielded).toBe(20)
  })

  it('ids of units that are gone are simply absent, like every other legion read', () => {
    const b = battle([combatant({ id: 'P0', unitId: 'a', kills: 3 })], [])
    const { shares } = sharesFromBattle(b, [rep('a', 20, 0)], [{ id: 'L1', unitIds: ['ghost', 'a'] }])
    expect(shares[0].fielded).toBe(20)
  })

  it('the denominator is the whole line, not one legion', () => {
    const b = battle([combatant({ id: 'P0', unitId: 'a', kills: 1 }), combatant({ id: 'P1', unitId: 'b', kills: 1 })], [])
    const { totalFielded } = sharesFromBattle(b, [rep('a', 20, 0), rep('b', 80, 0)], [{ id: 'L1', unitIds: ['a'] }])
    expect(totalFielded).toBe(100)
  })
})

describe('what a save may carry', () => {
  it('a save from before deeds existed loads as an empty record, not undefined', () => {
    for (const bad of [undefined, null, 'x', 42, []]) expect(hydrateLedger(bad)).toEqual({})
  })

  it('keys the game does not know are dropped, so the list IS the whitelist', () => {
    expect(hydrateLedger({ victories: 4, sorcery: 999 })).toEqual({ victories: 4 })
  })

  it('nonsense values are dropped rather than carried as NaN', () => {
    expect(hydrateLedger({ victories: NaN, flawless: -3, hardWon: 'many', battles: 2.6 }))
      .toEqual({ battles: 3 })
  })

  it('a ledger survives the round trip', () => {
    const led = creditBattle({}, share({ lost: 0, kills: 12 }), ctx({ difficulty: 'INVASION' }))
    expect(hydrateLedger(JSON.parse(JSON.stringify(led)))).toEqual(led)
  })

  it('every deed key is labelled, so nothing renders as a raw enum', () => {
    for (const k of DEED_KEYS) expect(hydrateLedger({ [k]: 1 })[k]).toBe(1)
  })
})
