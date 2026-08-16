// src/logic/duty.ts
// What a legion does on the days it is not fighting.
//
// This exists because of an arithmetic problem, not a flavour one. The domain may fight
// ONE battle a game-day (`lastBattleDay === day`), so battle-fed counters are all drawn
// from a single well: the calendar. Raise eight legions and you do not get eight times the
// progression — you get one battle a day, and the optimal play is to send the strongest
// cohorts, which live in one legion. That legion accrues everything and the other seven
// differentiate themselves by name only.
//
// A duty is the second well. It fills counters a battle never can, it COSTS something, and
// it OCCUPIES the legion for the day — so "which of my legions practises what" becomes a
// standing decision rather than a consequence of who happened to be strongest.
//
// The load-bearing rule, and the reason duty counters are safe:
//
//   BATTLES BUY DEPTH. DUTIES BUY DIRECTION.
//
// Duty days are RECORD, never renown, so they buy no level — they are had by waiting, and
// anything obtainable by waiting must not be a level. What they do is prove a legion has
// repeatedly done a particular thing, which is what a tradition node will ask for. A legion
// that only ever garrisons stays level 1 and can take only shallow nodes; one that only
// ever fights has the level for deep nodes but no proof of any particular character. You
// need both, and that is the whole design.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig } from './config'
import type { DeedKey, DeedLedger } from './practice'

export type DutyId = 'GARRISON' | 'DRILL' | 'PATROL'

/**
 * Extra morale a garrison recovers per day, on top of the ordinary +5. Doubling it is the
 * point: morale gates `computeReady`, so a mauled legion has a real reason to stand down
 * for a few days instead of being thrown straight back in.
 */
export const DUTY_GARRISON_MORALE = 5

export interface DutyDef {
  id: DutyId
  name: string
  /** One line of what it IS, in the fiction. */
  blurb: string
  /** One line of what it DOES, mechanically. */
  effect: string
  /**
   * Copper per soldier per day, charged on top of ordinary upkeep.
   * NEGATIVE means the duty pays its way — see PATROL.
   */
  copperPerSoldier: number
  /** The counter it fills. One duty, one proof. */
  deed: DeedKey
}

/**
 * Three, and deliberately three ECONOMIC SHAPES rather than three flavours: one that is
 * cheap and restores, one that is expensive and grows, one that earns. A fourth duty that
 * was merely a fourth name would add a counter and no decision.
 */
export const DUTIES: DutyDef[] = [
  {
    id: 'GARRISON',
    name: 'Garrison',
    blurb: 'They hold the seat, sleep behind walls, and eat at regular hours.',
    effect: 'Morale recovers twice as fast.',
    copperPerSoldier: 1,
    deed: 'daysGarrisoned',
  },
  {
    id: 'DRILL',
    name: 'Drill camp',
    blurb: 'The yard, every day, until the drill is the only thing left in their hands.',
    effect: 'Its cohorts train, as though each were set to training.',
    copperPerSoldier: 4,
    deed: 'daysDrilled',
  },
  {
    id: 'PATROL',
    name: 'Patrol',
    blurb: 'The roads stay open because they are on them.',
    effect: 'Pays its way from tolls instead of costing you.',
    copperPerSoldier: -2,
    deed: 'daysPatrolled',
  },
]

export function dutyById(id: string | null | undefined): DutyDef | null {
  if (!id) return null
  return DUTIES.find((d) => d.id === id) ?? null
}

/** The duty's numbers as the game will apply them — admin overrides folded in, bounded. */
export function dutyNumbers(def: DutyDef): { copperPerSoldier: number } {
  return GameConfig.duty(def.id, def)
}

/**
 * Copper this duty moves in a day, for a legion of `soldiers`. Positive = you pay.
 *
 * Rounded ONCE at the end rather than per cohort: rounding per cohort and summing makes the
 * bill depend on how the same men happen to be split up, which is a difference the player
 * can see and cannot explain.
 */
export function dutyCostCopper(def: DutyDef, soldiers: number): number {
  return Math.round(dutyNumbers(def).copperPerSoldier * Math.max(0, soldiers))
}

/** Why this legion cannot take a duty. `null` = it can. */
export function dutyBlocker(cohortCount: number): string | null {
  if (cohortCount <= 0) return 'A legion with no cohorts has nobody to send'
  return null
}

/** One day of duty, on the ledger. Duty days are proof, never renown. */
export function creditDuty(ledger: DeedLedger, def: DutyDef): DeedLedger {
  const n = (ledger[def.deed] ?? 0) + 1
  return { ...ledger, [def.deed]: n }
}

/**
 * Why this unit may not take the field. `null` = it may.
 *
 * A duty occupies the legion for the day, and that occupation IS the price — without it a
 * duty would be free progress for legions that were never going to march anyway.
 */
export function marchBlocker(dutyId: string | null | undefined, legionName: string): string | null {
  const def = dutyById(dutyId)
  return def ? `${legionName} is on ${def.name.toLowerCase()} duty` : null
}
