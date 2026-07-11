import { describe, it, expect } from 'vitest'
import type { Rank, SoldierType, Unit } from '../types'
import { RankNumber } from '../types'
import type { BattleState, Combatant, Command, Side, TerrainType } from './types'
import { applyCommand, buildBattle, estimateKills, combatantById } from './engine'
import { chooseEnemyCommands } from './ai'
import { createBattle } from './enemies'
import { unitToCombatant, applyBattleResult } from './army'
import { weaponVsMounted, weaponVsArmor } from './stats'
import { Registry } from '../registry'

// Mirror the app: with the Registry initialized, unit defs exist but `equip` is empty,
// so fieldedStrength falls back to full headcount (the case combat actually runs in).
Registry.init()

// ---- helpers ----

function plains(w: number, h: number): Record<string, TerrainType[]> {
  const o: Record<string, TerrainType[]> = {}
  for (let y = 0; y < h; y++) o[String(y)] = Array<TerrainType>(w).fill('PLAINS')
  return o
}

function mk(id: string, side: Side, type: SoldierType, count: number, x: number, y: number, rank: Rank = 'TRAINED'): Combatant {
  return {
    id, side, unitId: side === 'PLAYER' ? 'u_' + id : '', type, name: type,
    x, y, hp: count, hpStart: count, morale: 100, vet: RankNumber[rank],
    kills: 0, hasMoved: false, hasActed: false, routed: false,
    buckets: [{ r: rank, count, avgXP: 20 }],
  }
}

function makeUnit(id: string, type: SoldierType, buckets: { r: Rank; count: number; avgXP: number }[]): Unit {
  return {
    id, type, buckets, avgXP: 20, training: false, morale: 100,
    equip: { weapons: {}, armors: {}, horses: {} }, loadout: { kind: type },
  }
}

function runSeq(start: BattleState, seq: Command[]): BattleState {
  return seq.reduce((s, c) => applyCommand(s, c), start)
}

// ---- tests ----

describe('determinism', () => {
  it('same seed + same commands → identical final state', () => {
    const build = () => buildBattle({
      playerCombatants: [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 4)],
      enemyCombatants: [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 5, 3)],
      terrain: plains(12, 8), width: 12, height: 8, seed: 12345, difficulty: 'BANDIT_RAID',
    })
    const seq: Command[] = [
      { kind: 'ATTACK', id: 'P0', targetId: 'E0' },
      { kind: 'END_TURN' },
      { kind: 'ATTACK', id: 'E0', targetId: 'P0' },
      { kind: 'END_TURN' },
      { kind: 'ATTACK', id: 'P0', targetId: 'E0' },
      { kind: 'END_TURN' },
    ]
    const a = runSeq(build(), seq)
    const b = runSeq(build(), seq)
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })

  it('serialize/resume mid-battle → identical to uninterrupted run', () => {
    const build = () => buildBattle({
      playerCombatants: [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 4)],
      enemyCombatants: [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 5, 3)],
      terrain: plains(12, 8), width: 12, height: 8, seed: 999, difficulty: 'BANDIT_RAID',
    })
    const seq: Command[] = [
      { kind: 'ATTACK', id: 'P0', targetId: 'E0' },
      { kind: 'END_TURN' },
      { kind: 'ATTACK', id: 'E0', targetId: 'P0' },
      { kind: 'END_TURN' },
      { kind: 'ATTACK', id: 'P0', targetId: 'E0' },
    ]
    const uninterrupted = runSeq(build(), seq)
    let mid = runSeq(build(), seq.slice(0, 2))
    mid = JSON.parse(JSON.stringify(mid)) as BattleState // round-trip through JSON
    const resumed = runSeq(mid, seq.slice(2))
    expect(JSON.stringify(resumed)).toEqual(JSON.stringify(uninterrupted))
  })

  it('AI is a pure function of state (identical output, no rng consumed)', () => {
    let s = buildBattle({
      playerCombatants: [mk('P0', 'PLAYER', 'LIGHT_INF_SWORD', 40, 5, 5), mk('P1', 'PLAYER', 'LIGHT_ARCHER', 30, 6, 5)],
      enemyCombatants: [mk('E0', 'ENEMY', 'LIGHT_CAV', 30, 5, 2), mk('E1', 'ENEMY', 'LIGHT_INF_SWORD', 35, 6, 2)],
      terrain: plains(12, 8), width: 12, height: 8, seed: 7, difficulty: 'RIVAL_BARON',
    })
    s = applyCommand(s, { kind: 'END_TURN' }) // hand turn to ENEMY
    const cursorBefore = s.rngCursor
    const a = chooseEnemyCommands(s)
    const b = chooseEnemyCommands(s)
    expect(a).toEqual(b)
    expect(s.rngCursor).toEqual(cursorBefore) // planning must not consume battle rng
    expect(a[a.length - 1]).toEqual({ kind: 'END_TURN' })
  })
})

describe('counters (rock-paper-scissors)', () => {
  it('counter tables encode the intended relationships', () => {
    expect(weaponVsMounted.spear).toBeCloseTo(1.75)
    expect(weaponVsMounted.spear).toBeGreaterThan(weaponVsMounted.sword)
    expect(weaponVsArmor.bow.heavy).toBeLessThan(weaponVsArmor.bow.light)
    expect(weaponVsArmor.halberd.heavy).toBeGreaterThan(weaponVsArmor.sword.heavy)
  })

  it('spear kills more vs cavalry than vs equivalent infantry', () => {
    const s = buildBattle({
      playerCombatants: [mk('P0', 'PLAYER', 'LIGHT_INF_SPEAR', 40, 5, 4)],
      enemyCombatants: [mk('E0', 'ENEMY', 'LIGHT_CAV', 40, 5, 3), mk('E1', 'ENEMY', 'LIGHT_INF_SWORD', 40, 6, 3)],
      terrain: plains(12, 8), width: 12, height: 8, seed: 1, difficulty: 'BANDIT_RAID',
    })
    const spear = combatantById(s, 'P0')!
    const vsCav = estimateKills(s, spear, combatantById(s, 'E0')!, { isMelee: true })
    const vsInf = estimateKills(s, spear, combatantById(s, 'E1')!, { isMelee: true })
    expect(vsCav).toBeGreaterThan(vsInf)
  })

  it('archers barely dent heavy armor but shred light', () => {
    const s = buildBattle({
      playerCombatants: [mk('P0', 'PLAYER', 'LIGHT_ARCHER', 30, 5, 5)],
      enemyCombatants: [mk('E0', 'ENEMY', 'HEAVY_INF_SWORD', 40, 5, 3), mk('E1', 'ENEMY', 'LIGHT_INF_SWORD', 40, 6, 3)],
      terrain: plains(12, 8), width: 12, height: 8, seed: 2, difficulty: 'BANDIT_RAID',
    })
    const archer = combatantById(s, 'P0')!
    const vsHeavy = estimateKills(s, archer, combatantById(s, 'E0')!, { isMelee: false })
    const vsLight = estimateKills(s, archer, combatantById(s, 'E1')!, { isMelee: false })
    expect(vsLight).toBeGreaterThan(vsHeavy)
  })
})

describe('casualty write-back', () => {
  it('conserves soldiers and removes destroyed units', () => {
    const units = [
      makeUnit('u_P0', 'LIGHT_INF_SPEAR', [{ r: 'NOVICE', count: 20, avgXP: 0 }, { r: 'VETERAN', count: 20, avgXP: 80 }]),
      makeUnit('u_keep', 'LIGHT_ARCHER', [{ r: 'TRAINED', count: 15, avgXP: 30 }]),
    ]
    // Fabricate a finished battle where the deployed unit survives with 25 of 40.
    const combatant = unitToCombatant(units[0], 'PLAYER', 0)
    combatant.hp = 25
    combatant.kills = 18
    const finalState: BattleState = {
      version: 1, seed: 1, rngCursor: 0, width: 12, height: 8, terrain: plains(12, 8),
      combatants: [combatant], turn: 3, side: 'PLAYER', phase: 'RESOLVED',
      status: 'PLAYER_WON', winner: 'PLAYER', log: [], config: { lethality: 0.35, maxTurns: 40 },
      difficulty: 'BANDIT_RAID',
    }
    const before = units[0].buckets.reduce((a, b) => a + b.count, 0)
    const out = applyBattleResult(units, finalState, ['u_P0'])
    expect(out.won).toBe(true)
    expect(out.totalLosses).toBe(before - 25) // 15 died
    const survivor = out.units.find((u) => u.id === 'u_P0')!
    const after = survivor.buckets.reduce((a, b) => a + b.count, 0)
    expect(after).toBe(25)
    // undeployed unit untouched
    expect(out.units.find((u) => u.id === 'u_keep')).toBeTruthy()
  })

  it('veterans survive preferentially (NOVICE emptied first)', () => {
    const units = [makeUnit('u_P0', 'HEAVY_INF_SPEAR', [
      { r: 'NOVICE', count: 10, avgXP: 0 },
      { r: 'VETERAN', count: 10, avgXP: 80 },
    ])]
    const c = unitToCombatant(units[0], 'PLAYER', 0)
    c.hp = 12 // 8 die out of 20
    const finalState: BattleState = {
      version: 1, seed: 1, rngCursor: 0, width: 12, height: 8, terrain: plains(12, 8),
      combatants: [c], turn: 2, side: 'PLAYER', phase: 'RESOLVED',
      status: 'PLAYER_WON', winner: 'PLAYER', log: [], config: { lethality: 0.35, maxTurns: 40 },
      difficulty: 'BANDIT_RAID',
    }
    const out = applyBattleResult(units, finalState, ['u_P0'])
    const survivor = out.units.find((u) => u.id === 'u_P0')!
    const novice = survivor.buckets.find((b) => b.r === 'NOVICE')?.count ?? 0
    const veteran = survivor.buckets.find((b) => b.r === 'VETERAN')?.count ?? 0
    expect(novice).toBe(2) // 8 of 10 novices died
    expect(veteran).toBe(10) // all veterans held
  })

  it('destroyed unit (0 hp) is dropped from the army', () => {
    const units = [makeUnit('u_P0', 'LIGHT_ARCHER', [{ r: 'NOVICE', count: 12, avgXP: 0 }])]
    const c = unitToCombatant(units[0], 'PLAYER', 0)
    c.hp = 0
    const finalState: BattleState = {
      version: 1, seed: 1, rngCursor: 0, width: 12, height: 8, terrain: plains(12, 8),
      combatants: [], turn: 2, side: 'ENEMY', phase: 'RESOLVED',
      status: 'ENEMY_WON', winner: 'ENEMY', log: [], config: { lethality: 0.35, maxTurns: 40 },
      difficulty: 'BANDIT_RAID',
    }
    const out = applyBattleResult(units, finalState, ['u_P0'])
    expect(out.units.length).toBe(0)
    expect(out.destroyed).toBe(1)
  })
})

describe('full battle via createBattle + AI plays to resolution', () => {
  it('resolves deterministically', () => {
    const playerUnits = [
      makeUnit('u1', 'HEAVY_INF_SPEAR', [{ r: 'VETERAN', count: 40, avgXP: 80 }]),
      makeUnit('u2', 'LIGHT_ARCHER', [{ r: 'ADVANCED', count: 30, avgXP: 50 }]),
      makeUnit('u3', 'LIGHT_CAV', [{ r: 'TRAINED', count: 20, avgXP: 30 }]),
    ]
    const play = (): BattleState => {
      const { state } = createBattle(playerUnits, 'BANDIT_RAID', 4242)
      let s = state
      let guard = 0
      while (s.status === 'ONGOING' && guard < 500) {
        guard++
        if (s.side === 'ENEMY') {
          for (const cmd of chooseEnemyCommands(s)) s = applyCommand(s, cmd)
        } else {
          // trivial player policy: each unit attacks any legal target, else advances, then end turn
          for (const c of s.combatants.filter((x) => x.side === 'PLAYER' && x.hp > 0 && !x.routed)) {
            // (uses engine's own legality; keep it simple and deterministic)
            const targets = s.combatants.filter((t) => t.side === 'ENEMY' && t.hp > 0)
            if (!targets.length) break
            s = applyCommand(s, { kind: 'ATTACK', id: c.id, targetId: targets[0].id })
          }
          s = applyCommand(s, { kind: 'END_TURN' })
        }
      }
      return s
    }
    const a = play()
    const b = play()
    expect(a.status).not.toBe('ONGOING')
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })
})
