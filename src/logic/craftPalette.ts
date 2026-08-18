// src/logic/craftPalette.ts
// The vocabulary a house may swear in.
//
// ── Why a craft exists at all ──────────────────────────────────────────────────────────
//
// A building today is completely fungible. Its three settings — what item it makes, the
// coin/goods split, the Research% share — are all draggable at any moment, for free, and the
// hands on it move just as freely. Nothing about a house is ever GIVEN UP, so nothing about
// it is ever an identity.
//
// The craft is the one thing that makes a house stop being general-purpose: it swears, for
// good, not to do certain things with its day, and in exchange it becomes visibly better at
// what it kept. The decision it creates is "which of my houses will no longer be able to
// change its mind" — and it bites precisely because the specialised house is the one that
// cannot follow you when your needs change.
//
// ── HOW A DEMAND IS PRICED, and the defect that taught it ──────────────────────────────
//
// A demand is worth THE RANGE OF FREEDOM IT SURRENDERS, for ever — never the distance
// between the promise and where the house happens to sit today.
//
// The first version priced it as `current − promised`, which reads sensibly until you put it
// beside the other rule: a craft may only be sworn while ALREADY in keeping. Those two
// together force `current === promised` at the only moment the price is ever read, so every
// percentage demand was worth exactly ZERO and the whole vocabulary collapsed to "buy points
// with hands". Priced by the range instead, a cap at 20% surrenders the 20→100 band for
// ever, which is both non-zero and stable — it cannot move when a slider does, so a budget
// already spent can never go underwater.
//
// ── The two measurements the channels are priced against ───────────────────────────────
//
// (a) GOODS ALREADY BEAT COIN by about 43% at any building with no recipe: the day's material
//     half becomes `remainderValue / 0.7` of market value. So `goodsMult` gets a TIGHTER
//     ceiling than `coinMult` — capping them equally would quietly make goods the only sane
//     choice, which is the opposite of a decision.
// (b) THE ARMY EARNS −2c PER SOLDIER PER DAY on patrol, against 83–417c a day for one posted
//     hand. A craft channel is therefore sized against how much better working already is
//     than fighting, not against `POP_MAX_STAFF_BONUS` alone.
//
// ── Points come only from demands ──────────────────────────────────────────────────────
//
// There is no free budget and no wallet that fills with time. `availableCraftPoints(design)`
// IS `rebateTotal(design)`: every point of bonus is bought with a freedom given up. A craft
// that only gives is a bonus wearing a costume.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig, CRAFT_CHANNEL_CAP, type CraftPrimNumbers } from './config'

export type CraftChannel = 'coinMult' | 'goodsMult' | 'studyMult'

export interface CraftChannels {
  /** Multiplies the coin half of the day, after the split. 1 = untouched. */
  coinMult: number
  /** Multiplies the value left for goods. Capped tighter — see (a) above. */
  goodsMult: number
  /** Multiplies the value diverted to study. */
  studyMult: number
}

export const NO_CRAFT: CraftChannels = { coinMult: 1, goodsMult: 1, studyMult: 1 }

/**
 * What a house has to have DONE for a piece to be takeable.
 *
 * Every proof is a SHARE of the house's own ledger since the oath, never a total. A total
 * would only measure how long you have been playing — the clock's job, and the clock is the
 * one thing a promise must not be priced in. The first three are rival by construction: coin,
 * goods and study are three slices of one scalar, so they sum to 100 and a house cannot prove
 * all three.
 */
export type CraftProof =
  | 'coinShare' | 'goodsShare' | 'studyShare'
  | 'fullShare' | 'leanShare' | 'dryShare' | 'handShare' | 'fed'

export interface CraftPrim {
  id: string
  name: string
  blurb: string
  channel: CraftChannel
  /** What one step is worth on that channel. */
  step: number
  maxSteps: number
  /** Points one step costs. */
  points: number
  proof: CraftProof
  /** The share the proof must reach for the FIRST step, as a percent (or a count, for `fed`). */
  proofPct: number
  /** How much more each further step asks for. */
  proofPctPerStep: number
}

/**
 * Ten pieces, three channels, EIGHT distinct proofs — and no two pieces on the same channel
 * share one. Two pieces proving the same thing would make one redundant the moment the other
 * became takeable, and the palette would be smaller than it looks.
 */
export const CRAFT_PRIMS: CraftPrim[] = [
  // ── coin ────────────────────────────────────────────────────────────────────────────
  {
    id: 'COINWISE', name: 'Coinwise', channel: 'coinMult',
    blurb: 'A house that has sold rather than stockpiled learns what its day is worth.',
    step: 0.05, maxSteps: 4, points: 2,
    proof: 'coinShare', proofPct: 50, proofPctPerStep: 10,
  },
  {
    id: 'FULL_HANDS', name: 'Full Hands', channel: 'coinMult',
    blurb: 'Every post filled, every day. Nothing here is waiting on somebody.',
    step: 0.04, maxSteps: 4, points: 2,
    proof: 'fullShare', proofPct: 60, proofPctPerStep: 10,
  },
  {
    id: 'THRIFT', name: 'Thrift', channel: 'coinMult',
    blurb: 'It has made its days out of nothing before, and remembers how.',
    step: 0.06, maxSteps: 3, points: 3,
    proof: 'leanShare', proofPct: 40, proofPctPerStep: 15,
  },
  // ── goods ───────────────────────────────────────────────────────────────────────────
  {
    id: 'MAKERS_HAND', name: "Maker's Hand", channel: 'goodsMult',
    blurb: 'It would rather turn out a thing than a price for it.',
    step: 0.04, maxSteps: 4, points: 3,
    proof: 'goodsShare', proofPct: 50, proofPctPerStep: 10,
  },
  {
    id: 'DEEP_STORES', name: 'Deep Stores', channel: 'goodsMult',
    blurb: 'It has eaten its way through more raw stuff than anyone kept count of.',
    step: 0.05, maxSteps: 3, points: 3,
    proof: 'fed', proofPct: 200, proofPctPerStep: 300,
  },
  {
    id: 'MANY_HANDS', name: 'Many Hands', channel: 'goodsMult',
    blurb: 'Crowded, loud, and it turns out more for it.',
    step: 0.03, maxSteps: 4, points: 2,
    proof: 'handShare', proofPct: 70, proofPctPerStep: 10,
  },
  // ── study ───────────────────────────────────────────────────────────────────────────
  {
    id: 'THE_LONG_BENCH', name: 'The Long Bench', channel: 'studyMult',
    blurb: 'It gave its day to the question instead of the ledger, and kept doing it.',
    step: 0.06, maxSteps: 4, points: 2,
    proof: 'studyShare', proofPct: 40, proofPctPerStep: 10,
  },
  {
    id: 'IDLE_HOURS', name: 'Idle Hours', channel: 'studyMult',
    blurb: 'Days with nothing to make are days somebody spent thinking.',
    step: 0.05, maxSteps: 3, points: 2,
    proof: 'dryShare', proofPct: 20, proofPctPerStep: 15,
  },
]

export function primById(id: string): CraftPrim | null {
  return CRAFT_PRIMS.find((p) => p.id === id) ?? null
}

/** Config-resolved numbers for one piece. Nothing here is ever stored in a save. */
export function primNumbers(p: CraftPrim): CraftPrimNumbers {
  return GameConfig.craftPrim(p.id, { step: p.step, points: p.points, proofPct: p.proofPct })
}

/**
 * Days kept the Nth depth of the tree asks for. `[0] > 0` on purpose: even the first node
 * costs standing, or a house could swear and immediately take everything it could afford.
 *
 * Gated on `kept` — days IN KEEPING — and NOT on the crew's level. A reader will expect
 * `crewLevelAt` here, because that is how a legion's tree works. It would be wrong: the crew
 * level is bought with days worked, which the calendar hands out to any house with hands on
 * it, whereas standing is only had by keeping a promise that costs something every day.
 */
export const TIER_STANDING = [1, 3, 7] as const
export const MAX_DEPTH = TIER_STANDING.length - 1

// ── Demands ───────────────────────────────────────────────────────────────────────────
//
// Two kinds, and the kind is DERIVED from the demand rather than carried as a flag — a flag
// can be set wrong, and this distinction decides whether a broken promise refuses a click or
// merely puts the craft to sleep.
//
//   MONOTONE     — it can only be broken by an act (dragging a slider, posting a hand). It
//                  refuses AT the control, and is checked again in the day, because a save
//                  or a config change can arrive already over the line.
//   PROPORTIONAL — it breaks on its own, as the domain changes around it. It never refuses
//                  anything; it SUSPENDS the craft until the house is in keeping again.

export type CraftDemand =
  | { kind: 'CAP_COIN'; pct: number }
  | { kind: 'CAP_STUDY'; pct: number }
  | { kind: 'MIN_GOODS'; pct: number }
  | { kind: 'MAX_HANDS'; hands: number }
  | { kind: 'MIN_HANDS'; hands: number }
  | { kind: 'SHARE_OF_POSTS'; pct: number }

export type CraftDemandKind = CraftDemand['kind']

const PROPORTIONAL: readonly CraftDemandKind[] = ['MIN_HANDS', 'SHARE_OF_POSTS']

export function isProportional(d: CraftDemand): boolean {
  return PROPORTIONAL.includes(d.kind)
}

export function isMonotone(d: CraftDemand): boolean {
  return !isProportional(d)
}

/**
 * The floors that make a demand a demand.
 *
 * A demand that demands nothing is the failure this whole shape stands or falls on: it buys
 * points for free and turns "gives and takes" into a tick-box. The tradition slice paid for
 * this lesson; it is the same lesson here.
 */
export const CRAFT_FLOOR = {
  capCoinMaxPct: 80,
  capStudyMaxPct: 80,
  minGoodsMinPct: 20,
  /**
   * Strictly above 50, because `creditsADayOfWork` ALREADY requires half the crew present for
   * a day to count at all. A `MIN_HANDS` at or below half would promise something the game
   * demands regardless — a rebate for nothing.
   */
  minHandsPct: 51,
  maxHandsPct: 99,
  /** Below this the house is promising a share of the domain it would hold anyway. */
  shareOfPostsMinPct: 10,
} as const

/** The percentages a player may pick, matching the slider stops they constrain. */
export const CRAFT_PCT_OPTIONS = [0, 20, 40, 60, 80] as const
export const CRAFT_SHARE_OPTIONS = [10, 20, 30, 40, 50] as const

/**
 * What a demand is worth in points: the RANGE of freedom it surrenders, permanently.
 *
 * Never `current − promised` — see the header. That version was always zero, because a craft
 * may only be sworn while already in keeping.
 */
export function rebateOf(d: CraftDemand, ctx: { crew: number }): number {
  const rules = GameConfig.craftRules()
  const perTen = (pctGivenUp: number) => points(rules.rebatePerTenPct * (pctGivenUp / 10))
  switch (d.kind) {
    // Everything above the cap is surrendered for good.
    case 'CAP_COIN': return perTen(100 - d.pct)
    case 'CAP_STUDY': return perTen(100 - d.pct)
    // Everything below the floor is surrendered for good.
    case 'MIN_GOODS': return perTen(d.pct)
    // Hands are the scarce thing, so a hand promised is priced per hand.
    case 'MIN_HANDS': return points(rules.rebatePerHand * d.hands)
    case 'MAX_HANDS': return points(rules.rebatePerHand * Math.max(0, ctx.crew - d.hands))
    // A share of the WHOLE domain's posts — the most expensive promise there is, because it
    // tightens every time you build something else.
    case 'SHARE_OF_POSTS': return perTen(d.pct) * 2
  }
}

const points = (n: number) => Math.max(0, Math.round(n))

/** Aggregate ceiling, applied ONCE to the sum. A per-piece cap cannot bound a sum. */
export function clampCraftChannels(ch: CraftChannels): CraftChannels {
  return {
    coinMult: Math.min(CRAFT_CHANNEL_CAP.coinMult, Math.max(1, ch.coinMult)),
    goodsMult: Math.min(CRAFT_CHANNEL_CAP.goodsMult, Math.max(1, ch.goodsMult)),
    studyMult: Math.min(CRAFT_CHANNEL_CAP.studyMult, Math.max(1, ch.studyMult)),
  }
}

/**
 * A design used only to show what a config change would do, so the admin's effect preview has
 * something sworn to measure. Never stored, never playable — the preview reports a silent
 * zero without it, which is the worst possible failure mode for a feature whose whole premise
 * is "we calibrate later".
 */
export const PREVIEW_DESIGN = {
  v: 1 as const,
  name: 'Reference Craft',
  creed: 'For measuring, not for swearing.',
  sworeDay: 1,
  demands: [{ kind: 'CAP_STUDY', pct: 0 }, { kind: 'MIN_HANDS', hands: 2 }] as CraftDemand[],
  nodes: [
    { id: 'n0', parent: null, prim: 'COINWISE', steps: 2 },
    { id: 'n1', parent: null, prim: 'MAKERS_HAND', steps: 2 },
    { id: 'n2', parent: null, prim: 'THE_LONG_BENCH', steps: 2 },
  ],
}
