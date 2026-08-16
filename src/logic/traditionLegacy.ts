// src/logic/traditionLegacy.ts
// The four hand-written traditions that shipped before authoring existed, re-expressed as
// DATA in the authored format.
//
// This file is imported by exactly one thing — the hydration migration — and by the test
// that is the most valuable one in the whole feature:
//
//     for (const d of Object.values(LEGACY_DESIGNS)) expect(validateDesign(d).ok).toBe(true)
//
// It is the expressiveness proof. If the palette cannot say what four traditions written by
// hand said, then the palette is too small to hand to a player, and the fix is the PALETTE —
// never an exemption in the migration. A migration that could bypass validation would let
// the four keep privileges no authored tradition could ever have, which is the opposite of
// what "the users create them" means.
//
// The nodes here are the ones the legacy oath's effects turn into. A legion migrated from a
// legacy oath keeps them all EARNED — it already paid 25,000 copper and three victories for
// them, and taking them away to be re-bought would be charging twice for one promise.

import type { TraditionDesign } from './tradition'

const design = (
  name: string, creed: string,
  constraints: TraditionDesign['constraints'],
  nodes: TraditionDesign['nodes'],
): TraditionDesign => ({ v: 1, name, creed, sworeDay: 0, constraints, nodes })

export const LEGACY_DESIGNS: Record<string, TraditionDesign> = {
  SHIELDWALL: design(
    'The Shieldwall',
    'They do not manoeuvre and they do not break. The line is the whole doctrine.',
    [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'SHARE', cls: 'HEAVY_FOOT', minPct: 50 }],
    [
      { id: 'n0', parent: null, prim: 'UNBROKEN', steps: 2 },
      { id: 'n1', parent: 'n0', prim: 'STEADFAST', steps: 2 },
    ],
  ),
  WINDS_OWN: design(
    "The Wind's Own",
    'Half a legion, twice the ground. They are gone before the answer arrives.',
    [{ kind: 'DENY', cls: 'FOOT' }, { kind: 'MAX_COHORTS', n: 6 }],
    [
      { id: 'n0', parent: null, prim: 'OUTRIDERS', steps: 2 },
      { id: 'n1', parent: 'n0', prim: 'HORSEBREAKERS', steps: 2 },
    ],
  ),
  LONG_WATCH: design(
    'The Long Watch',
    'They count the arrows and they count the days, and they are never wrong about either.',
    [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'SHARE', cls: 'ARCHER', minPct: 50 }],
    [
      { id: 'n0', parent: null, prim: 'SHAFTBREAKERS', steps: 2 },
      { id: 'n1', parent: 'n0', prim: 'DRILLMASTERS', steps: 2 },
    ],
  ),
  IRON_VOW: design(
    'The Iron Vow',
    'Sworn at full strength and kept at full strength. A gap in the ranks is a broken oath.',
    [
      { kind: 'DENY', cls: 'MOUNTED' },
      { kind: 'DENY', cls: 'ARCHER' },
      { kind: 'MIN_COHORTS', n: 8 },
    ],
    [
      { id: 'n0', parent: null, prim: 'UNBROKEN', steps: 2 },
      { id: 'n1', parent: 'n0', prim: 'HARD_LESSONS', steps: 2 },
    ],
  ),
}

/**
 * Turn a legacy oath id into a design, keeping the day it was sworn.
 *
 * Returns `null` for anything unrecognised — including `null` itself, which is the common
 * case of a legion that never swore.
 */
export function legacyDesign(id: unknown, sworeDay: number): TraditionDesign | null {
  if (typeof id !== 'string') return null
  const base = LEGACY_DESIGNS[id]
  if (!base) return null
  return { ...base, nodes: base.nodes.map((n) => ({ ...n })), constraints: base.constraints.map((c) => ({ ...c })), sworeDay }
}

/** Every node of a legacy design counts as already earned — see the file header. */
export function legacyEarned(id: unknown): string[] {
  if (typeof id !== 'string') return []
  return LEGACY_DESIGNS[id]?.nodes.map((n) => n.id) ?? []
}
