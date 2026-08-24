// src/logic/combat/ai.test.ts
// What the enemy AI does, and — the part that had no coverage at all — what it does when it
// decides to do NOTHING. Silence was its most common output and the hardest thing to debug,
// because "issued no command" and "was never considered" look identical from outside.

import { describe, it, expect } from 'vitest'
import { buildBattle, applyCommand } from './engine'
import { planEnemyTurn, chooseEnemyCommands } from './ai'
import { AI_RULES, AI_RULE_BY_ID } from './aiRules'
import { replayEnemyTurns, syntheticCohorts } from './aiReplay'
import { Registry } from '../registry'
import { GameConfig } from '../config'
import type { BattleState, Combatant, Side, TerrainType } from './types'
import { RankNumber, type Rank, type SoldierType } from '../types'

Registry.init()

const plains = (w: number, h: number): Record<string, TerrainType[]> => {
  const o: Record<string, TerrainType[]> = {}
  for (let y = 0; y < h; y++) o[String(y)] = Array<TerrainType>(w).fill('PLAINS')
  return o
}

const mk = (id: string, side: Side, type: SoldierType, count: number, x: number, y: number, rank: Rank = 'TRAINED'): Combatant => ({
  id, side, unitId: side === 'PLAYER' ? 'u_' + id : '', type, name: `${type}-${id}`,
  x, y, hp: count, hpStart: count, morale: 100, vet: RankNumber[rank],
  kills: 0, hasMoved: false, hasActed: false, routed: false,
  buckets: [{ r: rank, count, avgXP: 20 }],
})

const enemyTurn = (players: Combatant[], enemies: Combatant[]): BattleState => {
  const s = buildBattle({
    playerCombatants: players, enemyCombatants: enemies,
    terrain: plains(12, 8), width: 12, height: 8, seed: 777, difficulty: 'BANDIT_RAID',
  })
  return applyCommand(s, { kind: 'END_TURN' }) // hand the turn to the enemy
}

describe('the rulebook is intact', () => {
  it('has no duplicate ids', () => {
    expect(new Set(AI_RULES.map(r => r.id)).size).toBe(AI_RULES.length)
  })

  it('every rule says what it does and why, in its own words', () => {
    for (const r of AI_RULES) {
      expect(r.name.length).toBeGreaterThan(4)
      expect(r.effect.length).toBeGreaterThan(20)
      expect(r.why.length).toBeGreaterThan(20)
    }
  })

  it('every rule a trace cites really exists', () => {
    const s = enemyTurn(
      [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 6)],
      [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 5, 1), mk('E1', 'ENEMY', 'LIGHT_ARCHER', 20, 7, 1)],
    )
    const { trace } = planEnemyTurn(s)
    const cited = [...trace.rules, ...trace.units.flatMap(u => u.rules)]
    expect(cited.length).toBeGreaterThan(0)
    for (const id of cited) expect(AI_RULE_BY_ID[id], `unknown rule ${id}`).toBeTruthy()
  })
})

describe('every cohort accounts for itself', () => {
  it('gives one trace row per living enemy, each with a decision and a reason', () => {
    const s = enemyTurn(
      [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 6)],
      [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 5, 1), mk('E1', 'ENEMY', 'LIGHT_ARCHER', 20, 7, 1)],
    )
    const { trace } = planEnemyTurn(s)
    expect(trace.units.map(u => u.id)).toEqual(['E0', 'E1'])
    for (const u of trace.units) {
      expect(u.detail.length).toBeGreaterThan(10)
      expect(u.rules.length).toBeGreaterThan(0)
    }
  })

  it('the trace never changes the commands', () => {
    const s = enemyTurn(
      [mk('P0', 'PLAYER', 'HEAVY_INF_SWORD', 50, 4, 6), mk('P1', 'PLAYER', 'LIGHT_ARCHER', 20, 8, 6)],
      [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 4, 1), mk('E1', 'ENEMY', 'HEAVY_ARCHER', 25, 8, 1)],
    )
    expect(planEnemyTurn(s).commands).toEqual(chooseEnemyCommands(s))
  })

  it('refuses a turn that is not its own, and says which', () => {
    const s = buildBattle({
      playerCombatants: [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 6)],
      enemyCombatants: [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 5, 1)],
      terrain: plains(12, 8), width: 12, height: 8, seed: 1, difficulty: 'BANDIT_RAID',
    })
    const { commands, trace } = planEnemyTurn(s) // still the PLAYER turn
    expect(commands).toEqual([{ kind: 'END_TURN' }])
    expect(trace.rules).toContain('TURN_ONLY_WHEN_ACTIVE')
    expect(trace.note).toMatch(/not the enemy/i)
  })
})

describe('THE FREEZE: a claimed kill must not empty the battlefield', () => {
  // One player cohort, nearly dead, in reach of E0. E0 books the kill. E1 and E2 are far away
  // with no shot. Before the fix, the within-turn ledger was also the list the ADVANCE walked,
  // so once E0 booked the only cohort as dead, `players` came back empty and E1/E2 returned null
  // — no attack AND no step. If the real damage roll then under-rolled, the player survived
  // against an army that had not moved.
  const board = () => enemyTurn(
    [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 1, 5, 6)],
    [
      mk('E0', 'ENEMY', 'HEAVY_CAV', 60, 5, 5),
      mk('E1', 'ENEMY', 'HEAVY_INF_SWORD', 40, 1, 1),
      mk('E2', 'ENEMY', 'HEAVY_INF_SWORD', 40, 10, 1),
    ],
  )

  it('the cohorts behind still march', () => {
    const { trace } = planEnemyTurn(board())
    const e1 = trace.units.find(u => u.id === 'E1')!
    const e2 = trace.units.find(u => u.id === 'E2')!
    expect(e1.decision).toBe('ADVANCE')
    expect(e2.decision).toBe('ADVANCE')
    expect(e1.rules).toContain('UNIT_ADVANCE_TOWARD_ANY_FOE')
  })

  it('and they actually issue MOVE commands', () => {
    const cmds = chooseEnemyCommands(board())
    const movers = cmds.filter(c => c.kind === 'MOVE').map(c => (c as { id: string }).id)
    expect(movers).toContain('E1')
    expect(movers).toContain('E2')
  })

  it('while the booking still stops the whole army piling onto one dying cohort', () => {
    // Three cohorts all in reach of one nearly-dead target: only ONE should attack it.
    const s = enemyTurn(
      [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 1, 5, 4)],
      [
        mk('E0', 'ENEMY', 'HEAVY_CAV', 60, 5, 3),
        mk('E1', 'ENEMY', 'HEAVY_CAV', 60, 4, 3),
        mk('E2', 'ENEMY', 'HEAVY_CAV', 60, 6, 3),
      ],
    )
    const attacks = chooseEnemyCommands(s).filter(c => c.kind === 'ATTACK')
    expect(attacks).toHaveLength(1)
  })
})

describe('THE ADVANCE: it closes on whoever it can actually reach', () => {
  it('does not fix on the nearest cohort when another is the one it can approach', () => {
    // P_NEAR sits behind a wall of the enemy's own cohorts, so no tile closes on it.
    // P_FAR is in the open. The old advance chose the nearest and gave up.
    const wall = [3, 4, 5, 6, 7].map((x, i) => mk(`E${i + 1}`, 'ENEMY', 'HEAVY_INF_SPEAR', 30, x, 3))
    const s = enemyTurn(
      [mk('PN', 'PLAYER', 'LIGHT_INF_SPEAR', 30, 5, 2), mk('PF', 'PLAYER', 'LIGHT_INF_SPEAR', 30, 11, 7)],
      [mk('E0', 'ENEMY', 'HEAVY_INF_SWORD', 40, 5, 4), ...wall],
    )
    const e0 = planEnemyTurn(s).trace.units.find(u => u.id === 'E0')!
    expect(['ADVANCE', 'MOVE_AND_ATTACK', 'ATTACK']).toContain(e0.decision)
    expect(e0.decision).not.toBe('HOLD')
  })

  it('holds when nothing closes, and the trace says exactly why', () => {
    // Boxed in on every side by its own cohorts, with the enemy beyond them.
    const box = [
      [4, 3], [5, 3], [6, 3], [4, 4], [6, 4], [4, 5], [5, 5], [6, 5],
    ].map(([x, y], i) => mk(`E${i + 1}`, 'ENEMY', 'HEAVY_INF_SPEAR', 30, x, y))
    const s = enemyTurn(
      [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 30, 11, 7)],
      [mk('E0', 'ENEMY', 'HEAVY_INF_SWORD', 40, 5, 4), ...box],
    )
    const e0 = planEnemyTurn(s).trace.units.find(u => u.id === 'E0')!
    expect(e0.decision).toBe('HOLD')
    expect(e0.rules).toContain('UNIT_HOLDS_WHEN_BOXED_IN')
    expect(e0.detail).toMatch(/Holds/)
  })
})

describe('THE STAT PROFILE: it plans from what the engine will enforce', () => {
  // The planner used to resolve stats WITHOUT statsOverride while the engine resolves them WITH
  // it, so it could queue a shot the reducer then refused — the cohort moved and then did
  // nothing, and the reason appeared nowhere. A DIFFERENTIAL test, because the bug is a
  // disagreement: the identical board must plan differently once the override is visible.
  const board = (withOverride: boolean) => {
    const e = mk('E0', 'ENEMY', 'LIGHT_INF_SWORD', 30, 5, 0)
    if (withOverride) e.statsOverride = { range: 6 } as Combatant['statsOverride']
    return enemyTurn([mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 7)], [e])
  }
  const attacksOf = (withOverride: boolean) =>
    chooseEnemyCommands(board(withOverride)).filter(c => c.kind === 'ATTACK')

  it('a sword cohort seven tiles away cannot reach, so it only closes', () => {
    expect(attacksOf(false)).toHaveLength(0)
    expect(planEnemyTurn(board(false)).trace.units[0].decision).toBe('ADVANCE')
  })

  it('but given the reach the engine would grant it, it strikes', () => {
    expect(attacksOf(true).length).toBeGreaterThan(0)
    expect(planEnemyTurn(board(true)).trace.units[0].rules).toContain('UNIT_STATS_WITH_OVERRIDE')
  })
})

describe('determinism survives the trace', () => {
  it('identical state gives identical commands AND identical reasoning', () => {
    const build = () => enemyTurn(
      [mk('P0', 'PLAYER', 'HEAVY_INF_SWORD', 50, 4, 6), mk('P1', 'PLAYER', 'LIGHT_ARCHER', 20, 8, 6)],
      [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 4, 1), mk('E1', 'ENEMY', 'HEAVY_ARCHER', 25, 8, 1)],
    )
    const a = planEnemyTurn(build())
    const b = planEnemyTurn(build())
    expect(a.commands).toEqual(b.commands)
    expect(a.trace).toEqual(b.trace)
  })
})

describe('the replay the admin runs', () => {
  it('terminates on every difficulty and returns a trace per enemy turn', () => {
    for (const d of ['BANDIT_RAID', 'RIVAL_BARON', 'INVASION'] as const) {
      const r = replayEnemyTurns(syntheticCohorts(4, 40), d, 4242, 10)
      expect(r.turns.length).toBeGreaterThan(0)
      expect(r.turns.length).toBeLessThanOrEqual(10)
      expect(r.playerCohorts).toBe(4)
      expect(r.enemyCohorts).toBeGreaterThan(0)
      for (const t of r.turns) expect(t.units.length).toBeGreaterThan(0)
    }
  })

  it('cannot hang, even at the smallest cap', () => {
    // The guard, not the battle, is what bounds this. An AI that held every cohort every turn
    // would otherwise loop until the tab died — and that is exactly the failure this tool exists
    // to find, so it has to survive meeting it.
    const r = replayEnemyTurns(syntheticCohorts(1, 10), 'INVASION', 7, 1)
    expect(r.turns.length).toBeLessThanOrEqual(1)
  })

  it('is exactly reproducible from its seed — otherwise the admin would be guessing', () => {
    const a = replayEnemyTurns(syntheticCohorts(3, 30), 'RIVAL_BARON', 909, 6)
    const b = replayEnemyTurns(syntheticCohorts(3, 30), 'RIVAL_BARON', 909, 6)
    expect(a).toEqual(b)
  })

  it('different seeds really do give different battles', () => {
    const a = replayEnemyTurns(syntheticCohorts(3, 30), 'RIVAL_BARON', 1, 6)
    const b = replayEnemyTurns(syntheticCohorts(3, 30), 'RIVAL_BARON', 2, 6)
    expect(a).not.toEqual(b)
  })

  it('survives a lone cohort against the hardest mission', () => {
    const r = replayEnemyTurns(syntheticCohorts(1, 1), 'INVASION', 31337, 20)
    expect(r.outcome.length).toBeGreaterThan(0)
    for (const t of r.turns) for (const u of t.units) expect(u.detail.length).toBeGreaterThan(10)
  })
})

describe('the trace does not credit rules that shaped a REJECTED option', () => {
  // An archer with a foe in its face and another at range. The distant shot wins. If the fired
  // rules were pooled across every candidate — as they were at first — the trace would cite
  // "archers do not want to be in contact" on a decision that was never in contact. A rule cited
  // on the chosen action when it shaped a rejected one is exactly the plausible-looking lie this
  // whole trace exists to prevent.
  const s = enemyTurn(
    [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 2), mk('P1', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 6)],
    [mk('E0', 'ENEMY', 'LIGHT_ARCHER', 30, 5, 3)],
  )
  const t = planEnemyTurn(s).trace.units.find(u => u.id === 'E0')!

  it('cites what chose the action', () => {
    expect(t.decision).toMatch(/ATTACK/)
    expect(t.rules).toContain('UNIT_SCORE_DAMAGE_SHARE')
  })

  it('and keeps the rest in `weighed`, never in `rules`', () => {
    expect(t.rules.filter(r => t.weighed.includes(r))).toEqual([])
  })

  it('the melee penalty is weighed, not credited', () => {
    // Unconditional on purpose. Wrapped in `if (distance > 1)` this would keep passing the day
    // the archer started choosing the melee target, which is precisely when it should fail.
    expect(t.target?.distance).toBeGreaterThan(1)
    expect(t.rules).not.toContain('UNIT_RANGED_AVOIDS_MELEE')
    expect(t.weighed).toContain('UNIT_RANGED_AVOIDS_MELEE')
    expect(t.rules).toContain('UNIT_RANGED_PREFERS_DISTANCE')
  })

  it('every rule in either list is a real rule', () => {
    for (const id of [...t.rules, ...t.weighed]) expect(AI_RULE_BY_ID[id], id).toBeTruthy()
  })
})

describe('the replay runs against a configuration it can name', () => {
  it('leaves the global config exactly as it found it', () => {
    GameConfig.init({ missions: { INVASION: { maxTokens: 3 } } } as never)
    const before = JSON.stringify(GameConfig.raw())
    replayEnemyTurns(syntheticCohorts(2, 20), 'INVASION', 5, 3, { missions: { BANDIT_RAID: { ratio: 9 } } } as never)
    expect(JSON.stringify(GameConfig.raw())).toBe(before)
    GameConfig.init(null)
  })

  it('is a function of its ARGUMENTS, not of whatever the process happens to hold', () => {
    // This is the bug: createBattle resolves mission presets through the global, so the same
    // (difficulty, seed, army) gave different battles depending on whether the config had loaded.
    const args = [syntheticCohorts(3, 30), 'INVASION' as const, 4242, 4] as const
    GameConfig.init(null)
    const a = replayEnemyTurns(...args, {})
    GameConfig.init({ missions: { INVASION: { minTokens: 2, maxTokens: 2 } } } as never)
    const b = replayEnemyTurns(...args, {})
    GameConfig.init(null)
    expect(a).toEqual(b)
  })

  it('and a different configuration really does give a different battle', () => {
    const args = [syntheticCohorts(3, 30), 'INVASION' as const, 4242, 4] as const
    const plain = replayEnemyTurns(...args, {})
    // BOTH bounds: `maxTokens` alone is raised back to `minTokens` by the getter's own clamp —
    // which is today's ceiling fix working, not a test problem.
    const tuned = replayEnemyTurns(...args, { missions: { INVASION: { minTokens: 2, maxTokens: 2 } } } as never)
    expect(plain.ranAgainst).toBe('defaults')
    expect(tuned.ranAgainst).toBe('overrides')
    expect(tuned.enemyCohorts).not.toBe(plain.enemyCohorts)
  })
})
