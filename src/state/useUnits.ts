import { useState } from 'react'
import type { Unit } from '../logic/types'
import { computeReady, splitUnit, mergeUnits } from '../logic/units'
import { demandFor, ensureEquipOrBuy, equipFromDemand, equipIsEmpty } from '../logic/equipment'

/**
 * Units saved before gear was tracked carry an empty `equip`, and would read as completely
 * unequipped the moment readiness started measuring it — a whole army apparently stripped
 * by a patch. They were paid for at creation, so each one is handed exactly what its
 * headcount requires. Units that already carry gear are left alone.
 */
export function hydrateUnits(saved?: Unit[]): Unit[] {
  if (!Array.isArray(saved)) return []
  return saved.map((u) => {
    if (!u || !u.type || !Array.isArray(u.buckets)) return u
    if (!equipIsEmpty(u.equip)) return u
    const size = u.buckets.reduce((a, b) => a + (b?.count ?? 0), 0)
    if (size <= 0) return u
    return { ...u, equip: equipFromDemand(demandFor(u.type, size)) }
  })
}

export function useUnits(savedUnits?: Unit[]) {
  const [units, setUnits] = useState<Unit[]>(() => hydrateUnits(savedUnits))
  const [mergePick, setMergePick] = useState<string[]>([])

  // expose helpers; the hook that composes can pass inv/wallet/setters
  return {
    units, setUnits,
    mergePick, setMergePick,
    computeReady, splitUnit, mergeUnits,
    demandFor, ensureEquipOrBuy,  // tools used by create/replenish
  }
}
