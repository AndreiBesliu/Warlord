// src/logic/legion.ts
// A legion is a FORMATION that holds units — not a unit with a fancier name.
//
// That is the Total War: Rome 2 shape, and it is what makes "unique composition" free:
// a legion fields spearmen and archers together because it CONTAINS a spear unit and an
// archer unit. `Unit` keeps its single type and gains no field at all, so the combat
// engine — and the byte-identical copy of it the PvP server runs — never learn that
// legions exist.
//
// Membership is a list of ids RESOLVED AT READ TIME, never maintained on death. A unit id
// stops being valid in seven places, and one of them (the PvP write-back) rewrites the
// saved army from outside this game's state entirely. Seven places to prune is seven
// places to forget; resolving on read makes a dead id harmless by construction.

import type { Unit } from './types'
import { joinBan, type TraditionDesign } from './tradition'
// Type-only: `practice.ts` imports `tradition.ts` for the class vocabulary, and this is a
// type import, so nothing is created at runtime and there is no cycle.
import type { DeedLedger } from './practice'
import type { StandardLost } from './standard'

export interface Honour {
  /** Dedupe key — the same feat twice is one honour with a count, not two lines. */
  key: string
  label: string
  count: number
  /** The day it was first earned; a legion's record reads oldest-first. */
  firstDay: number
}

export interface Legion {
  id: string
  name: string
  foundedDay: number
  unitIds: string[]
  honours: Honour[]
  /**
   * The tradition it swore to, INLINE. `null` = none.
   *
   * Inline rather than an id into a shared table: a design belongs to exactly one legion,
   * so inlining makes hydration local, deletion automatic, and removes the dangling-id bug
   * class this codebase has already paid for twice. Two legions that start from the same
   * creed then diverge in what they have grown, which is correct rather than a limitation.
   */
  tradition?: TraditionDesign | null
  /** The day of the oath. Part of the record, like `foundedDay`. */
  traditionDay?: number
  /** What this legion has actually done. Sparse; absent key = 0. See `practice.ts`. */
  practice?: DeedLedger
  /** What it is doing on the days it does not fight. `null` = standing ready. See `duty.ts`. */
  duty?: string | null
  /** Where its eagle is, if somebody else has it. `null` = the legion holds it. */
  standard?: StandardLost | null
}

/**
 * Twelve, and not a taste decision: PvP refuses more than twelve combatants a side
 * server-side (`PVP_MAX_COMBATANTS`), and the campaign has no cap at all but breaks above
 * twenty-four — `placeArmy` wraps its two spawn rows and silently stacks combatants onto
 * occupied tiles, where they can neither be reached nor moved. Twelve is therefore the
 * largest legion that can march into either kind of battle and still be a legion in it.
 */
export const LEGION_MAX_UNITS = 12

export const LEGION_NAME_MAX = 40
/** The whole save is one Firestore document; the activity log is capped for the same reason. */
export const LEGION_MAX_HONOURS = 24

export function newLegionId(): string {
  return `L_${Math.random().toString(36).slice(2, 8)}`
}

const ORDINALS = [
  'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth',
  'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
]

export function ordinalWord(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * The next name the army does not already carry.
 *
 * PROBES for a free name rather than counting the legions that exist. Counting collides
 * three ways that all happen in normal play: disband the Second of three and the next
 * suggestion steals the Third's name; the player types "The Third Host" by hand and the
 * counter never learns; a legion is renamed and its ordinal comes free without the counter
 * noticing. Probing cannot collide, whatever the army has been through.
 *
 * The noun is deliberately not derived from what the legion contains — a legion of spears
 * that later takes on archers would be carrying a lie in its own name.
 */
export function suggestLegionName(existingNames: string[]): string {
  const taken = new Set(existingNames.map(norm))
  for (let n = 1; n <= 999; n++) {
    const candidate = `The ${ordinalWord(n)} Host`
    if (!taken.has(norm(candidate))) return candidate
  }
  return `The ${ordinalWord(1000)} Host`
}

/**
 * A legion's name is the first thing a player ever types into this game that gets saved,
 * and it ends up inside `addLog` lines that `logKind` classifies by scanning the whole
 * string. The two glyphs it matches with `includes` — the warning sign and the microscope —
 * would let a name file its own log lines under Warnings or Research, so they come out.
 *
 * Words do NOT come out. A legion may be called "The Victors" and see its lines filed under
 * Battles; that is cosmetic. Mutilating a player's chosen name to protect a log filter
 * would be the worse trade.
 *
 * `fallback` belongs to the caller — the suggestion when forming, the CURRENT name when
 * renaming. Someone who clears the field and clicks away must get their name back, not a
 * fresh christening.
 */
export function sanitizeLegionName(raw: string, fallback: string): string {
  const cleaned = (raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // The two markers `logKind` tests with `includes`, plus the variation selector that
    // rides along with the warning sign.
    .replace(/[\u26a0\u{1F52C}]\ufe0f?/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Cut by CODE POINT, not code unit: slicing a surrogate pair in half turns the last
  // character of a long name into a replacement glyph.
  return [...cleaned].slice(0, LEGION_NAME_MAX).join('').trim() || fallback
}

/** The units a legion actually has, in its own order. Ids that no longer exist are gone. */
export function unitsOfLegion(legion: Legion, units: Unit[]): Unit[] {
  const byId = new Map(units.map((u) => [u.id, u]))
  const out: Unit[] = []
  for (const id of legion.unitIds) {
    const u = byId.get(id)
    if (u) out.push(u)
  }
  return out
}

export function legionOfUnit(legions: Legion[], unitId: string): Legion | null {
  return legions.find((l) => l.unitIds.includes(unitId)) ?? null
}

const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]

export function roman(n: number): string {
  let left = Math.max(1, Math.floor(n))
  let out = ''
  for (const [v, s] of ROMAN) while (left >= v) { out += s; left -= v }
  return out
}

/**
 * A unit's identity is its place in its legion. Numbered over the LIVING members, so a
 * legion that loses its second cohort closes ranks rather than keeping a gap.
 */
export function cohortLabel(legion: Legion, units: Unit[], unitId: string): string {
  const i = unitsOfLegion(legion, units).findIndex((u) => u.id === unitId)
  return i < 0 ? '' : `Cohort ${roman(i + 1)}`
}

/**
 * Why this unit cannot join, said in the words the player needs. `null` = it can.
 *
 * The single choke point every assignment goes through, which is why the tradition's bans
 * are enforced HERE rather than at each button: a ban checked in the UI is a ban with as
 * many holes as there are call sites.
 */
export function joinBlocker(legion: Legion, unitId: string, units: Unit[], legions: Legion[]): string | null {
  if (legion.unitIds.includes(unitId)) return 'Already in this legion'
  const cohorts = unitsOfLegion(legion, units)
  if (cohorts.length >= LEGION_MAX_UNITS) {
    return `${legion.name} is at full strength — ${LEGION_MAX_UNITS} cohorts is as many as can take the field together`
  }
  const other = legionOfUnit(legions, unitId)
  if (other && other.id !== legion.id) return `Already serving with ${other.name}`
  const joiner = units.find((u) => u.id === unitId)
  if (joiner) {
    const ban = joinBan(legion.tradition ?? null, joiner.type, cohorts.length, legion.name)
    if (ban) return ban
  }
  return null
}

/**
 * One honour per feat, counted. A legion that has beaten the same enemy seven times reads
 * "Victor of Rival Baron ×7" — shorter than seven identical lines, and it keeps the record
 * bounded: the whole save travels to Firestore as a single document.
 */
export function addHonour(honours: Honour[], entry: { key: string; label: string; day: number }): Honour[] {
  const i = honours.findIndex((h) => h.key === entry.key)
  if (i >= 0) {
    const next = honours.slice()
    next[i] = { ...next[i], count: next[i].count + 1 }
    return next
  }
  const next = [...honours, { key: entry.key, label: entry.label, count: 1, firstDay: entry.day }]
  // Oldest honours are the ones a legion is known for; a cap that dropped those would
  // rewrite its history, so the newest go first when something has to give.
  return next.length > LEGION_MAX_HONOURS ? next.slice(0, LEGION_MAX_HONOURS) : next
}

/** Drop ids whose units are gone. Housekeeping only — reads already ignore them. */
export function pruneMembership(legion: Legion, units: Unit[]): Legion {
  const alive = new Set(units.map((u) => u.id))
  const kept = legion.unitIds.filter((id) => alive.has(id))
  return kept.length === legion.unitIds.length ? legion : { ...legion, unitIds: kept }
}

// Every field spelled out, including the ones that are empty. A legion built here and one
// read back by `hydrateLegions` must have the SAME shape — otherwise which door it came
// through changes what it is, and that difference surfaces somewhere far away.
export function emptyLegion(name: string, foundedDay: number): Legion {
  return {
    id: newLegionId(), name, foundedDay, unitIds: [], honours: [],
    tradition: null, traditionDay: 0, practice: {}, duty: null, standard: null,
  }
}

/**
 * Decorate the legions that came home from a victory.
 *
 * `survivorIds` must be the units that still EXIST after the battle, not everyone who
 * marched: a wiped-out cohort is gone from the army entirely, and a legion credited through
 * one would be credited through a corpse. Undeployed legions are not decorated for a battle
 * they never attended, which is the other half of the same mistake.
 *
 * Pure and separate from the tick on purpose — this is a rule, and a rule inlined in a
 * setState is a rule nobody can test.
 */
export function awardVictoryHonours(
  legions: Legion[],
  survivorIds: string[],
  entry: { key: string; label: string; day: number },
): Legion[] {
  const came = new Set(survivorIds)
  return legions.map((l) =>
    l.unitIds.some((id) => came.has(id)) ? { ...l, honours: addHonour(l.honours, entry) } : l)
}
