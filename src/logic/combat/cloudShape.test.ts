// src/logic/combat/cloudShape.test.ts
// Nothing a battle puts in the save may hold `undefined`.
//
// `army.ts` wrote `loadoutWeapon: u.loadout?.weapon as Weapon | undefined` — an UNCONDITIONAL
// key. Real units carry `loadout: { kind: type }` with no weapon, so it was undefined for every
// player combatant in every PvE battle. localStorage never noticed: `JSON.stringify` drops
// undefined keys. The cloud write is handed the LIVE object, and Firestore refuses outright —
// reproduced against firebase 11.10.0:
//
//   Function setDoc() called with invalid data. Unsupported field value: undefined
//
// So for the whole duration of a battle, the domain stopped syncing, and nothing said so. The
// player found out by opening the game on another device and finding it stale.
//
// The rule is general, which is why this test walks the whole structure rather than naming the
// one field: build the object without the key, never with the key set to undefined.

import { describe, it, expect } from 'vitest'
import { createBattle } from './enemies'
import { Registry } from '../registry'
import type { Unit } from '../types'

Registry.init()

const mkUnit = (i: number): Unit => ({
  id: `u${i}`, name: `Cohort ${i}`, type: 'LIGHT_INF_SWORD',
  buckets: [{ r: 'NOVICE', count: 10, avgXP: 0 }],
  morale: 100, equip: { weapons: {}, armors: {}, horses: {} }, loadout: { kind: 'LIGHT_INF_SWORD' },
} as unknown as Unit)

/** Every path whose value is literally `undefined` — exactly what Firestore rejects. */
const undefinedPaths = (o: unknown, path = ''): string[] => {
  if (!o || typeof o !== 'object') return []
  const out: string[] = []
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (v === undefined) out.push(`${path}${k}`)
    else out.push(...undefinedPaths(v, `${path}${k}.`))
  }
  return out
}

describe('a battle state must be writable to Firestore', () => {
  for (const d of ['BANDIT_RAID', 'RIVAL_BARON', 'INVASION'] as const) {
    it(`holds no undefined values for ${d}`, () => {
      const b = createBattle([mkUnit(0), mkUnit(1), mkUnit(2)], d, 8181)
      expect(undefinedPaths(b.state)).toEqual([])
    })
  }

  it('and the whole CreatedBattle, not only the state', () => {
    const b = createBattle(Array.from({ length: 20 }, (_, i) => mkUnit(i)), 'INVASION', 5)
    expect(undefinedPaths(b)).toEqual([])
  })

  it('omits loadoutWeapon rather than setting it to undefined', () => {
    const b = createBattle([mkUnit(0)], 'BANDIT_RAID', 1)
    const c = b.state.combatants.find(x => x.side === 'PLAYER')!
    expect('loadoutWeapon' in c).toBe(false)
  })

  it('but keeps it when the unit really carries one', () => {
    const armed = { ...mkUnit(0), loadout: { kind: 'LIGHT_INF_SWORD', weapon: 'SWORD' } } as unknown as Unit
    const b = createBattle([armed], 'BANDIT_RAID', 1)
    const c = b.state.combatants.find(x => x.side === 'PLAYER')!
    expect(c.loadoutWeapon).toBe('SWORD')
  })
})
