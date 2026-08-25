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
// ── Growing it: four gates, and the one a reader will get wrong ────────────────────────
//
//   parent   — depth is bought one node at a time, so a tree is a history, not a shopping list
//   STANDING — days spent IN KEEPING. Not days worked, and NOT the crew's level.
//   proof    — a share of the house's own books SINCE THE OATH, never a total
//   points   — still only from demands
//
// The one to watch is standing. A reader will reach for `crewLevelAt` here, because that is
// how a legion's tree works, and it would be wrong: the crew level is bought with days
// WORKED, which the calendar hands to any house with hands on it. Standing is only had by
// keeping a promise that costs something every single day.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig } from './config'
import {
  CRAFT_FLOOR, MAX_DEPTH, NO_CRAFT, TIER_STANDING, clampCraftChannels, isMonotone,
  isProportional, primById, primNumbers, rebateOf,
  type CraftChannels, type CraftDemand, type CraftPrim, type CraftProof,
} from './craftPalette'
import {
  assignBlocker, crewSizeOf, emptyRecord, handsAt, postedHands, totalCrewPosts,
  type CrewRecord, type PopulationState,
} from './population'
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

/** What a demand is priced and judged against. */
export interface CraftContext {
  crew: number
  coinPct: number
  studyPct: number
  goodsPct: number
  /** A building whose whole day is coin by construction cannot promise to cap its coin. */
  hasNoItemToMake: boolean
  /** A farm's "goods" are food, and food is the population ceiling. See `validateDesign`. */
  isFarm: boolean
}

export function contextFor(b: Building, hasNoItemToMake: boolean): CraftContext {
  const coinPct = b.focusCoinPct
  const studyPct = b.focusResearchPct ?? 0
  return {
    crew: crewSizeOf(b.type),
    coinPct,
    studyPct,
    // What is actually left for goods after study is taken off the top and coin is split.
    goodsPct: Math.max(0, Math.round((100 - studyPct) * ((100 - coinPct) / 100))),
    hasNoItemToMake,
    isFarm: b.type === 'FARM',
  }
}

// ── The books, since the oath ─────────────────────────────────────────────────────────

/** The ledger delta a proof reads: what the house has done SINCE it swore. */
export function bookSince(pop: PopulationState | null | undefined, b: Building): CrewRecord {
  const now = pop?.record?.[b.id] ?? emptyRecord()
  const at = pop?.sworn?.[b.id] ?? emptyRecord()
  const sub = (k: keyof CrewRecord) => Math.max(0, now[k] - at[k])
  return {
    days: sub('days'), coinVal: sub('coinVal'), goodsVal: sub('goodsVal'), studyVal: sub('studyVal'),
    goods: sub('goods'), fed: sub('fed'), handDays: sub('handDays'),
    daysFull: sub('daysFull'), daysDry: sub('daysDry'), daysLean: sub('daysLean'),
  }
}

/** What each proof reads. Shares of the day for the first three — rival by construction. */
export function proofValue(proof: CraftProof, r: CrewRecord, crew: number): number {
  const value = r.coinVal + r.goodsVal + r.studyVal
  const pct = (n: number) => (value > 0 ? Math.round((n / value) * 100) : 0)
  const dayPct = (n: number) => (r.days > 0 ? Math.round((n / r.days) * 100) : 0)
  switch (proof) {
    case 'coinShare': return pct(r.coinVal)
    case 'goodsShare': return pct(r.goodsVal)
    case 'studyShare': return pct(r.studyVal)
    case 'fullShare': return dayPct(r.daysFull)
    case 'leanShare': return dayPct(r.daysLean)
    case 'dryShare': return dayPct(r.daysDry)
    // Average hands posted as a share of the crew — how CROWDED it has been kept.
    case 'handShare': return r.days > 0 && crew > 0 ? Math.round((r.handDays / r.days / crew) * 100) : 0
    // A count, not a share: raw material actually eaten.
    case 'fed': return r.fed
  }
}

/** What the Nth step of a piece asks its proof for. */
export function proofNeededFor(prim: CraftPrim, steps: number): number {
  const { proofPct } = primNumbers(prim)
  const { proofStepMult } = GameConfig.craftRules()
  return Math.round(proofPct + Math.max(0, steps - 1) * prim.proofPctPerStep * proofStepMult)
}

export function sharesOf(r: CrewRecord): { coinShare: number; fullShare: number; leanShare: number; days: number } {
  return {
    coinShare: proofValue('coinShare', r, 1),
    fullShare: proofValue('fullShare', r, 1),
    leanShare: proofValue('leanShare', r, 1),
    days: r.days,
  }
}

// ── Points ────────────────────────────────────────────────────────────────────────────

export function rebateTotal(design: CraftDesign, ctx: CraftContext): number {
  return design.demands.reduce((sum, d) => sum + rebateOf(d, ctx), 0)
}

const clampSteps = (prim: CraftPrim, steps: number) => Math.max(1, Math.min(prim.maxSteps, steps))

export function nodePoints(n: CraftNode): number {
  const prim = primById(n.prim)
  if (!prim) return 0
  return primNumbers(prim).points * clampSteps(prim, n.steps)
}

export function spentPoints(design: CraftDesign): number {
  return design.nodes.reduce((sum, n) => sum + nodePoints(n), 0)
}

/** THE invariant: a point of bonus exists only because a freedom was given up for it. */
export function availableCraftPoints(design: CraftDesign, ctx: CraftContext): number {
  return rebateTotal(design, ctx)
}

export function pointsLeft(design: CraftDesign, ctx: CraftContext): number {
  return availableCraftPoints(design, ctx) - spentPoints(design)
}

// ── The tree ──────────────────────────────────────────────────────────────────────────

export function nodeDepth(design: CraftDesign, node: CraftNode): number {
  let depth = 0
  let cur: CraftNode | undefined = node
  const seen = new Set<string>()
  while (cur?.parent && !seen.has(cur.id)) {
    seen.add(cur.id)
    const parent: CraftNode | undefined = design.nodes.find((n) => n.id === cur!.parent)
    if (!parent) break
    cur = parent
    depth++
  }
  return Math.min(MAX_DEPTH, depth)
}

/**
 * Days kept the Nth depth asks for. The tier table is a SHAPE and `standingBase` scales it,
 * so one admin lever moves the whole tree instead of three.
 */
export function standingForDepth(depth: number): number {
  const i = Math.max(0, Math.min(TIER_STANDING.length - 1, Math.floor(depth)))
  const base = GameConfig.craftRules().standingBase
  return Math.max(1, Math.round(TIER_STANDING[i] * base))
}

/** Why this piece cannot be taken here. `null` = it can. */
export function growBlocker(
  design: CraftDesign,
  b: Building,
  pop: PopulationState | null | undefined,
  want: { prim: string; parent: string | null },
  ctx: CraftContext,
): string | null {
  const prim = primById(want.prim)
  if (!prim) return 'This version of the game does not know that way of working'
  if (craftFaults(design)) return 'This house names something this version of the game does not know'
  if (design.nodes.some((n) => n.prim === want.prim)) return `${prim.name} is already part of this craft`

  const parent = want.parent ? design.nodes.find((n) => n.id === want.parent) : null
  if (want.parent && !parent) return 'That branch is not part of this craft'
  const depth = parent ? nodeDepth(design, parent) + 1 : 0
  if (depth > MAX_DEPTH) return 'This craft cannot go deeper'

  const need = standingForDepth(depth)
  const have = standingOf(pop, b)
  if (have < need) return `Needs ${need} days kept at this depth — this house has ${have}`

  const why = proofBlocker(prim, 1, b, pop, ctx)
  if (why) return why

  const cost = primNumbers(prim).points
  const left = pointsLeft(design, ctx)
  if (cost > left) return `Costs ${cost} points and only ${Math.max(0, left)} are unspent`
  return null
}

/** Why a piece already taken cannot be deepened by one step. `null` = it can. */
export function deepenBlocker(
  design: CraftDesign,
  b: Building,
  pop: PopulationState | null | undefined,
  nodeId: string,
  ctx: CraftContext,
): string | null {
  const node = design.nodes.find((n) => n.id === nodeId)
  if (!node) return 'That is not part of this craft'
  const prim = primById(node.prim)
  if (!prim) return 'This version of the game does not know that way of working'
  const to = node.steps + 1
  if (to > prim.maxSteps) return `${prim.name} does not go past ${prim.maxSteps}`

  // The proof is asked for the NEW TOTAL, not for the one step. Proving per step while paying
  // per step would let a house climb tier by tier toward a requirement it never meets.
  const why = proofBlocker(prim, to, b, pop, ctx)
  if (why) return why

  // Pay the DIFFERENCE — the earlier steps were already bought.
  const cost = primNumbers(prim).points
  const left = pointsLeft(design, ctx)
  if (cost > left) return `Costs ${cost} more points and only ${Math.max(0, left)} are unspent`
  return null
}

function proofBlocker(
  prim: CraftPrim, steps: number, b: Building,
  pop: PopulationState | null | undefined, ctx: CraftContext,
): string | null {
  const book = bookSince(pop, b)
  const minDays = GameConfig.craftRules().proofMinDays
  // A share out of three days is noise, and it is exactly how a house would qualify for
  // everything on the strength of one lucky morning.
  if (prim.proof !== 'fed' && book.days < minDays) {
    return `Needs ${minDays} days of its own books since the oath — it has ${book.days}`
  }
  const have = proofValue(prim.proof, book, ctx.crew)
  const need = proofNeededFor(prim, steps)
  if (have < need) {
    return `${PROOF_WORDS[prim.proof](need)} — this house is at ${have}${prim.proof === 'fed' ? '' : '%'}`
  }
  return null
}

const PROOF_WORDS: Record<CraftProof, (n: number) => string> = {
  coinShare: (n) => `Needs ${n}% of its days sold as coin`,
  goodsShare: (n) => `Needs ${n}% of its days turned into goods`,
  studyShare: (n) => `Needs ${n}% of its days given to study`,
  fullShare: (n) => `Needs ${n}% of its days fully crewed`,
  leanShare: (n) => `Needs ${n}% of its days making something from nothing`,
  dryShare: (n) => `Needs ${n}% of its days with nothing to turn out`,
  handShare: (n) => `Needs its crew kept ${n}% full on average`,
  fed: (n) => `Needs ${n} raw material eaten since the oath`,
}

// ── What it is worth ──────────────────────────────────────────────────────────────────

export function channelsOf(design: CraftDesign): CraftChannels {
  const ch: CraftChannels = { ...NO_CRAFT }
  for (const n of design.nodes) {
    const prim = primById(n.prim)
    if (!prim) continue
    ch[prim.channel] += primNumbers(prim).step * clampSteps(prim, n.steps)
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
  if (!design || craftFaults(design)) return { ...NO_CRAFT }
  if (outOfKeeping(design, b, pop, buildings, hasNoItemToMake)) return { ...NO_CRAFT }
  const crew = crewSizeOf(b.type)
  if (crew <= 0) return { ...NO_CRAFT }
  const ratio = Math.min(1, handsAt(pop, b) / crew)
  const full = channelsOf(design)
  return clampCraftChannels({
    coinMult: 1 + (full.coinMult - 1) * ratio,
    goodsMult: 1 + (full.goodsMult - 1) * ratio,
    studyMult: 1 + (full.studyMult - 1) * ratio,
  })
}

/** Which channels the oath actually named — what a day of keeping has to show work on. */
export function channelsNamedBy(design: CraftDesign): Set<string> {
  const out = new Set<string>()
  for (const n of design.nodes) {
    const prim = primById(n.prim)
    if (prim) out.add(prim.channel)
  }
  return out
}

// ── Keeping ───────────────────────────────────────────────────────────────────────────

export function outOfKeeping(
  design: CraftDesign,
  b: Building,
  pop: PopulationState | null | undefined,
  buildings: Building[],
  hasNoItemToMake: boolean,
): string | null {
  const ctx = contextFor(b, hasNoItemToMake)
  const hands = handsAt(pop, b)
  for (const d of design.demands) {
    const why = demandBroken(d, { ctx, hands, buildings })
    if (why) return why
  }
  return null
}

interface DemandState { ctx: CraftContext; hands: number; buildings: Building[] }

function demandBroken(d: CraftDemand, s: DemandState): string | null {
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
    case 'SHARE_OF_POSTS': {
      // Denominated in POSTS, never in posted hands: so it tightens when you BUILD, not when
      // you choose how to use what you already have — and a 0/0 denominator cannot arise,
      // because a house with no crew never reaches this panel at all.
      const posts = totalCrewPosts(s.buildings)
      if (posts <= 0) return null
      const share = Math.round((s.hands / posts) * 100)
      return share < d.pct ? `it asks for ${d.pct}% of the domain's posts and holds ${share}%` : null
    }
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
  const ctx = contextFor(next.b, hasNoItemToMake)
  const after: CraftContext = {
    ...ctx,
    coinPct: next.coinPct ?? ctx.coinPct,
    studyPct: next.studyPct ?? ctx.studyPct,
  }
  after.goodsPct = Math.max(0, Math.round((100 - after.studyPct) * ((100 - after.coinPct) / 100)))
  const hands = next.hands ?? handsAt(pop, next.b)
  for (const d of design.demands) {
    if (!isMonotone(d)) continue // a proportional demand never refuses anything
    const why = demandBroken(d, { ctx: after, hands, buildings: [] })
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
 * one keeps it, so an older piece coming back is not a data loss. The asymmetry is the reason
 * the two files do different things here.)
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

const KNOWN_DEMANDS: readonly string[] =
  ['CAP_COIN', 'CAP_STUDY', 'MIN_GOODS', 'MAX_HANDS', 'MIN_HANDS', 'SHARE_OF_POSTS']

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
  if (minH?.kind === 'MIN_HANDS' && maxH?.kind === 'MAX_HANDS' && minH.hands > maxH.hands) {
    reasons.push('It cannot ask for more hands than it allows')
  }

  if (design.nodes.length === 0) reasons.push('A craft has to be FOR something — take at least one way of working')

  // A farm's goods ARE food, and food is the population ceiling — the one resource nothing
  // else bounds. A goods craft there is not a goods bonus, it is a direct raise of how many
  // people the domain can grow. Refused as a RULE rather than left to `channelsOf` returning
  // 1: a piece you can take and that is then silently inert is a refusal that reaches nowhere.
  if (ctx.isFarm && design.nodes.some((n) => primById(n.prim)?.channel === 'goodsMult')) {
    reasons.push('A farm cannot swear to goods — its goods are food, and food is how many people you can have')
  }

  const budget = availableCraftPoints(design, ctx)
  const spent = spentPoints(design)
  if (spent > budget) {
    reasons.push(`It buys ${spent} points and gives up only ${budget} — every point comes from a demand`)
  }

  // Sworn while already breaking it is not a promise. Checked here rather than left to
  // `outOfKeeping` so the refusal lands before the permanent thing happens.
  for (const d of design.demands) {
    if (!isMonotone(d)) continue
    const why = demandBroken(d, { ctx, hands: ctx.crew, buildings: [] })
    if (why) reasons.push(`It is not in keeping now — ${why}`)
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
      if (ctx.hasNoItemToMake) return 'This house has nothing to make, so it could never leave anything for goods'
      return d.pct <= CRAFT_FLOOR.minGoodsMinPct ? `A goods floor of ${d.pct}% refuses nothing` : null
    case 'MIN_HANDS': {
      const floor = Math.ceil((CRAFT_FLOOR.minHandsPct / 100) * ctx.crew)
      return d.hands < floor
        ? `Fewer than ${floor} hands promises nothing — a day already needs half the crew to count`
        : null
    }
    case 'MAX_HANDS':
      return d.hands >= ctx.crew ? `A cap of ${d.hands} hands refuses nothing — the crew is ${ctx.crew}` : null
    case 'SHARE_OF_POSTS':
      return d.pct < CRAFT_FLOOR.shareOfPostsMinPct
        ? `A share of ${d.pct}% of the domain refuses nothing`
        : null
  }
}

// ── Standing ──────────────────────────────────────────────────────────────────────────

export function standingOf(pop: PopulationState | null | undefined, b: Building): number {
  const raw = Math.floor(Number(pop?.kept?.[b.id]) || 0)
  return raw > 0 ? raw : 0
}

export function craftAt(pop: PopulationState | null | undefined, b: Building): CraftDesign | null {
  return pop?.craft?.[b.id] ?? null
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
    case 'SHARE_OF_POSTS': return `at least ${d.pct}% of every post in the domain`
  }
}

export function describeChannels(ch: CraftChannels): string {
  const out: string[] = []
  if (ch.coinMult > 1) out.push(`coin ×${ch.coinMult.toFixed(2)}`)
  if (ch.goodsMult > 1) out.push(`goods ×${ch.goodsMult.toFixed(2)}`)
  if (ch.studyMult > 1) out.push(`study ×${ch.studyMult.toFixed(2)}`)
  return out.join(' · ') || 'nothing yet'
}

export function describeNode(n: CraftNode): string {
  const prim = primById(n.prim)
  if (!prim) return 'something this version does not know'
  const steps = clampSteps(prim, n.steps)
  return `${prim.name}${steps > 1 ? ` ×${steps}` : ''}`
}

/** For the panel: how much of the domain this house is holding, for context on a demand. */
export function postedElsewhere(
  pop: PopulationState | null | undefined, b: Building, buildings: Building[],
): number {
  return Math.max(0, postedHands(pop, buildings) - handsAt(pop, b))
}

/**
 * The one judge for moving hands, used by BOTH the message and the write.
 *
 * They used to be different. `whyNotAssign` composed the oath check with `assignBlocker` and fed
 * only the `disabled` prop, while the write path ran `assignBlocker` alone — which knows nothing
 * about crafts. So a sworn house was protected by a disabled button and by nothing else, and the
 * updater carried a comment claiming it repeated "the same check", which it did not.
 *
 * That is the exact trap this codebase already paid for once with legions: a check made against
 * the render snapshot is not an invariant. The oath comes first because it is the more surprising
 * refusal of the two, so it is the one worth saying.
 */
export function assignRefusal(
  b: Building,
  delta: number,
  pop: PopulationState,
  buildings: Building[],
  hasNoItemToMake: boolean,
): string | null {
  const hands = handsAt(pop, b) + Math.floor(delta || 0)
  return craftBlocker(craftAt(pop, b), { b, hands }, pop, hasNoItemToMake)
    ?? assignBlocker(b, delta, pop, buildings)
}
