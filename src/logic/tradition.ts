// src/logic/tradition.ts
// What a legion swears to, and what it gives up for it.
//
// A bonus on its own differentiates nothing: everyone takes it, every legion converges on
// the same shape, and "tradition" becomes another word for "level". The CONSTRAINT is what
// makes two legions unable to be the same legion. So every tradition here refuses
// something, and the refusal is the price of the bonus — not a balance tax bolted on after.
//
// Two KINDS of constraint, because treating them alike would lie in one direction or the
// other:
//
//   BANS ("never horsemen") are monotone — you can only break them by ADDING. They are
//   checked when a cohort tries to join, and they REFUSE.
//
//   STANDING requirements ("at least half heavy foot", "at least eight cohorts") can break
//   while you do nothing at all: a cohort dies in battle. There is nothing for a refusal to
//   refuse there, and stripping the tradition would punish a player for a loss they already
//   suffered. So a broken standing requirement SUSPENDS the bonus until the legion is put
//   back in shape. Discipline, not confiscation.
//
// Scope: the bonuses ride the DOMAIN channels (morale after a battle, XP from a battle) and
// never combat stats — the same rule `research/effects.ts` already states and for the same
// reasons. Nothing here reaches the battle engine or the byte-identical copy of it the PvP
// server runs.

import type { SoldierType, Unit } from './types'
import { DEFAULT_COMBAT_STATS } from './combat/stats'
import { GameConfig } from './config'

/**
 * How a soldier type counts toward a tradition's rules.
 *
 * DERIVED from the combat stat table rather than listed by hand. A hand-written list is a
 * second place to remember a new soldier type, and the one that gets forgotten — the
 * tradition would then silently accept a horseman it was sworn against.
 */
export type TypeClass = 'MOUNTED' | 'FOOT' | 'ARCHER' | 'HEAVY_FOOT'

export function classesOf(type: SoldierType): TypeClass[] {
  const s = DEFAULT_COMBAT_STATS[type]
  if (!s) return []
  const out: TypeClass[] = [s.mounted ? 'MOUNTED' : 'FOOT']
  if (s.weaponClass === 'bow') out.push('ARCHER')
  if (!s.mounted && s.armorClass === 'heavy' && s.weaponClass !== 'bow') out.push('HEAVY_FOOT')
  return out
}

export function isClass(type: SoldierType, cls: TypeClass): boolean {
  return classesOf(type).includes(cls)
}

const CLASS_LABEL: Record<TypeClass, string> = {
  MOUNTED: 'horsemen',
  FOOT: 'men on foot',
  ARCHER: 'archers',
  HEAVY_FOOT: 'heavy foot',
}

/** A requirement the legion must keep STANDING. Failing it suspends the bonus; it never revokes the oath. */
export type Keeping =
  | { kind: 'SHARE'; cls: TypeClass; minPct: number }
  | { kind: 'MIN_COHORTS'; n: number }

export interface TraditionDef {
  id: string
  name: string
  /** One line saying WHY the legion is like this, not what the numbers are. */
  creed: string
  /** Classes this legion never accepts. Checked when a cohort tries to join. */
  denies: TypeClass[]
  /** A tighter cohort ceiling than the legion default, if the tradition demands a smaller host. */
  maxCohorts?: number
  keeping?: Keeping
  /** Morale handed to its surviving cohorts after a won or lost battle. */
  moraleBonus: number
  /** Multiplies battle XP — under the absolute XP_CAP, which this cannot lift. */
  xpMult: number
}

export const TRADITIONS: TraditionDef[] = [
  {
    id: 'SHIELDWALL',
    name: 'The Shieldwall',
    creed: 'They do not manoeuvre and they do not break. The line is the whole doctrine.',
    denies: ['MOUNTED'],
    keeping: { kind: 'SHARE', cls: 'HEAVY_FOOT', minPct: 50 },
    moraleBonus: 15,
    xpMult: 1,
  },
  {
    id: 'WINDS_OWN',
    name: "The Wind's Own",
    creed: 'Half a legion, twice the ground. They are gone before the answer arrives.',
    denies: ['FOOT'],
    maxCohorts: 6,
    moraleBonus: 0,
    xpMult: 1.35,
  },
  {
    id: 'LONG_WATCH',
    name: 'The Long Watch',
    creed: 'They count the arrows and they count the days, and they are never wrong about either.',
    denies: ['MOUNTED'],
    keeping: { kind: 'SHARE', cls: 'ARCHER', minPct: 50 },
    moraleBonus: 5,
    xpMult: 1.25,
  },
  {
    id: 'IRON_VOW',
    name: 'The Iron Vow',
    creed: 'Sworn at full strength and kept at full strength. A gap in the ranks is a broken oath.',
    denies: ['MOUNTED', 'ARCHER'],
    keeping: { kind: 'MIN_COHORTS', n: 8 },
    moraleBonus: 20,
    xpMult: 1.15,
  },
]

export function traditionById(id: string | null | undefined): TraditionDef | null {
  if (!id) return null
  return TRADITIONS.find((t) => t.id === id) ?? null
}

/** The bonus as the game will actually apply it — admin overrides folded in, bounded. */
export function traditionNumbers(def: TraditionDef): { moraleBonus: number; xpMult: number } {
  return GameConfig.tradition(def.id, def)
}

/**
 * Why this cohort may not join a legion sworn to `def`. `null` = it may.
 *
 * This is the BAN half — monotone, so checking it at the door is enough. `legion.ts` calls
 * it from `joinBlocker`, which is the single choke point every assignment already goes
 * through; there is no second path a cohort can sneak in by.
 */
export function joinBan(def: TraditionDef | null, type: SoldierType, cohortCount: number): string | null {
  if (!def) return null
  const denied = def.denies.find((c) => isClass(type, c))
  if (denied) return `${def.name} is sworn against ${CLASS_LABEL[denied]}`
  if (def.maxCohorts !== undefined && cohortCount >= def.maxCohorts) {
    return `${def.name} rides no more than ${def.maxCohorts} cohorts`
  }
  return null
}

/**
 * Why the legion is not currently keeping its tradition — and so why the bonus is asleep.
 * `null` = it is in keeping.
 *
 * Says the real numbers, because "out of keeping" without them is a puzzle rather than an
 * instruction.
 */
export function outOfKeeping(def: TraditionDef | null, cohorts: Unit[]): string | null {
  if (!def?.keeping) return null
  const k = def.keeping
  if (k.kind === 'MIN_COHORTS') {
    return cohorts.length >= k.n
      ? null
      : `needs ${k.n} cohorts under arms, has ${cohorts.length}`
  }
  // Ceiling, so "at least half" of an odd number means the larger half, not the smaller.
  const need = Math.ceil((cohorts.length * k.minPct) / 100)
  const have = cohorts.filter((u) => isClass(u.type, k.cls)).length
  return have >= need
    ? null
    : `needs ${need} of ${cohorts.length} cohorts to be ${CLASS_LABEL[k.cls]}, has ${have}`
}

export interface TraditionEffects {
  moraleBonus: number
  xpMult: number
}

export const NO_EFFECTS: TraditionEffects = { moraleBonus: 0, xpMult: 1 }

/**
 * What a legion's tradition is actually worth right now. A legion with no oath, or one out
 * of keeping, gets exactly nothing — and "nothing" is the identity value for both channels,
 * so callers never need to branch.
 */
export function traditionEffects(traditionId: string | null | undefined, cohorts: Unit[]): TraditionEffects {
  const def = traditionById(traditionId)
  if (!def || outOfKeeping(def, cohorts)) return NO_EFFECTS
  return traditionNumbers(def)
}

/**
 * A tradition's terms in words, from the SAME numbers the game applies — so an admin who
 * retunes the bonus retunes what the screen promises, and the two can never drift.
 */
export function describeTradition(def: TraditionDef): { refuses: string; keeps: string; gives: string } {
  const n = traditionNumbers(def)
  const refuses = [
    ...def.denies.map((c) => `no ${CLASS_LABEL[c]}`),
    ...(def.maxCohorts !== undefined ? [`at most ${def.maxCohorts} cohorts`] : []),
  ].join(' · ')

  let keeps = '—'
  if (def.keeping?.kind === 'MIN_COHORTS') keeps = `at least ${def.keeping.n} cohorts under arms`
  else if (def.keeping?.kind === 'SHARE') {
    keeps = `at least ${def.keeping.minPct}% ${CLASS_LABEL[def.keeping.cls]}`
  }

  const gives = [
    ...(n.moraleBonus > 0 ? [`+${n.moraleBonus} morale after a battle`] : []),
    ...(n.xpMult !== 1 ? [`battle XP ×${n.xpMult}`] : []),
  ].join(' · ') || '—'

  return { refuses: refuses || '—', keeps, gives }
}

/**
 * Every unit that is owed something by the tradition it serves under, resolved once.
 *
 * Takes the legions STRUCTURALLY rather than importing `Legion`: `legion.ts` already
 * imports this file for the join bans, and importing back would close a cycle.
 *
 * Call this with the army as it MARCHED. A legion that lost a cohort in the very battle
 * being resolved fought that battle in keeping, and evaluating afterwards would take the
 * bonus away for the loss it just suffered.
 */
export function legionEffectsByUnit(
  legions: { unitIds: string[]; tradition?: string | null }[],
  units: Unit[],
): Map<string, TraditionEffects> {
  const byId = new Map(units.map((u) => [u.id, u]))
  const out = new Map<string, TraditionEffects>()
  for (const l of legions) {
    if (!l.tradition) continue
    const cohorts = l.unitIds.map((id) => byId.get(id)).filter((u): u is Unit => !!u)
    const eff = traditionEffects(l.tradition, cohorts)
    if (eff === NO_EFFECTS) continue
    for (const u of cohorts) out.set(u.id, eff)
  }
  return out
}

/** Victories a legion has to its name — honours are counted, not listed. */
export function victoryCount(honours: { count: number }[]): number {
  return honours.reduce((a, h) => a + h.count, 0)
}

/**
 * Why this legion may not swear to `def` right now. `null` = it may.
 *
 * Deliberately does NOT refuse a legion that would start out of keeping. Swearing to the
 * Iron Vow with three cohorts is a legitimate commitment to grow into it — the bonus simply
 * sleeps until it does. What IS refused is a legion holding cohorts the oath forbids: that
 * is a contradiction rather than an aspiration, and the way out is to release them first.
 */
export function adoptBlocker(
  legion: { tradition?: string | null; honours: { count: number }[] },
  def: TraditionDef,
  cohorts: Unit[],
  wallet: number,
): string | null {
  const sworn = traditionById(legion.tradition)
  if (sworn) return `Already sworn to ${sworn.name} — a legion swears once`

  const rules = GameConfig.traditionRules()
  const wins = victoryCount(legion.honours)
  if (wins < rules.minHonours) {
    return `Needs ${rules.minHonours} victories to its name, has ${wins}`
  }
  if (wallet < rules.adoptCostCopper) {
    return `Costs ${rules.adoptCostCopper.toLocaleString()}c to swear — you have ${Math.floor(wallet).toLocaleString()}c`
  }

  const offending = cohorts.find((u) => def.denies.some((c) => isClass(u.type, c)))
  if (offending) {
    const cls = def.denies.find((c) => isClass(offending.type, c))!
    return `Release its ${CLASS_LABEL[cls]} first — ${def.name} will not have them`
  }
  if (def.maxCohorts !== undefined && cohorts.length > def.maxCohorts) {
    return `${def.name} rides no more than ${def.maxCohorts} cohorts — this legion has ${cohorts.length}`
  }
  return null
}
