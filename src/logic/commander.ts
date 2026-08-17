// src/logic/commander.ts
// The person at the head of a legion.
//
// ── Why this is not a second tradition ─────────────────────────────────────────────────
//
// A tradition is permanent, institutional, and bound to its legion for life. A commander is
// the opposite of all three: mortal, personal, and — the difference that makes them worth
// having — TRANSFERABLE. The commander is the piece you can move; the tradition is the
// piece you cannot.
//
// That is the decision the feature exists to create. Your veteran commander stands with the
// legion that earned him, and tomorrow a different legion is the one that has to win. Do
// you move him, and leave the legion that made him without one?
//
// ── The army makes the man ─────────────────────────────────────────────────────────────
//
// A commander's TRAIT is not chosen. It is derived from what the legion had actually done
// on the day he was raised to command it — the same principle as a palette piece carrying
// its own proof, and for the same reason: anything the player picks freely, they will pick
// to suit themselves, and the connection to what the legion IS evaporates.
//
// So a legion that spent its life on the walls raises a warden; one that ground out bloody
// wins raises somebody who does not flinch. Two players with the same tradition and
// different histories get different men.
//
// ── Mortality ──────────────────────────────────────────────────────────────────────────
//
// He falls on a DEFEAT in which the legion lost more than half of what it fielded — the
// moment he was covering the retreat. Deliberately a different trigger from the standard's
// (a total wipe), so the two are not the same event wearing two names, and deliberately
// DETERMINISTIC: this game's battles are reproducible from a seed, and a die roll here
// would be the one thing in a resolved battle that could not be replayed.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig } from './config'
import type { DeedKey, DeedLedger } from './practice'
import { NO_CHANNELS, type LegionChannels } from './traditionPalette'

export type TraitId =
  | 'VICTOR' | 'STUBBORN' | 'DRILLMASTER' | 'WARDEN' | 'RIDER' | 'SURVIVOR' | 'STEADY'

export interface TraitDef {
  id: TraitId
  name: string
  blurb: string
  /** The deed that raises this kind of man. `null` = the fallback nobody competes for. */
  from: DeedKey | null
  /** What ONE rank of him is worth. Folded and clamped with everything else. */
  apply: (ch: LegionChannels, rank: number) => void
}

/**
 * Ordered, and the order is the tie-break: the first trait whose deed is the legion's
 * highest wins. A stable list beats "whichever the object happened to enumerate first",
 * which would make the same record raise different men on different days.
 */
export const TRAITS: TraitDef[] = [
  {
    id: 'VICTOR', name: 'the Victor', from: 'victories',
    blurb: 'He has stood on more won fields than lost ones, and the men know it.',
    apply: (ch, r) => { ch.victoryStipend += 100 * r },
  },
  {
    id: 'STUBBORN', name: 'the Stubborn', from: 'heldTheLine',
    blurb: 'He has been told to fall back and has declined, more than once.',
    apply: (ch, r) => { ch.moraleFloor += 5 * r },
  },
  {
    id: 'SURVIVOR', name: 'the Survivor', from: 'defeats',
    blurb: 'He has walked off fields nobody else walked off. It taught him things.',
    apply: (ch, r) => { ch.defeatXpBonus += 0.06 * r },
  },
  {
    id: 'DRILLMASTER', name: 'the Drillmaster', from: 'daysDrilled',
    blurb: 'He was made in the yard, and he runs it the way he was run.',
    apply: (ch, r) => { ch.drillXpMult *= 1 + 0.05 * r },
  },
  {
    id: 'WARDEN', name: 'the Warden', from: 'daysGarrisoned',
    blurb: 'Years of watches. He knows what men need to keep standing.',
    apply: (ch, r) => { ch.moraleFloor += 4 * r },
  },
  {
    id: 'RIDER', name: 'the Rider', from: 'daysPatrolled',
    blurb: 'Every road, every ford, every innkeeper who owes the legion a meal.',
    apply: (ch, r) => { ch.dutyCopperMult *= 1 - 0.05 * r },
  },
  {
    id: 'STEADY', name: 'the Steady', from: null,
    blurb: 'No stories yet. He turned up, and he has not left.',
    apply: (ch, r) => { ch.moraleFloor += 2 * r },
  },
]

export function traitById(id: string | null | undefined): TraitDef | null {
  if (!id) return null
  return TRAITS.find((t) => t.id === id) ?? null
}

export interface Commander {
  name: string
  trait: TraitId
  appointedDay: number
  /** Battles commanded. The only thing about him that grows, and what dying costs you. */
  battles: number
}

export const COMMANDER_NAME_MAX = 32
export const COMMANDER_MAX_RANK = 5

/**
 * Which man this legion's record raises.
 *
 * Compares deeds against each other, so it answers "what has this legion mostly BEEN
 * doing" rather than "has it crossed some threshold" — a legion is defined by where its
 * weight sits, not by a bar it stepped over once.
 *
 * Days count for less than deeds one-for-one: a hundred days on a wall is a career, a
 * hundred victories is not a thing that happens. Without the weighting every commander in
 * the game would be a Warden by the second month.
 */
export function traitFor(practice: DeedLedger): TraitDef {
  const weight: Partial<Record<DeedKey, number>> = {
    victories: 1, heldTheLine: 1.5, defeats: 1,
    daysDrilled: 0.15, daysGarrisoned: 0.15, daysPatrolled: 0.15,
  }
  let best: TraitDef = TRAITS[TRAITS.length - 1]
  let bestScore = 0
  for (const t of TRAITS) {
    if (!t.from) continue
    const score = (practice[t.from] ?? 0) * (weight[t.from] ?? 1)
    // Strictly greater, so the list order breaks ties and the same record always raises
    // the same man.
    if (score > bestScore) { bestScore = score; best = t }
  }
  return best
}

/** Rank from battles commanded, bounded. What he is worth, and what dying loses you. */
export function commanderRank(c: Commander | null | undefined): number {
  if (!c) return 0
  const cfg = GameConfig.commander()
  const r = 1 + Math.floor(Math.max(0, c.battles) / Math.max(1, cfg.battlesPerRank))
  return Math.min(COMMANDER_MAX_RANK, r)
}

/** What he is worth to his legion, on the same channels as everything else. */
export function commanderChannels(c: Commander | null | undefined): LegionChannels {
  const trait = traitById(c?.trait)
  if (!c || !trait) return { ...NO_CHANNELS }
  const ch: LegionChannels = { ...NO_CHANNELS }
  trait.apply(ch, commanderRank(c))
  return ch
}

/**
 * Does he fall in the battle just resolved?
 *
 * A defeat in which the legion lost more than half of what it fielded. Deterministic on
 * purpose — a battle in this game replays exactly from its seed, and a die roll here would
 * be the one part of a resolved battle that could not.
 */
export function commanderFalls(
  c: Commander | null | undefined, won: boolean, fielded: number, lost: number,
): boolean {
  if (!c || won || fielded <= 0) return false
  return lost / fielded > GameConfig.commander().fallsAboveLossPct / 100
}

/** Why no commander can be raised here. `null` = one can. */
export function appointBlocker(
  legion: { commander?: Commander | null; practice?: DeedLedger },
  cohortCount: number,
  wallet: number,
): string | null {
  if (legion.commander) return 'This legion already has a commander'
  if (cohortCount <= 0) return 'A legion with no cohorts has nobody to command'
  const cfg = GameConfig.commander()
  const battles = legion.practice?.battles ?? 0
  if (battles < cfg.minBattles) {
    return `Needs ${cfg.minBattles} battles behind it, has ${battles} — a legion raises its own`
  }
  if (wallet < cfg.appointCostCopper) {
    return `Costs ${cfg.appointCostCopper.toLocaleString()}c to raise one`
  }
  return null
}

/** Why he cannot be moved to that legion. `null` = he can. */
export function transferBlocker(
  from: { id: string; commander?: Commander | null },
  to: { id: string; commander?: Commander | null; name: string },
  toCohorts: number,
): string | null {
  if (!from.commander) return 'There is nobody to move'
  if (from.id === to.id) return 'He is already there'
  if (to.commander) return `${to.name} already has a commander`
  if (toCohorts <= 0) return `${to.name} has no cohorts for him to command`
  return null
}

export function describeCommander(c: Commander): string {
  const trait = traitById(c.trait)
  const rank = commanderRank(c)
  return `${c.name}, ${trait?.name ?? 'unknown'} · rank ${rank} · ${c.battles} ${c.battles === 1 ? 'battle' : 'battles'} commanded`
}

/** What his trait is doing, in the words the screen uses for everything else. */
export function describeTrait(c: Commander): string {
  const ch = commanderChannels(c)
  const out: string[] = []
  if (ch.moraleFloor > 0) out.push(`+${ch.moraleFloor} to the morale they come back with`)
  if (ch.defeatXpBonus > 0) out.push(`a defeat teaches ${Math.round(ch.defeatXpBonus * 100)}% more`)
  if (ch.drillXpMult !== 1) out.push(`training XP ×${ch.drillXpMult.toFixed(2)}`)
  if (ch.victoryStipend > 0) out.push(`${ch.victoryStipend}c on every victory`)
  if (ch.dutyCopperMult !== 1) out.push(`duties ${Math.round((1 - ch.dutyCopperMult) * 100)}% cheaper`)
  return out.join(' · ') || '—'
}

/** Player-typed, so it goes through the same sanitiser as every other authored name. */
export function suggestCommanderName(legionName: string): string {
  return `Commander of ${legionName}`.slice(0, COMMANDER_NAME_MAX)
}
