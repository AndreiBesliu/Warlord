import { useState } from 'react'
import { LEGION_MAX_HONOURS, LEGION_MAX_UNITS, type Honour, type Legion } from '../logic/legion'
import { sanitizeAuthoredText, validateDesign, type TraditionDesign } from '../logic/tradition'
import { legacyDesign } from '../logic/traditionLegacy'
import {
  DESIGN_MAX_CONSTRAINTS, DESIGN_MAX_NODES, TRADITION_CREED_MAX, TRADITION_NAME_MAX, primById,
} from '../logic/traditionPalette'
import { hydrateLedger } from '../logic/practice'
import { dutyById } from '../logic/duty'
import type { StandardLost } from '../logic/standard'
import { DIFFICULTIES } from '../logic/combat/enemies'
import { COMMANDER_NAME_MAX, traitById, type Commander } from '../logic/commander'

/** Rebuilt, not trusted: a trait the game no longer has must read as no commander at all. */
function hydrateCommander(saved: unknown): Commander | null {
  if (!saved || typeof saved !== 'object') return null
  const c = saved as Record<string, unknown>
  const trait = traitById(str(c.trait))
  if (!trait) return null
  const name = sanitizeAuthoredText(str(c.name), '', COMMANDER_NAME_MAX)
  if (!name) return null
  return {
    name,
    trait: trait.id,
    appointedDay: Math.round(num(c.appointedDay)),
    battles: Math.round(num(c.battles)),
  }
}

function hydrateStandard(saved: unknown): StandardLost | null {
  if (!saved || typeof saved !== 'object') return null
  const s = saved as Record<string, unknown>
  const to = str(s.lostTo)
  if (!(DIFFICULTIES as readonly string[]).includes(to)) return null
  return { lostTo: to as StandardLost['lostTo'], lostDay: Math.round(num(s.lostDay)) }
}

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


/**
 * Rebuild an authored tradition from an untrusted save — REBUILD, never pass through, the
 * way `sanitizeDeploy` does it rather than the spread-merge tier. Everything is resolved
 * against THIS build's palette, so a design can never carry a price, a threshold or a
 * ceiling of its own.
 *
 * Two policies worth reading:
 *
 *   A legacy oath (`tradition` was a plain string like 'SHIELDWALL') is migrated HERE, not
 *   after mount. Whatever hydrate returns is what the save effect persists on the very next
 *   state change, so a post-mount migration would already be writing over the old ids.
 *
 *   A design that no longer validates is KEPT and marked `invalid`, not nulled. A catalog
 *   id is the game's property and may be dropped; a design is the player's authorship, and
 *   it must never vanish without a sentence on screen.
 */
function hydrateDesign(saved: unknown, sworeDay: number): TraditionDesign | null {
  const legacy = legacyDesign(saved, sworeDay)
  if (legacy) return legacy
  if (!saved || typeof saved !== 'object') return null
  const d = saved as Record<string, unknown>

  const nodes: TraditionDesign['nodes'] = []
  const ids = new Set<string>()
  if (Array.isArray(d.nodes)) {
    for (const raw of d.nodes.slice(0, DESIGN_MAX_NODES)) {
      if (!raw || typeof raw !== 'object') continue
      const n = raw as Record<string, unknown>
      const prim = primById(str(n.prim))
      const id = str(n.id)
      if (!prim || !id || ids.has(id)) continue
      // A parent must already be present, which is also what makes a cycle unrepresentable.
      const parent = typeof n.parent === 'string' && ids.has(n.parent) ? n.parent : null
      nodes.push({ id, parent, prim: prim.id, steps: Math.min(prim.maxSteps, Math.max(1, Math.round(num(n.steps, 1)))) })
      ids.add(id)
    }
  }

  const constraints: TraditionDesign['constraints'] = []
  if (Array.isArray(d.constraints)) {
    for (const raw of d.constraints.slice(0, DESIGN_MAX_CONSTRAINTS)) {
      if (!raw || typeof raw !== 'object') continue
      const c = raw as Record<string, unknown>
      const cls = str(c.cls) as 'MOUNTED' | 'FOOT' | 'ARCHER' | 'HEAVY_FOOT'
      switch (str(c.kind)) {
        case 'DENY': constraints.push({ kind: 'DENY', cls }); break
        case 'MAX_COHORTS': constraints.push({ kind: 'MAX_COHORTS', n: Math.round(num(c.n)) }); break
        case 'MIN_COHORTS': constraints.push({ kind: 'MIN_COHORTS', n: Math.round(num(c.n)) }); break
        case 'SHARE': constraints.push({ kind: 'SHARE', cls, minPct: Math.round(num(c.minPct)) }); break
      }
    }
  }

  const name = sanitizeAuthoredText(str(d.name), '', TRADITION_NAME_MAX)
  if (!name && nodes.length === 0 && constraints.length === 0) return null
  const design: TraditionDesign = {
    v: 1,
    name: name || 'A nameless tradition',
    creed: sanitizeAuthoredText(str(d.creed), '', TRADITION_CREED_MAX),
    sworeDay: Math.round(num(d.sworeDay, sworeDay)),
    constraints,
    nodes,
  }
  return validateDesign(design).ok ? design : { ...design, invalid: true }
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
    tradition: hydrateDesign(l.tradition, Math.round(num(l.traditionDay))),
    traditionDay: Math.round(num(l.traditionDay)),
    // The key list inside `hydrateLedger` IS the whitelist — an unknown counter is dropped
    // rather than carried, so a hand-edited save cannot invent a proof.
    practice: hydrateLedger(l.practice),
    // Resolved against the list, not trusted: a duty the game no longer has must read as
    // "standing ready" rather than as an occupation nothing can look up or lift.
    duty: dutyById(str(l.duty))?.id ?? null,
    // Rebuilt against the real difficulty list: a save naming a mission the game no longer
    // has would strand a legion with an eagle it could never win back anywhere.
    standard: hydrateStandard(l.standard),
    commander: hydrateCommander(l.commander),
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
