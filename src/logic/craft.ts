// src/logic/craft.ts
// A house's sworn way of working.
//
// ── What is permanent, and what "permanent" honestly means ─────────────────────────────
//
// A craft is sworn once and never unsworn. There is no respec and no second oath — with one
// argued exception: a design this build can no longer read at all (see `craftFaults`).
//
// But be precise about the claim: an oath is permanent WITHIN A SAVE, and a save is
// last-write-wins across devices. That is why the schema-outranks-rev guard in the sister
// repo shipped before this file existed — without it, a second tab hands out exactly the
// respec this file forbids.
//
// ── The design carries no prices ───────────────────────────────────────────────────────
//
// A `CraftDesign` is piece ids, step counts, parent links, two strings, the day it was sworn,
// and WHAT WAS ACTUALLY PROMISED. No point, threshold, ceiling or bonus is ever stored. Every
// number is re-priced at read from `GameConfig`, which buys three separate things:
//   1. an inflated craft is not REPRESENTABLE, so it cannot be forged into a save;
//   2. a config retune applies retroactively to every craft already sworn, with no migration;
//   3. "we calibrate the values later" stays free instead of becoming a data problem.
//
// The promised percentages and hand-counts are not an exception to that rule. A `hands: 9` is
// not a price — it IS the promise, the same way `sworeDay` is.
//
// ── Two kinds of broken promise ────────────────────────────────────────────────────────
//
// `outOfKeeping` is the ONLY authority on whether a house is living up to its oath. The
// controls that refuse are a convenience — they say why, in advance — but a save or a config
// change can arrive already over the line, so the day checks again. A monotone demand found
// broken in the day SUSPENDS the craft rather than refusing anything, because by then there
// is no click left to refuse.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig } from './config'
import {
  CRAFT_FLOOR, NO_CRAFT, clampCraftChannels, isMonotone, isProportional, primById, primNumbers,
  rebateOf, type CraftChannels, type CraftDemand,
} from './craftPalette'
import { crewSizeOf, handsAt, postedHands, type CrewRecord, type PopulationState } from './population'
import type { Building } from './types'

export const CRAFT_NAME_MAX = 40
export const CRAFT_CREED_MAX = 120

export interface CraftNode {
  id: string
  parent: string | null
  prim: string
  steps: number
}

export interface CraftDesign {
  v: 1
  name: string
  creed: string
  sworeDay: number
  demands: CraftDemand[]
  nodes: CraftNode[]
}

/** What the house's own books say about the mix of its days, as shares of 100. */
export interface CraftContext {
  crew: number
  coinPct: number
  studyPct: number
  goodsPct: number
  /** A building whose whole day is coin by construction cannot promise to cap its coin. */
  hasNoItemToMake: boolean
}

/** The shares a proof reads, from the ledger DELTA since the oath. */
export function sharesOf(r: CrewRecord): { coinShare: number; fullShare: number; leanShare: number; days: number } {
  const value = r.coinVal + r.goodsVal + r.studyVal
  const pct = (n: number) => (value > 0 ? Math.round((n / value) * 100) : 0)
  const dayPct = (n: number) => (r.days > 0 ? Math.round((n / r.days) * 100) : 0)
  return {
    coinShare: pct(r.coinVal),
    fullShare: dayPct(r.daysFull),
    leanShare: dayPct(r.daysLean),
    days: r.days,
  }
}

/** What the books say about a house right now, for pricing a demand. */
export function contextFor(b: Building, pop: PopulationState | null | undefined, hasNoItemToMake: boolean): CraftContext {
  const coinPct = b.focusCoinPct
  const studyPct = b.focusResearchPct ?? 0
  return {
    crew: crewSizeOf(b.type),
    coinPct,
    studyPct,
    // What is actually left for goods after study is taken off the top and coin is split.
    goodsPct: Math.max(0, Math.round((100 - studyPct) * ((100 - coinPct) / 100))),
    hasNoItemToMake,
  }
}

// ── Points ────────────────────────────────────────────────────────────────────────────

export function rebateTotal(design: CraftDesign, ctx: CraftContext): number {
  return design.demands.reduce((sum, d) => sum + rebateOf(d, ctx), 0)
}

export function nodePoints(n: CraftNode): number {
  const prim = primById(n.prim)
  if (!prim) return 0
  return primNumbers(prim).points * Math.max(1, Math.min(prim.maxSteps, n.steps))
}

export function spentPoints(design: CraftDesign): number {
  return design.nodes.reduce((sum, n) => sum + nodePoints(n), 0)
}

/** THE invariant: a point of bonus exists only because a freedom was given up for it. */
export function availableCraftPoints(design: CraftDesign, ctx: CraftContext): number {
  return rebateTotal(design, ctx)
}

// ── What it is worth ──────────────────────────────────────────────────────────────────

export function channelsOf(design: CraftDesign): CraftChannels {
  const ch: CraftChannels = { ...NO_CRAFT }
  for (const n of design.nodes) {
    const prim = primById(n.prim)
    if (!prim) continue
    const { step } = primNumbers(prim)
    const steps = Math.max(1, Math.min(prim.maxSteps, n.steps))
    if (prim.channel === 'coinMult') ch.coinMult += step * steps
  }
  return clampCraftChannels(ch)
}

/**
 * What a house's craft is worth TODAY — nothing at all if it is not living up to it.
 *
 * Scaled by how much of the crew turned up, for the same reason the level is: an empty house
 * earns an empty bonus. Note what this is NOT — it does not free hands, in any direction. The
 * craft refuses to pay for hands that are not there; it never supplies them.
 */
export function craftChannelsFor(
  b: Building,
  pop: PopulationState | null | undefined,
  buildings: Building[],
  hasNoItemToMake: boolean,
): CraftChannels {
  const design = craftAt(pop, b)
  if (!design) return { ...NO_CRAFT }
  if (craftFaults(design)) return { ...NO_CRAFT }
  if (outOfKeeping(design, b, pop, buildings, hasNoItemToMake)) return { ...NO_CRAFT }
  const crew = crewSizeOf(b.type)
  if (crew <= 0) return { ...NO_CRAFT }
  const ratio = Math.min(1, handsAt(pop, b) / crew)
  const full = channelsOf(design)
  return clampCraftChannels({ coinMult: 1 + (full.coinMult - 1) * ratio })
}

// ── Keeping ───────────────────────────────────────────────────────────────────────────

/**
 * Why the house is not living up to its oath today. `null` = it is.
 *
 * The single authority. Every control that refuses asks the same question in advance, but
 * only this answer decides whether the craft pays.
 */
export function outOfKeeping(
  design: CraftDesign,
  b: Building,
  pop: PopulationState | null | undefined,
  buildings: Building[],
  hasNoItemToMake: boolean,
): string | null {
  const ctx = contextFor(b, pop, hasNoItemToMake)
  const hands = handsAt(pop, b)
  for (const d of design.demands) {
    const why = demandBroken(d, { ctx, hands, buildings, pop })
    if (why) return why
  }
  return null
}

function demandBroken(
  d: CraftDemand,
  s: { ctx: CraftContext; hands: number; buildings: Building[]; pop: PopulationState | null | undefined },
): string | null {
  switch (d.kind) {
    case 'CAP_COIN':
      return s.ctx.coinPct > d.pct ? `sworn to keep coin at or under ${d.pct}% — it is at ${s.ctx.coinPct}%` : null
    case 'CAP_STUDY':
      return s.ctx.studyPct > d.pct ? `sworn to keep study at or under ${d.pct}% — it is at ${s.ctx.studyPct}%` : null
    case 'MIN_GOODS':
      return s.ctx.goodsPct < d.pct ? `sworn to leave at least ${d.pct}% for goods — only ${s.ctx.goodsPct}% is left` : null
    case 'MAX_HANDS':
      return s.hands > d.hands ? `sworn to work with no more than ${d.hands} hands — ${s.hands} are posted` : null
    case 'MIN_HANDS':
      return s.hands < d.hands ? `it asks for ${d.hands} hands and has ${s.hands}` : null
  }
}

/** The one refusal a control can make in advance, for a change not yet made. */
export function craftBlocker(
  design: CraftDesign | null,
  next: { b: Building; coinPct?: number; studyPct?: number; hands?: number },
  pop: PopulationState | null | undefined,
  hasNoItemToMake: boolean,
): string | null {
  if (!design || craftFaults(design)) return null
  const ctx = contextFor(next.b, pop, hasNoItemToMake)
  const after: CraftContext = {
    ...ctx,
    coinPct: next.coinPct ?? ctx.coinPct,
    studyPct: next.studyPct ?? ctx.studyPct,
  }
  after.goodsPct = Math.max(0, Math.round((100 - after.studyPct) * ((100 - after.coinPct) / 100)))
  const hands = next.hands ?? handsAt(pop, next.b)
  for (const d of design.demands) {
    if (!isMonotone(d)) continue // a proportional demand never refuses anything
    const why = demandBroken(d, { ctx: after, hands, buildings: [], pop })
    if (why) return `${design.name} is ${why}`
  }
  return null
}

// ── Faults: the only thing that is not recoverable ─────────────────────────────────────

/**
 * A question a RECALIBRATION cannot answer: does this build know these pieces at all?
 *
 * Everything a config change could alter goes through `outOfKeeping` instead, which is
 * recoverable and readable. This is the third state, and it exists because of a specific
 * hazard: an unresolvable piece prices at 0, so skipping it node-by-node would make
 * `spentPoints` fall and the wallet refill itself — a point fountain. The whole design faults
 * rather than any node being skipped.
 *
 * (A tradition can afford to skip, because it DROPS what it cannot read at hydration. This
 * one keeps it, so that an older piece coming back is not a data loss. The asymmetry is the
 * reason the two files do different things here.)
 */
export function craftFaults(design: CraftDesign): string | null {
  if (design.v !== 1) return 'this house names a kind of craft this version of the game does not know'
  for (const n of design.nodes) {
    if (!primById(n.prim)) return 'this house names a way of working this version of the game does not know'
  }
  for (const d of design.demands) {
    if (!KNOWN_DEMANDS.includes(d.kind)) return 'this house swore something this version of the game does not know'
  }
  return null
}

const KNOWN_DEMANDS: readonly string[] = ['CAP_COIN', 'CAP_STUDY', 'MIN_GOODS', 'MAX_HANDS', 'MIN_HANDS']

// ── Authoring ─────────────────────────────────────────────────────────────────────────

export interface ValidationResult { ok: boolean; reasons: string[] }

/**
 * Run ONCE, when the oath is sworn. Never at read: everything here can be moved by a config
 * change, and a craft that silently stopped counting because a number moved would be the
 * opposite of "calibrate later".
 */
export function validateDesign(design: CraftDesign, ctx: CraftContext): ValidationResult {
  const reasons: string[] = []
  const name = design.name.trim()
  if (!name) reasons.push('Give the craft a name')
  if (name.length > CRAFT_NAME_MAX) reasons.push(`The name is longer than ${CRAFT_NAME_MAX} characters`)
  if (design.creed.length > CRAFT_CREED_MAX) reasons.push(`The creed is longer than ${CRAFT_CREED_MAX} characters`)

  if (design.demands.length === 0) reasons.push('A craft is what a house gives up — swear at least one demand')
  if (design.demands.length > 0 && !design.demands.some(isMonotone)) {
    reasons.push('A craft must REFUSE something — add a demand the house could break by hand')
  }
  if (design.demands.length > 0 && !design.demands.some(isProportional)) {
    reasons.push('A craft must COST something every day — add a demand on hands')
  }

  for (const d of design.demands) {
    const why = demandDemandsNothing(d, ctx)
    if (why) reasons.push(why)
  }

  const kinds = design.demands.map((d) => d.kind)
  if (new Set(kinds).size !== kinds.length) reasons.push('Each kind of demand may be sworn only once')

  const minH = design.demands.find((d) => d.kind === 'MIN_HANDS')
  const maxH = design.demands.find((d) => d.kind === 'MAX_HANDS')
  if (minH && maxH && minH.kind === 'MIN_HANDS' && maxH.kind === 'MAX_HANDS' && minH.hands > maxH.hands) {
    reasons.push('It cannot ask for more hands than it allows')
  }

  if (design.nodes.length === 0) reasons.push('A craft has to be FOR something — take at least one way of working')
  const budget = availableCraftPoints(design, ctx)
  const spent = spentPoints(design)
  if (spent > budget) {
    reasons.push(`It buys ${spent} points and gives up only ${budget} — every point comes from a demand`)
  }

  // Sworn while already breaking it is not a promise. Checked here rather than left to
  // `outOfKeeping` so the refusal lands before the permanent thing happens.
  for (const d of design.demands) {
    const why = demandBroken(d, { ctx, hands: ctx.crew, buildings: [], pop: null })
    if (why && isMonotone(d)) reasons.push(`It is not in keeping now — ${why}`)
  }

  return { ok: reasons.length === 0, reasons }
}

/** A demand that refuses nothing buys points for free. This is the half the shape rests on. */
function demandDemandsNothing(d: CraftDemand, ctx: CraftContext): string | null {
  switch (d.kind) {
    case 'CAP_COIN':
      if (ctx.hasNoItemToMake) return 'This house has nothing to make, so its whole day is coin — capping it promises nothing'
      return d.pct >= CRAFT_FLOOR.capCoinMaxPct ? `A coin cap of ${d.pct}% refuses nothing` : null
    case 'CAP_STUDY':
      return d.pct >= CRAFT_FLOOR.capStudyMaxPct ? `A study cap of ${d.pct}% refuses nothing` : null
    case 'MIN_GOODS':
      return d.pct <= CRAFT_FLOOR.minGoodsMinPct ? `A goods floor of ${d.pct}% refuses nothing` : null
    case 'MIN_HANDS': {
      const floor = Math.ceil((CRAFT_FLOOR.minHandsPct / 100) * ctx.crew)
      // Named explicitly, because a day already needs half the crew to count at all: a
      // promise at or under half is a promise the game was making for you.
      return d.hands < floor
        ? `Fewer than ${floor} hands promises nothing — a day already needs half the crew to count`
        : null
    }
    case 'MAX_HANDS':
      return d.hands >= ctx.crew ? `A cap of ${d.hands} hands refuses nothing — the crew is ${ctx.crew}` : null
  }
}

// ── Standing: what a house has kept ───────────────────────────────────────────────────

export function standingOf(pop: PopulationState | null | undefined, b: Building): number {
  const raw = Math.floor(Number(pop?.kept?.[b.id]) || 0)
  return raw > 0 ? raw : 0
}

export function craftAt(pop: PopulationState | null | undefined, b: Building): CraftDesign | null {
  const d = pop?.craft?.[b.id]
  return d ?? null
}

export function swornAt(pop: PopulationState | null | undefined, b: Building): CrewRecord | null {
  return pop?.sworn?.[b.id] ?? null
}

// ── Words ─────────────────────────────────────────────────────────────────────────────

export function describeDemand(d: CraftDemand): string {
  switch (d.kind) {
    case 'CAP_COIN': return `never more than ${d.pct}% coin`
    case 'CAP_STUDY': return `never more than ${d.pct}% to study`
    case 'MIN_GOODS': return `always at least ${d.pct}% left for goods`
    case 'MAX_HANDS': return `never more than ${d.hands} hands`
    case 'MIN_HANDS': return `at least ${d.hands} hands, every day`
  }
}

export function describeChannels(ch: CraftChannels): string {
  return ch.coinMult > 1 ? `coin ×${ch.coinMult.toFixed(2)}` : 'nothing yet'
}

export function describeNode(n: CraftNode): string {
  const prim = primById(n.prim)
  if (!prim) return 'something this version does not know'
  const steps = Math.max(1, Math.min(prim.maxSteps, n.steps))
  return `${prim.name}${steps > 1 ? ` ×${steps}` : ''}`
}

/** For the panel: how much of the domain this house is holding, for context on a demand. */
export function postedElsewhere(
  pop: PopulationState | null | undefined, b: Building, buildings: Building[],
): number {
  return Math.max(0, postedHands(pop, buildings) - handsAt(pop, b))
}

export function proofMinDays(): number {
  return GameConfig.craftRules().proofMinDays
}
