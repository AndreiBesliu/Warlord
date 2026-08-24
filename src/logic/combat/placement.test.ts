// src/logic/combat/placement.test.ts
// The invariant no test held: NO TWO LIVING COMBATANTS MAY SHARE A TILE.
//
// `placeArmy` wrapped its row index modulo the number of spawn rows, so combatant #24 landed on
// exactly the tile of combatant #0 and every one after it buried another. Measured before the
// fix, with 25 units deployed:
//
//   P0 and P24 both at (0,7); `combatantAt` returns P0, so P24 NEVER RENDERS and can never be
//   selected by clicking its tile — yet `legalTargets` walks the combatant array directly, so
//   the enemy could target and kill it. A unit you deployed, could not see, could not command,
//   and lost anyway.
//
// It does not hang the battle (END_TURN is unconditional) and it never affected PvP
// (`sanitizeDeploy` refuses more than PVP_MAX_COMBATANTS server-side, well under capacity).
//
// This file pins the invariant itself rather than the arithmetic, so it keeps holding whatever
// the placement rule becomes.

import { describe, it, expect } from 'vitest'
import { createBattle, missionPresets, BATTLE_WIDTH, BATTLE_HEIGHT, SPAWN_ROWS, SIDE_CAPACITY } from './enemies'
import { GameConfig } from '../config'
import { Registry } from '../registry'
import type { Unit } from '../types'

Registry.init()

const mkUnit = (i: number): Unit => ({
  id: `u${i}`, name: `Cohort ${i}`, type: 'LIGHT_INF_SWORD',
  buckets: [{ r: 'NOVICE', count: 10, avgXP: 0 }],
  morale: 100, equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
} as unknown as Unit)

const sharedTiles = (cs: { id: string; x: number; y: number }[]) => {
  const seen = new Map<string, string[]>()
  for (const c of cs) {
    const k = `${c.x},${c.y}`
    seen.set(k, [...(seen.get(k) || []), c.id])
  }
  return [...seen.entries()].filter(([, ids]) => ids.length > 1)
}

describe('no two combatants may start on the same tile', () => {
  for (const n of [1, 12, 24, 25, 30, 48]) {
    it(`holds for ${n} deployed units`, () => {
      const b = createBattle(Array.from({ length: n }, (_, i) => mkUnit(i)), 'BANDIT_RAID', 4242)
      const shared = sharedTiles(b.state.combatants)
      expect(shared).toEqual([])
    })
  }

  it('and every combatant stands inside the grid', () => {
    const b = createBattle(Array.from({ length: 40 }, (_, i) => mkUnit(i)), 'INVASION', 7)
    for (const c of b.state.combatants) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThan(BATTLE_WIDTH)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThan(BATTLE_HEIGHT)
    }
  })

  it('spills inward instead of wrapping, and stays out of the enemy half', () => {
    // 48 is the structural limit — half a 12x8 board. The DESIGN limit is SIDE_CAPACITY (24, the
    // two spawn rows), refused at the deploy screen; the spill between the two exists so that a
    // miss there degrades into "crowded" rather than back into "invisible".
    const b = createBattle(Array.from({ length: 48 }, (_, i) => mkUnit(i)), 'INVASION', 3)
    const player = b.state.combatants.filter(c => c.side === 'PLAYER')
    const enemy = b.state.combatants.filter(c => c.side === 'ENEMY')
    expect(Math.min(...player.map(c => c.y))).toBeGreaterThanOrEqual(BATTLE_HEIGHT / 2)
    expect(Math.max(...enemy.map(c => c.y))).toBeLessThan(BATTLE_HEIGHT / 2)
  })

  it('the design cap is the two spawn rows, and it is what the picker enforces', () => {
    expect(SIDE_CAPACITY).toBe(BATTLE_WIDTH * SPAWN_ROWS)
    expect(SIDE_CAPACITY).toBe(24)
  })

  it('an admin cannot raise the enemy count above what the field holds', () => {
    // The ceiling lives in the GETTER, not in the defaults — the same rule the recruit-source
    // rank cap is written under. A limit only in the defaults is one the config panel walks past.
    GameConfig.init({ missions: { INVASION: { maxTokens: 500 } } } as never)
    try {
      expect(missionPresets().INVASION.maxTokens).toBeLessThanOrEqual(SIDE_CAPACITY)
    } finally {
      GameConfig.init(null)
    }
  })

  it('never silently drops a unit the player committed', () => {
    // Losing a cohort you chose is worse than the bug this file is about: the player paid for
    // it, formed it, and marched it. Whatever the cap becomes, the refusal happens BEFORE the
    // battle, never by quietly leaving men off the field.
    const n = 40
    const b = createBattle(Array.from({ length: n }, (_, i) => mkUnit(i)), 'BANDIT_RAID', 11)
    expect(b.state.combatants.filter(c => c.side === 'PLAYER')).toHaveLength(n)
    expect(b.deployedIds).toHaveLength(n)
  })
})

describe('nobody lines up in terrain they did not choose', () => {
  it('keeps forest off every spawn row, both edges', () => {
    // The guard used to spare one row per edge while its comment promised two.
    for (let seed = 0; seed < 40; seed++) {
      const b = createBattle([mkUnit(0)], 'INVASION', seed)
      for (let y = 0; y < BATTLE_HEIGHT; y++) {
        const spawnRow = y < SPAWN_ROWS || y >= BATTLE_HEIGHT - SPAWN_ROWS
        if (!spawnRow) continue
        expect(b.state.terrain[String(y)].filter(t => t === 'FOREST')).toEqual([])
      }
    }
  })

  it('and no combatant starts on anything but open ground', () => {
    for (let seed = 0; seed < 40; seed++) {
      const b = createBattle(Array.from({ length: 24 }, (_, i) => mkUnit(i)), 'INVASION', seed)
      for (const c of b.state.combatants) {
        expect(b.state.terrain[String(c.y)][c.x]).toBe('PLAINS')
      }
    }
  })
})
