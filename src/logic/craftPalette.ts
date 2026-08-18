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
// change its mind, and what does it give up" — and it bites precisely because the specialised
// house is the one that cannot follow you when your needs change.
//
// ── The two measurements this palette is priced against ────────────────────────────────
//
// (a) GOODS ALREADY BEAT COIN by about 43% at any building with no recipe: the day's material
//     half becomes `remainderValue / 0.7` of market value, so a mill on full goods turns out
//     1.43× what the same mill on full coin pays. `coinMult` and `goodsMult` therefore must
//     NOT share a cap — capping them equally would quietly make goods the only sane choice.
//
// (b) THE ARMY EARNS −2c PER SOLDIER PER DAY on patrol, against 83–417c a day for one posted
//     hand. So a craft channel is not sized against `POP_MAX_STAFF_BONUS` alone; it is sized
//     against how much better working already is than fighting. Every ceiling here is
//     deliberately tight, and the lever to loosen it lives in `GameConfig`.
//
// ── Points come only from demands ──────────────────────────────────────────────────────
//
// There is no free budget and no wallet that fills with time. `availableCraftPoints(design)`
// IS `rebateTotal(design)`: every point of bonus is bought with a freedom given up. A craft
// that only gives is a bonus wearing a costume.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig, CRAFT_CHANNEL_CAP, type CraftPrimNumbers } from './config'

/** The channels a craft may touch. All of them are DOMAIN channels; none is a combat stat. */
export type CraftChannel = 'coinMult'

export interface CraftChannels {
  /** Multiplies the coin half of the day, after the split. 1 = untouched. */
  coinMult: number
}

export const NO_CRAFT: CraftChannels = { coinMult: 1 }

/**
 * What a house has to have DONE for a piece to be takeable.
 *
 * Every proof is a SHARE of the house's own ledger, never a total, and the shares are rival
 * with each other because coin, goods and study are three slices of one scalar. A total would
 * only ever measure how long you have been playing — which is the clock's job, and the clock
 * is the one thing a promise must not be priced in.
 */
export type CraftProof = 'coinShare' | 'fullShare' | 'leanShare'

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
  /** The share the proof must reach for the FIRST step, as a percent. */
  proofPct: number
  /** How much more each further step asks for, in points of that percent. */
  proofPctPerStep: number
}

/**
 * Three pieces on one channel, with three DIFFERENT proofs. Deliberately: two pieces sharing
 * a proof would make one of them redundant the moment the other was takeable, and the palette
 * would be one piece pretending to be two.
 */
export const CRAFT_PRIMS: CraftPrim[] = [
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
]

export function primById(id: string): CraftPrim | null {
  return CRAFT_PRIMS.find((p) => p.id === id) ?? null
}

/** Config-resolved numbers for one piece. Nothing here is ever stored in a save. */
export function primNumbers(p: CraftPrim): CraftPrimNumbers {
  return GameConfig.craftPrim(p.id, { step: p.step, points: p.points, proofPct: p.proofPct })
}

// ── Demands ───────────────────────────────────────────────────────────────────────────
//
// A demand is what the house gives up. Two kinds, and the kind is DERIVED from the demand
// rather than carried as a flag — a flag can be set wrong, and this distinction decides
// whether a broken promise refuses a click or merely puts the craft to sleep.
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

export type CraftDemandKind = CraftDemand['kind']

export function isMonotone(d: CraftDemand): boolean {
  return d.kind !== 'MIN_HANDS'
}

export function isProportional(d: CraftDemand): boolean {
  return !isMonotone(d)
}

/**
 * The floors that make a demand a demand.
 *
 * A demand that demands nothing is the failure this whole shape stands or falls on: it buys
 * points for free and turns "gives and takes" into a tick-box. The tradition slice paid for
 * this lesson and it is the same lesson here.
 */
export const CRAFT_FLOOR = {
  /** Above this, capping coin refuses nothing a player would want anyway. */
  capCoinMaxPct: 80,
  capStudyMaxPct: 80,
  minGoodsMinPct: 20,
  /**
   * Strictly above 50, because `creditsADayOfWork` ALREADY requires half the crew present
   * for a day to count at all. A `MIN_HANDS` at or below half would promise something the
   * game demands regardless — a rebate for nothing.
   */
  minHandsPct: 51,
  /** A cap that leaves room for the whole crew refuses nothing. */
  maxHandsPct: 99,
} as const

/** The percentages a player may pick, matching the slider stops they constrain. */
export const CRAFT_PCT_OPTIONS = [0, 20, 40, 60, 80] as const

/**
 * What a demand is worth in points.
 *
 * Priced against the house's own BOOKS, never against where a slider happens to sit right
 * now: a promise not to do what you were not doing anyway is worth nothing, and the ledger is
 * the only record of what the house was actually doing.
 */
export function rebateOf(d: CraftDemand, ctx: { crew: number; coinPct: number; studyPct: number; goodsPct: number }): number {
  const rules = GameConfig.craftRules()
  switch (d.kind) {
    // Giving up coin is worth what the house was taking in coin.
    case 'CAP_COIN':
      return points(rules.rebatePerTenPct * (Math.max(0, ctx.coinPct - d.pct) / 10))
    case 'CAP_STUDY':
      return points(rules.rebatePerTenPct * (Math.max(0, ctx.studyPct - d.pct) / 10))
    // Promising a floor is worth the distance from where the house actually sits up to it.
    case 'MIN_GOODS':
      return points(rules.rebatePerTenPct * (Math.max(0, d.pct - ctx.goodsPct) / 10))
    // Hands are the scarce thing, so a hand promised is priced per hand.
    case 'MIN_HANDS':
      return points(rules.rebatePerHand * d.hands)
    case 'MAX_HANDS':
      return points(rules.rebatePerHand * Math.max(0, ctx.crew - d.hands))
  }
}

const points = (n: number) => Math.max(0, Math.round(n))

/** Aggregate ceiling, applied ONCE to the sum. A per-piece cap cannot bound a sum. */
export function clampCraftChannels(ch: CraftChannels): CraftChannels {
  return { coinMult: Math.min(CRAFT_CHANNEL_CAP.coinMult, Math.max(1, ch.coinMult)) }
}

/**
 * A design used only to show what a config change would do, so the admin's effect preview
 * has something sworn to measure. Never stored, never playable — the preview panel reports a
 * silent zero without it, which is the worst possible failure mode for a feature whose whole
 * premise is "we calibrate later".
 */
export const PREVIEW_DESIGN = {
  v: 1 as const,
  name: 'Reference Craft',
  creed: 'For measuring, not for swearing.',
  sworeDay: 1,
  demands: [{ kind: 'CAP_STUDY', pct: 0 }, { kind: 'MIN_HANDS', hands: 2 }] as CraftDemand[],
  nodes: [{ id: 'n0', parent: null, prim: 'COINWISE', steps: 2 }],
}
