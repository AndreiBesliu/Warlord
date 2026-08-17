// src/logic/standard.ts
// The eagle. A legion's identity as a THING that can be taken off the field.
//
// Every other part of a legion is a number that goes down and comes back up. The standard
// is the one piece of it somebody else can be holding, and that is the whole point: it
// turns a defeat from "you lost men" into "they have your eagle, and you know exactly where
// it is".
//
// ── When it falls ──────────────────────────────────────────────────────────────────────
//
// When EVERY cohort the legion put in the line is destroyed. Not when a nominated bearer
// dies — there is no bearer here, deliberately. A bearer would mean a per-battle chore
// ("who carries it today?"), a field to maintain through splits and merges, and a rule to
// re-explain every time a cohort dies. A total wipe needs none of that, it is derivable
// from the battle report that already exists, and it lands on exactly the moment that
// should hurt.
//
// A legion that kept one cohort alive kept its eagle. That is the fiction and the mechanic
// at the same time.
//
// ── What losing it costs ───────────────────────────────────────────────────────────────
//
// The tradition SLEEPS. Not revoked — a legion does not stop being what it swore because it
// was beaten. This reuses the suspension that `outOfKeeping` already has, so there is one
// idea in the game called "your tradition is dormant, here is why", not two.
//
// ── Getting it back ────────────────────────────────────────────────────────────────────
//
// Win at the mission that took it, with the same legion. A findable, nameable goal drawn
// entirely from facts the battle already carries. There is nothing to farm: losing it costs
// a whole deployment, and recovering it returns what you had.
//
// Pure: no React, no Date.now, no Math.random.

import type { Difficulty } from './combat/types'

/** `null` (or absent) = the legion holds its own standard. */
export interface StandardLost {
  /** The mission whose enemy took it — where it must be won back. */
  lostTo: Difficulty
  lostDay: number
}

export function isStandardLost(s: StandardLost | null | undefined): s is StandardLost {
  return !!s && typeof s.lostTo === 'string'
}

/**
 * Did this legion's standard fall in the battle just resolved?
 *
 * `marchedIds` is the DEPLOYMENT snapshot, not the legion as it stands now — the same
 * reason deeds use it. `destroyedIds` are the cohorts that did not come back.
 *
 * A legion that put nothing in the line cannot lose anything, which is why the empty case
 * is false rather than vacuously true: `every` over an empty list would say the eagle fell
 * for a legion that never left camp.
 */
export function standardFalls(marchedIds: string[], destroyedIds: Set<string>): boolean {
  const fielded = [...new Set(marchedIds)]
  if (fielded.length === 0) return false
  return fielded.every((id) => destroyedIds.has(id))
}

/** Is this the battle that wins it back? Same legion, same mission, and a victory. */
export function standardRecovered(
  lost: StandardLost | null | undefined, won: boolean, difficulty: Difficulty, marchedIds: string[],
): boolean {
  return isStandardLost(lost) && won && lost.lostTo === difficulty && marchedIds.length > 0
}

/** Why the legion may not do this while its eagle is in somebody else's hands. `null` = it may. */
export function standardBlocker(
  lost: StandardLost | null | undefined, legionName: string, missionName: string,
): string | null {
  if (!isStandardLost(lost)) return null
  return `${legionName} has lost its standard — win it back at ${missionName} first`
}

/** The line the legion's card carries while the eagle is gone. */
export function describeLoss(lost: StandardLost, missionName: string): string {
  return `Its standard was taken at ${missionName} on day ${lost.lostDay}. `
    + 'Everything the tradition is worth sleeps until the legion wins it back there.'
}
