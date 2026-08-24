import { emptyPool, hydratePool } from '../logic/barracksPool'
import { useState, useCallback } from 'react'
import { Ranks, type SoldierType, type BarracksPool, type RecruitPool } from '../logic/types'
import { batchDurationDays, batchSlots, newBatchId, type TrainingBatch } from '../logic/batches'
import { blendIn, startingXpOf, type RecruitSourceId } from '../logic/recruitSources'

/** Delegates, so the shape lives in one place with the maths that depends on it. */
export function emptyBarracks(): BarracksPool {
  return emptyPool()
}

  export type BarracksDeps = {
    addLog: (s: string) => void
    setRecruits: React.Dispatch<React.SetStateAction<RecruitPool>>
  }
  export type BarracksAPI = ReturnType<typeof useBarracks>;

export interface BarracksSaved {
  barracks?: BarracksPool
  barracksLevel?: number
  recruits?: RecruitPool
  batches?: TrainingBatch[]
}

/**
 * The recruit pool used to store an AVERAGE; it stores the total now (see
 * `logic/recruitSources.ts`). This is the only place an old save is read, and this slice
 * has no hydrate function of its own — `saved` arrives as `any` off the blob, so a missing
 * conversion here would not be a type error, it would be XP quietly evaporating on load.
 */
export function hydrateRecruits(saved: unknown): RecruitPool {
  if (!saved || typeof saved !== 'object') return { count: 0, totalXp: 0 }
  const s = saved as { count?: unknown; totalXp?: unknown; avgXP?: unknown }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  const count = Math.floor(n(s.count))
  if (typeof s.totalXp === 'number') return { count, totalXp: n(s.totalXp) }
  return { count, totalXp: Math.round(n(s.avgXP) * count) }
}

export default function useBarracks(saved?: BarracksSaved) {
  // Hydrated, not taken raw. This was `saved?.barracks ?? emptyBarracks()` — the same
  // uncoerced door that makes `econ.buildings` the one slice a bad value can poison, and it
  // is also where a save written before the total-shaped slot is migrated.
  const [barracks, setBarracks] = useState<BarracksPool>(() => hydratePool(saved?.barracks))
  const [barracksLevel, setBarracksLevel] = useState(() => saved?.barracksLevel ?? 1)
  const [recruits, setRecruits] = useState<RecruitPool>(() => hydrateRecruits(saved?.recruits))
  const [batches, setBatches] = useState<TrainingBatch[]>(() => saved?.batches ?? [])

  function barracksUpgradeCost(level: number) {
    if (level === 1) return 50_00
    if (level === 2) return 150_00
    if (level === 3) return 400_00
    if (level === 4) return 800_00
    return Infinity
  }

  // plain recruit mutator (no logging here)
  const recruit = useCallback((qty: number, source?: RecruitSourceId) => {
    const n = Math.max(1, Math.floor(qty || 0))
    // The blend has always been here; the incoming XP was hardcoded to 0, which is what
    // made the pool's XP figure dead weight. It is the source's now.
    setRecruits((prev: RecruitPool) => blendIn(prev, n, startingXpOf(source)))
  }, [])

  return {
    // state
    barracks, setBarracks,
    barracksLevel, setBarracksLevel,
    recruits, setRecruits,
    batches, setBatches,

    // helpers
    barracksUpgradeCost,
    batchSlots,
    batchDurationDays,
    newBatchId,
    recruit, // note: logging happens in useGameState wrapper
  }
}