import { describe, it, expect } from 'vitest'
import {
  demandFor, equipFromDemand, addEquip, releaseEquip, equipIsEmpty,
} from './equipment'
import { computeEquipped, computeReady, missingEquipmentList, splitUnit, mergeUnits } from './units'
import { fieldedStrength } from './combat/army'
import { makeEmptyInventories } from './helpers'
import { hydrateUnits } from '../state/useUnits'
import { Registry } from './registry'
import { SoldierTypes, type SoldierType, type Unit } from './types'

// `requiredCountsFor` reads the Registry, and an uninitialised Registry returns an EMPTY
// requirement — which makes `computeEquipped` report every unit fully equipped no matter
// what it carries. The app initialises it at mount; a test that forgets would pass for
// entirely the wrong reason.
Registry.init()

// The army loop had ZERO test coverage, which is exactly why a renamed prop shipped and
// left the army un-startable: `Create Unit` threw on every press, silently. These pin the
// invariants that make "a unit you paid for" mean something.

const unitOf = (type: SoldierType, size: number, equipped = true): Unit => ({
  id: 'U_test',
  type,
  buckets: [{ r: 'NOVICE', count: size, avgXP: 0 }],
  avgXP: 0,
  training: false,
  morale: 100,
  equip: equipped ? equipFromDemand(demandFor(type, size)) : { weapons: {}, armors: {}, horses: {} },
  loadout: { kind: type },
})

describe('a unit carries the gear it was created with', () => {
  it('a fully equipped unit reports every soldier ready', () => {
    const u = unitOf('LIGHT_INF_SPEAR', 20)
    expect(computeEquipped(u)).toBe(20)
    expect(missingEquipmentList(u)).toEqual([])
  })

  it('an un-stamped unit is the old bug: paid for, and reported as nothing', () => {
    // This is what the player saw before gear was held: "Ready 0 / 20" plus a red list.
    const u = unitOf('LIGHT_INF_SPEAR', 20, false)
    expect(computeEquipped(u)).toBe(0)
    expect(missingEquipmentList(u).length).toBeGreaterThan(0)
  })

  it('cavalry carries its horses too, not just weapons', () => {
    const u = unitOf('HEAVY_CAV', 5)
    expect(u.equip.horses.HEAVY_HORSE).toBe(5)
    expect(computeEquipped(u)).toBe(5)
  })

  it('readiness still falls with morale, as it always did', () => {
    const u = { ...unitOf('LIGHT_INF_SPEAR', 20), morale: 0 }
    expect(computeReady(u)).toBe(10) // 0 morale = half effectiveness
  })
})

describe('THE combat regression guard', () => {
  it('a fully equipped unit fields exactly what it fielded before gear was tracked', () => {
    // fieldedStrength reads `equipped > 0 ? min(size, equipped) : size`. Before this slice
    // equipped was always 0, so every unit fielded its full headcount. If stamping gear
    // made equipped anything less than size, this slice would have quietly rebalanced
    // every battle in the game.
    for (const type of ['LIGHT_INF_SPEAR', 'HEAVY_INF_SWORD', 'LIGHT_ARCHER', 'HEAVY_CAV', 'HORSE_ARCHER'] as SoldierType[]) {
      const equippedUnit = unitOf(type, 12)
      const legacyUnit = unitOf(type, 12, false)
      expect(fieldedStrength(equippedUnit)).toBe(12)
      expect(fieldedStrength(equippedUnit)).toBe(fieldedStrength(legacyUnit))
    }
  })

  it('a unit short of gear fields only the soldiers it can equip', () => {
    const u = unitOf('LIGHT_INF_SPEAR', 20)
    u.equip.weapons.SPEAR = 5
    expect(fieldedStrength(u)).toBe(5)
  })
})

describe('gear goes back where it came from', () => {
  it('disbanding returns exactly what creating took — the ledger closes', () => {
    const type: SoldierType = 'HEAVY_CAV'
    const size = 7
    const start = makeEmptyInventories()
    const need = demandFor(type, size)

    // Creation takes the demand out of the stores; disbanding puts the unit's gear back.
    const after = releaseEquip(start, equipFromDemand(need))
    expect(after.weapons.HALBERD).toBe(need.weapons.HALBERD)
    expect(after.armors.HEAVY_ARMOR).toBe(need.armors.HEAVY_ARMOR)
    expect(after.armors.HORSE_ARMOR).toBe(need.armors.HORSE_ARMOR)
    // Horses were spent from the ACTIVE stall, so that is where they return.
    expect(after.horses.HEAVY_HORSE.active).toBe(need.horses.HEAVY_HORSE)
  })

  it('releasing gear does not mutate the inventory it was handed', () => {
    const start = makeEmptyInventories()
    releaseEquip(start, equipFromDemand(demandFor('LIGHT_INF_SPEAR', 10)))
    expect(start.weapons.SPEAR).toBe(0)
  })

  it('replenishing adds gear rather than replacing it', () => {
    const a = equipFromDemand(demandFor('LIGHT_INF_SPEAR', 10))
    const b = equipFromDemand(demandFor('LIGHT_INF_SPEAR', 5))
    expect(addEquip(a, b).weapons.SPEAR).toBe(15)
  })
})

describe('split and merge move gear without creating or losing any', () => {
  it('splitting divides the gear with the soldiers', () => {
    const u = unitOf('LIGHT_INF_SPEAR', 20)
    const { taken, remaining } = splitUnit(u, 5)
    const total = (taken.equip.weapons.SPEAR ?? 0) + (remaining.equip.weapons.SPEAR ?? 0)
    expect(total).toBe(20) // divided, not created and not lost
    expect(taken.equip.weapons.SPEAR).toBe(5)
  })

  it('merging two units of a type pools their gear', () => {
    const a = { ...unitOf('LIGHT_INF_SPEAR', 10), id: 'A' }
    const b = { ...unitOf('LIGHT_INF_SPEAR', 10), id: 'B' }
    const m = mergeUnits(a, b)
    expect(m.equip.weapons.SPEAR).toBe(20)
  })
})

describe('an army saved before gear was tracked', () => {
  it('is handed the gear its headcount requires instead of reading as stripped', () => {
    const legacy = [unitOf('LIGHT_INF_SPEAR', 20, false)]
    const [u] = hydrateUnits(legacy)
    expect(equipIsEmpty(u.equip)).toBe(false)
    expect(computeEquipped(u)).toBe(20)
  })

  it('leaves a unit that already carries gear untouched', () => {
    const u = unitOf('LIGHT_INF_SPEAR', 20)
    u.equip.weapons.SPEAR = 3 // deliberately short — a real shortage must survive a load
    const [out] = hydrateUnits([u])
    expect(out.equip.weapons.SPEAR).toBe(3)
  })

  it('survives a garbage entry rather than throwing on load', () => {
    expect(hydrateUnits(undefined)).toEqual([])
    expect(() => hydrateUnits([{ id: 'x' } as unknown as Unit])).not.toThrow()
  })
})

describe('the two definitions of "what a soldier needs" must not drift', () => {
  it('what you are CHARGED equals what you are JUDGED against', () => {
    // The requirement lives twice: `perSoldierRequirement` (equipment.ts) decides what
    // creating a unit takes out of the stores, and the Registry's `def.req` decides what
    // readiness measures against. If they ever disagree, a unit is charged for one kit and
    // marked incomplete for another — and nothing else in the codebase would say so.
    for (const type of SoldierTypes) {
      const charged = demandFor(type, 1)
      const req = Registry.getUnit(type)?.req ?? { weapons: {}, armors: {}, horses: {} }
      expect({ type, ...charged.weapons }).toEqual({ type, ...(req.weapons ?? {}) })
      expect({ type, ...charged.armors }).toEqual({ type, ...(req.armors ?? {}) })
      expect({ type, ...charged.horses }).toEqual({ type, ...(req.horses ?? {}) })
    }
  })
})
