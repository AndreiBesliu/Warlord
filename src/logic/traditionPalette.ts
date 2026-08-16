// src/logic/traditionPalette.ts
// The vocabulary a player builds a tradition out of: what an attribute can DO, what it
// costs, and — decisively — what it demands as proof.
//
// Everything here is supplied by the game. The player chooses WHICH pieces, HOW MANY steps,
// what hangs off what, and what the whole thing is called. They never type a number that
// becomes a bonus. That single restraint is what makes authoring safe: a design carries
// primitive ids and step counts, never values, so an inflated tradition is not
// REPRESENTABLE rather than merely refused.
//
// ── Why these five channels and not the ones that shipped ──────────────────────────────
//
// The first cut of traditions paid in `postBattleMorale` and `battleXpMult`. Both were
// measured afterwards and both were very nearly inert:
//
//   Morale recovers +5/day for free whenever the men are paid and fed, and it is clamped
//   to 100. A well-run domain therefore sits at the ceiling permanently and an addition
//   clamps away to nothing. So morale becomes a FLOOR — "they never come back worse than
//   this" — which is worth exactly nothing on a good day and everything after a mauling.
//   A bonus that cannot be wasted is a bonus you can price.
//
//   Battle XP is `min(XP_CAP, 100·kills/survivors)`, so a multiplier changes the result
//   only when a cohort killed fewer than 0.6 enemies per surviving man. That is BACKWARDS:
//   the cohorts doing the killing — cavalry, the whole point of a mounted tradition — are
//   exactly the ones the cap eats first. There is no honest repair while the cap binds, and
//   the cap must bind, so battle-XP multiplication is gone. Learning moved to two places
//   the cap does not reach: the drill yard, and defeat.
//
// The rule that survives unchanged: DOMAIN CHANNELS ONLY. Nothing here reaches the combat
// engine or the byte-identical copy of it the PvP server runs.

import type { DeedKey } from './practice'
import type { TypeClass } from './tradition'

export type Channel =
  | 'moraleFloor'
  | 'defeatXpBonus'
  | 'drillXpMult'
  | 'victoryStipend'
  | 'dutyCopperMult'

/** What a legion's earned attributes are worth, folded. Identity = "no tradition at all". */
export interface LegionChannels {
  /** Its cohorts never return from a battle below this morale. */
  moraleFloor: number
  /** Added to the 0.4 of battle XP a defeat normally keeps. Bounded so it never exceeds 1. */
  defeatXpBonus: number
  /** Multiplies daily training XP for its cohorts. */
  drillXpMult: number
  /** Copper paid on top of loot for a victory. Flat: a multiplier would compound with army size. */
  victoryStipend: number
  /** Multiplies what its duties cost. Below 1 = cheaper; a patrol's earnings scale too. */
  dutyCopperMult: number
}

export const NO_CHANNELS: Readonly<LegionChannels> = Object.freeze({
  moraleFloor: 0,
  defeatXpBonus: 0,
  drillXpMult: 1,
  victoryStipend: 0,
  dutyCopperMult: 1,
})

/**
 * AGGREGATE ceilings. A per-node cap does not bound a sum, and with twelve nodes a player
 * finds that out before you do — so the clamp is on the total, in one place, the way
 * `clampModifiers` does it for research.
 */
export const CHANNEL_CAP = {
  /** Never a free full-morale army: past this you would stop feeling a defeat at all. */
  moraleFloor: 60,
  /** 0.4 + 0.6 = 1.0. A defeat may teach as much as a victory, never more. */
  defeatXpBonus: 0.6,
  drillXpMult: 2,
  victoryStipend: 2000,
  /** A duty may become free, never a printer. */
  dutyCopperMult: 0.4,
} as const

export function clampChannels(c: LegionChannels): LegionChannels {
  return {
    moraleFloor: Math.min(CHANNEL_CAP.moraleFloor, Math.max(0, Math.round(c.moraleFloor))),
    defeatXpBonus: Math.min(CHANNEL_CAP.defeatXpBonus, Math.max(0, c.defeatXpBonus)),
    drillXpMult: Math.min(CHANNEL_CAP.drillXpMult, Math.max(0, c.drillXpMult)),
    victoryStipend: Math.min(CHANNEL_CAP.victoryStipend, Math.max(0, Math.round(c.victoryStipend))),
    dutyCopperMult: Math.max(CHANNEL_CAP.dutyCopperMult, Math.min(1, c.dutyCopperMult)),
  }
}

export interface EffectPrim {
  id: string
  name: string
  /** One line of what it IS. */
  blurb: string
  channel: Channel
  /** What one purchased step is worth on that channel. */
  step: number
  maxSteps: number
  /** Points one step costs. */
  points: number
  /**
   * The counter this attribute demands as proof — a property of the PIECE, never of the
   * design. If the author picked the proof they would pick one they already meet, and
   * "practises actions relevant to the tradition" would evaporate into a formality.
   */
  proof: DeedKey
  /** How much of that proof one step demands. */
  proofPerStep: number
}

/**
 * Ten pieces, five channels, and TEN DISTINCT PROOFS — the proofs are where the variety
 * lives. Two pieces on the same channel are not the same piece if the road to them runs
 * through garrison duty in one case and through dead horsemen in the other.
 */
export const EFFECT_PRIMS: EffectPrim[] = [
  {
    id: 'UNBROKEN', name: 'Unbroken', channel: 'moraleFloor', step: 10, maxSteps: 4, points: 3,
    blurb: 'They have been here before, and they were still standing at the end of it.',
    proof: 'heldTheLine', proofPerStep: 2,
  },
  {
    id: 'STEADFAST', name: 'Steadfast', channel: 'moraleFloor', step: 6, maxSteps: 3, points: 2,
    blurb: 'Long watches make quiet men, and quiet men do not run.',
    proof: 'daysGarrisoned', proofPerStep: 20,
  },
  {
    id: 'SHAFTBREAKERS', name: 'Shaftbreakers', channel: 'moraleFloor', step: 8, maxSteps: 3, points: 3,
    blurb: 'Arrows stopped frightening them a long time ago.',
    proof: 'slainArcher', proofPerStep: 120,
  },
  {
    id: 'HARD_LESSONS', name: 'Hard Lessons', channel: 'defeatXpBonus', step: 0.15, maxSteps: 4, points: 3,
    blurb: 'Nobody in this legion has to be told what losing costs.',
    proof: 'defeats', proofPerStep: 3,
  },
  {
    id: 'RELENTLESS', name: 'Relentless', channel: 'drillXpMult', step: 0.12, maxSteps: 3, points: 3,
    blurb: 'Coming home whole is not luck. It is the hundredth repetition.',
    proof: 'flawless', proofPerStep: 2,
  },
  {
    id: 'DRILLMASTERS', name: 'Drillmasters', channel: 'drillXpMult', step: 0.15, maxSteps: 4, points: 2,
    blurb: 'The yard has its own sergeants now, and they are worse than yours.',
    proof: 'daysDrilled', proofPerStep: 20,
  },
  {
    id: 'SPOILS', name: 'Spoils', channel: 'victoryStipend', step: 150, maxSteps: 5, points: 2,
    blurb: 'They know what is worth carrying and what is worth burning.',
    proof: 'victories', proofPerStep: 3,
  },
  {
    id: 'HORSEBREAKERS', name: 'Horsebreakers', channel: 'victoryStipend', step: 250, maxSteps: 4, points: 3,
    blurb: 'A dead rider leaves a live horse, and a live horse is money.',
    proof: 'slainMounted', proofPerStep: 120,
  },
  {
    id: 'OUTRIDERS', name: 'Outriders', channel: 'dutyCopperMult', step: -0.15, maxSteps: 4, points: 2,
    blurb: 'They know every road, every ford, and every innkeeper who owes them.',
    proof: 'daysPatrolled', proofPerStep: 20,
  },
  {
    id: 'QUARTERMASTERS', name: 'Quartermasters', channel: 'dutyCopperMult', step: -0.10, maxSteps: 3, points: 2,
    blurb: 'Somebody in this legion can always find another wagon.',
    proof: 'slainHeavyFoot', proofPerStep: 120,
  },
]

export function primById(id: string | null | undefined): EffectPrim | null {
  if (!id) return null
  return EFFECT_PRIMS.find((p) => p.id === id) ?? null
}

// ── Constraints ────────────────────────────────────────────────────────────────────────

export type ConstraintKind = 'DENY' | 'MAX_COHORTS' | 'SHARE' | 'MIN_COHORTS'

export type Constraint =
  | { kind: 'DENY'; cls: TypeClass }
  | { kind: 'MAX_COHORTS'; n: number }
  | { kind: 'SHARE'; cls: TypeClass; minPct: number }
  | { kind: 'MIN_COHORTS'; n: number }

/**
 * MONOTONE means "closed under removal" — you can only break it by ADDING a cohort. Those
 * are the ones that can honestly refuse at the door. The rest can break while the player
 * does nothing at all (a cohort dies in battle), so they suspend the bonus instead.
 *
 * DERIVED from the kind, never a flag on the authored constraint. An author who could mark
 * a proportion rule as a ban would ship a legion that one casualty destroys.
 */
export function isMonotone(c: Constraint): boolean {
  return c.kind === 'DENY' || c.kind === 'MAX_COHORTS'
}

/**
 * The smallest a constraint may be and still constrain anything.
 *
 * This is the load-bearing half of authoring. Every constraint kind has a NO-OP
 * instantiation: `MAX_COHORTS 12` refuses nothing because twelve is already the hard cap,
 * `MIN_COHORTS 1` is satisfied by existing, `SHARE 1%` is satisfied by one cohort in a
 * hundred. Without these floors a player authors twelve nodes behind twelve free "bans",
 * pays nothing, and the constraint — the entire thesis — becomes a checkbox that says yes.
 */
export const CONSTRAINT_FLOOR = {
  /** Must be strictly under the legion cap, or it forbids nothing. */
  maxCohortsBelow: 12,
  minCohorts: 4,
  sharePct: 25,
} as const

/** Points a constraint gives back, by how much it actually costs to keep. */
export function rebateOf(c: Constraint): number {
  switch (c.kind) {
    case 'DENY': return 4
    // The tighter the host, the more it gives back: at 3 cohorts a legion has given up
    // most of what a legion is.
    case 'MAX_COHORTS': return 2 + Math.max(0, CONSTRAINT_FLOOR.maxCohortsBelow - c.n)
    case 'SHARE': return Math.round(c.minPct / 12)
    case 'MIN_COHORTS': return Math.round(c.n / 2)
  }
}

// ── Points and tiers ───────────────────────────────────────────────────────────────────

/** Level required to reach a node at each depth. Depth 0 is free; the rest is earned. */
export const TIER_LEVEL = [1, 3, 5, 7, 9] as const
export const MAX_DEPTH = TIER_LEVEL.length - 1

export const DESIGN_MAX_NODES = 12
export const DESIGN_MAX_CONSTRAINTS = 4
export const TRADITION_NAME_MAX = 40
export const TRADITION_CREED_MAX = 120

/**
 * The wallet that fills with level. Constraints pay out immediately, at founding — a legion
 * that gave up horses is already better on foot at level 1, which is the right feel: you
 * are paid for the promise, then you grow into what it lets you buy.
 */
export function pointBudget(level: number): number {
  return 3 + 2 * Math.max(0, level - 1)
}

/**
 * The most the demands may ever be worth, together.
 *
 * An ABSOLUTE cap rather than a fraction of what the tree costs. A fraction was the right
 * shape when a whole tree was authored up front and could be measured; once attributes are
 * added one at a time, a tree's cost is whatever it happens to be so far, and a rule
 * relative to that would refuse a legion for having grown SLOWLY. This is the level-6
 * budget, so giving things up can front-load a legion to mid-game spending power and never
 * past it — after that, level has to do the work.
 */
export const MAX_REBATE = 12

/**
 * Ready-made demands a player picks from.
 *
 * Parameterised options rather than free numbers, for the same reason the effect pieces
 * have fixed steps: every value here is already past `CONSTRAINT_FLOOR`, so a player cannot
 * accidentally author a promise that promises nothing. The forge can open the parameters up
 * later; the floors in `validateDesign` are what keep that safe when it does.
 */
export const CONSTRAINT_OPTIONS: { label: string; value: Constraint }[] = [
  { label: 'Never horsemen', value: { kind: 'DENY', cls: 'MOUNTED' } },
  { label: 'Never men on foot', value: { kind: 'DENY', cls: 'FOOT' } },
  { label: 'Never archers', value: { kind: 'DENY', cls: 'ARCHER' } },
  { label: 'At most 6 cohorts', value: { kind: 'MAX_COHORTS', n: 6 } },
  { label: 'At most 9 cohorts', value: { kind: 'MAX_COHORTS', n: 9 } },
  { label: 'At least 8 cohorts', value: { kind: 'MIN_COHORTS', n: 8 } },
  { label: 'Half heavy foot', value: { kind: 'SHARE', cls: 'HEAVY_FOOT', minPct: 50 } },
  { label: 'Half archers', value: { kind: 'SHARE', cls: 'ARCHER', minPct: 50 } },
  { label: 'Half horsemen', value: { kind: 'SHARE', cls: 'MOUNTED', minPct: 50 } },
]

export function sameConstraint(a: Constraint, b: Constraint): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'DENY' && b.kind === 'DENY') return a.cls === b.cls
  if (a.kind === 'SHARE' && b.kind === 'SHARE') return a.cls === b.cls && a.minPct === b.minPct
  if (a.kind === 'MAX_COHORTS' && b.kind === 'MAX_COHORTS') return a.n === b.n
  if (a.kind === 'MIN_COHORTS' && b.kind === 'MIN_COHORTS') return a.n === b.n
  return false
}
