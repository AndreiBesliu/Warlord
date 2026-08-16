import { useState } from 'react'
import { LEGION_MAX_HONOURS, LEGION_MAX_UNITS, type Honour, type Legion } from '../logic/legion'
import { traditionById } from '../logic/tradition'

/** The formations themselves. One field would have been a wrapper for nothing. */
export type LegionsState = Legion[]

export function emptyLegions(): LegionsState {
  return []
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback

function hydrateHonour(saved: unknown): Honour | null {
  if (!saved || typeof saved !== 'object') return null
  const h = saved as Record<string, unknown>
  const key = str(h.key)
  if (!key) return null
  return {
    key,
    label: str(h.label, key),
    count: Math.max(1, Math.round(num(h.count, 1))),
    firstDay: Math.round(num(h.firstDay)),
  }
}

function hydrateLegion(saved: unknown): Legion | null {
  if (!saved || typeof saved !== 'object') return null
  const l = saved as Record<string, unknown>
  const id = str(l.id)
  if (!id) return null
  return {
    id,
    name: str(l.name, id),
    foundedDay: Math.round(num(l.foundedDay)),
    // Deduplicated on the way in: two entries for one unit would number the cohorts wrong
    // and let one unit take the field twice.
    unitIds: Array.isArray(l.unitIds)
      ? [...new Set(l.unitIds.filter((x): x is string => typeof x === 'string'))].slice(0, LEGION_MAX_UNITS)
      : [],
    honours: Array.isArray(l.honours)
      ? l.honours.map(hydrateHonour).filter((h): h is Honour => h !== null).slice(0, LEGION_MAX_HONOURS)
      : [],
    // Resolved against the catalog, not trusted: a save carrying an id that no longer
    // exists (a tradition renamed or dropped) must read as "no oath" rather than as a
    // tradition whose rules nothing can look up. `traditionById` returns null for both.
    tradition: traditionById(str(l.tradition))?.id ?? null,
    traditionDay: Math.round(num(l.traditionDay)),
  }
}

/**
 * Merge a (possibly older) saved blob over fresh defaults so new fields always exist.
 *
 * Field-by-field on purpose, like `hydrateResearch` — and for the same reason that one
 * carries a warning: a field written to localStorage and missing from this function is
 * dropped on the next load, silently and with no error. Add a field to `Legion` and it
 * must be added here in the same change.
 *
 * Note what this does NOT do: it does not check that `unitIds` point at units that exist.
 * Membership is resolved against the live army at read time (`unitsOfLegion`), because a
 * unit can die in seven places — one of them the PvP write-back, which rewrites the saved
 * army from outside this game's state entirely and would never call this function.
 */
export function hydrateLegions(saved: unknown): LegionsState {
  if (!Array.isArray(saved)) return emptyLegions()
  return saved.map(hydrateLegion).filter((l): l is Legion => l !== null)
}

export function useLegions(saved?: unknown) {
  const [legions, setLegions] = useState<LegionsState>(() => hydrateLegions(saved))
  return { legions, setLegions }
}
