// src/logic/tradition.ts
// A tradition is a small TREE a legion grows, not a badge it buys.
//
// The owner's correction, which this file exists to satisfy: traditions do not replace
// level — they are attributes a legion develops as its level rises AND as it practises
// things relevant to that tradition, and they are not a preset list. So:
//
//   LEVEL gates how DEEP into the tree a legion may reach. It comes from renown, which
//   comes only from winning things (see `practice.ts`).
//
//   PROOF gates WHICH attribute. Every piece in the palette carries the counter it demands
//   — a piece that pays for dead horsemen demands dead horsemen. The proof is a property of
//   the PIECE, never of the design, because an author who picked the proof would pick one
//   they already meet.
//
//   POINTS meter how much. The budget fills with level; the constraints pay a rebate at
//   founding, so giving something up makes you better immediately.
//
// The design itself carries NO NUMBERS — piece ids, step counts, parent links, two strings.
// Every price, threshold and ceiling is recomputed locally from the palette. An inflated
// tradition is therefore not representable rather than merely refused, which is what makes
// authored content safe to load, and what makes an admin retune apply retroactively to
// trees already grown.
//
// Scope, unchanged from the first cut and for the same reason: DOMAIN CHANNELS ONLY. The
// combat engine exists byte-identical inside a Cloud Function for server-authoritative PvP,
// and `sanitizeDeploy` deliberately drops stat overrides because army state is
// client-claimed. A user-authored combat bonus is indistinguishable from a forged one at
// the payload level, so there is no version of it that is fair.

import { GameConfig } from './config'
import { DEFAULT_COMBAT_STATS } from './combat/stats'
import type { SoldierType, Unit } from './types'
import { LEGION_MAX_UNITS } from './legion'
import type { DeedKey, DeedLedger } from './practice'
import { legionLevel } from './practice'
import {
  CONSTRAINT_FLOOR, DESIGN_MAX_CONSTRAINTS, DESIGN_MAX_NODES, MAX_DEPTH,
  MAX_REBATE, NO_CHANNELS, TIER_LEVEL, TRADITION_CREED_MAX, TRADITION_NAME_MAX, clampChannels, isMonotone,
  pointBudget, primById, rebateOf,
  type Constraint, type LegionChannels,
} from './traditionPalette'

// ── The class vocabulary ───────────────────────────────────────────────────────────────

/**
 * How a soldier type counts toward a constraint.
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

export const CLASS_LABEL: Record<TypeClass, string> = {
  MOUNTED: 'horsemen',
  FOOT: 'men on foot',
  ARCHER: 'archers',
  HEAVY_FOOT: 'heavy foot',
}

// ── The design ─────────────────────────────────────────────────────────────────────────

export interface DesignNode {
  id: string
  /** null = hangs off the root. Must name a node EARLIER in the array — see `validateDesign`. */
  parent: string | null
  /** An `EffectPrim` id. */
  prim: string
  steps: number
}

export interface TraditionDesign {
  v: 1
  name: string
  creed: string
  sworeDay: number
  constraints: Constraint[]
  nodes: DesignNode[]
  /**
   * Set by hydration when the design no longer validates against this build's palette. The
   * design is KEPT and its effects read as nothing, rather than being deleted: a catalog id
   * is the game's property and may be dropped, but a design is the player's authorship and
   * must never vanish without a sentence.
   */
  invalid?: true
}

/**
 * Depth by walking to the root. Cheap because `parent` is required to point BACKWARDS in
 * the array, which makes cycles unrepresentable rather than something to detect.
 */
export function nodeDepth(design: TraditionDesign, nodeId: string): number {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  let d = 0
  let cur = byId.get(nodeId)
  while (cur?.parent) {
    d++
    if (d > DESIGN_MAX_NODES) return DESIGN_MAX_NODES // belt: a hand-edited save cannot spin here
    cur = byId.get(cur.parent)
  }
  return d
}

export function nodePoints(node: DesignNode): number {
  const p = primById(node.prim)
  return p ? p.points * Math.max(0, Math.floor(node.steps)) : 0
}

export function grossPoints(design: TraditionDesign): number {
  return design.nodes.reduce((a, n) => a + nodePoints(n), 0)
}

/** Bounded here rather than in the validator: a ceiling in the getter cannot be forgotten. */
export function rebateTotal(design: TraditionDesign): number {
  return Math.min(MAX_REBATE, design.constraints.reduce((a, c) => a + rebateOf(c), 0))
}

/**
 * There is no separate "earned" list, and that is a design decision rather than a
 * shortcut: attributes are added ONE AT A TIME, when the legion can take them, so a node
 * exists in the design precisely because it was taken. Designing the tree and growing it
 * are the same act — which is what "attributes a legion develops" actually describes, and
 * it removes a whole class of bug where the two lists disagree.
 */
export function spentPoints(design: TraditionDesign): number {
  return design.nodes.reduce((a, n) => a + nodePoints(n), 0)
}

/** The whole wallet: what level has given, plus what the constraints bought at founding. */
export function availablePoints(design: TraditionDesign, practice: DeedLedger): number {
  return pointBudget(legionLevel(practice)) + rebateTotal(design)
}

// ── Validation ─────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Everything an authored design must satisfy. Read the no-op rules first — they are the
 * half that stops authoring from collapsing.
 *
 * Every constraint kind has a way of being written that constrains nothing: a cohort cap
 * equal to the cap that already exists, a minimum of one, a share of one percent. A design
 * built out of those is twelve attributes behind twelve free promises, and "bonus AND
 * constraint" becomes a checkbox that says yes. So the floors are validator rules, refused
 * at authoring time, not guidance in a comment.
 */
export function validateDesign(design: TraditionDesign): ValidationResult {
  const errors: string[] = []
  const push = (s: string) => { if (!errors.includes(s)) errors.push(s) }

  if (!design || design.v !== 1) return { ok: false, errors: ['Unknown tradition format'] }
  if (!design.name?.trim()) push('A tradition needs a name')
  if ([...(design.name ?? '')].length > TRADITION_NAME_MAX) push(`The name may be at most ${TRADITION_NAME_MAX} characters`)
  if ([...(design.creed ?? '')].length > TRADITION_CREED_MAX) push(`The creed may be at most ${TRADITION_CREED_MAX} characters`)

  // ── Constraints ──
  const cs = design.constraints ?? []
  if (cs.length === 0 || cs.length > DESIGN_MAX_CONSTRAINTS) {
    push(`A tradition takes 1 to ${DESIGN_MAX_CONSTRAINTS} demands`)
  }
  // Keyed by kind AND class, not by kind alone: refusing horsemen and refusing archers are
  // two different promises, and a legion may honestly make both. What must not repeat is
  // two of the SAME promise — two cohort caps are one cap and a decoration.
  const keys = cs.map((c) => (c.kind === 'DENY' || c.kind === 'SHARE' ? `${c.kind}:${c.cls}` : c.kind))
  if (new Set(keys).size !== keys.length) push('Each demand may be taken once')
  if (!cs.some(isMonotone)) push('A tradition must REFUSE something — add a ban or a cohort limit')

  for (const c of cs) {
    switch (c.kind) {
      case 'MAX_COHORTS':
        if (!(c.n >= 1 && c.n < CONSTRAINT_FLOOR.maxCohortsBelow)) {
          push(`A cohort limit of ${c.n} forbids nothing — a legion already holds at most ${LEGION_MAX_UNITS}`)
        }
        break
      case 'MIN_COHORTS':
        if (c.n < CONSTRAINT_FLOOR.minCohorts) push(`Demanding ${c.n} cohorts asks nothing — ask at least ${CONSTRAINT_FLOOR.minCohorts}`)
        if (c.n > LEGION_MAX_UNITS) push(`No legion can hold ${c.n} cohorts`)
        break
      case 'SHARE':
        if (c.minPct < CONSTRAINT_FLOOR.sharePct) push(`A share of ${c.minPct}% asks nothing — ask at least ${CONSTRAINT_FLOOR.sharePct}%`)
        if (c.minPct > 100) push('A share cannot exceed the whole legion')
        break
      case 'DENY':
        if (!CLASS_LABEL[c.cls]) push('Unknown kind of soldier in a ban')
        break
      default:
        push('Unknown demand')
    }
  }
  // A tradition that denies both halves of the roster can never hold a cohort at all.
  if (cs.some((c) => c.kind === 'DENY' && c.cls === 'MOUNTED') && cs.some((c) => c.kind === 'DENY' && c.cls === 'FOOT')) {
    push('Refusing both horsemen and men on foot leaves nobody to serve')
  }

  // ── Nodes ──
  const ns = design.nodes ?? []
  if (ns.length > DESIGN_MAX_NODES) push(`A tradition holds at most ${DESIGN_MAX_NODES} attributes`)
  const seen = new Set<string>()
  ns.forEach((n, i) => {
    if (!n.id || seen.has(n.id)) push('Every attribute needs its own name')
    seen.add(n.id)
    const p = primById(n.prim)
    if (!p) { push(`Unknown attribute "${n.prim}"`); return }
    if (!(n.steps >= 1 && n.steps <= p.maxSteps)) push(`${p.name} takes 1 to ${p.maxSteps} steps`)
    // Backwards-only parents: this is what makes a cycle unrepresentable rather than
    // something to hunt for.
    if (n.parent !== null) {
      const at = ns.findIndex((x) => x.id === n.parent)
      if (at < 0 || at >= i) push(`${p.name} hangs off something that does not come before it`)
    }
    if (nodeDepth(design, n.id) > MAX_DEPTH) push(`${p.name} sits deeper than a tradition reaches`)
  })

  // ── Budget ──
  // Nothing to check on the budget: `rebateTotal` is already bounded, and a tree grown one
  // attribute at a time can never hold something the legion could not afford when it was
  // added. The old "the demands pay for too much of this" rule belonged to a world where a
  // whole tree was authored up front — against an incrementally grown one it refuses a
  // legion for having grown slowly, which is the opposite of what it was for.
  // No "must be completable" rule: the tree is grown one attribute at a time, so it can
  // never contain something the legion could not afford at the moment it was added.

  return { ok: errors.length === 0, errors }
}

// ── Constraints in play ────────────────────────────────────────────────────────────────

/**
 * Why this cohort may not join. `null` = it may.
 *
 * Only the MONOTONE demands answer here, because only they can be broken by adding. The
 * rest suspend instead — see `outOfKeeping`.
 */
export function joinBan(
  design: TraditionDesign | null, type: SoldierType, cohortCount: number, legionName: string,
): string | null {
  if (!design || design.invalid) return null
  for (const c of design.constraints) {
    if (c.kind === 'DENY' && isClass(type, c.cls)) return `${legionName} is sworn against ${CLASS_LABEL[c.cls]}`
    if (c.kind === 'MAX_COHORTS' && cohortCount >= c.n) return `${legionName} takes no more than ${c.n} cohorts`
  }
  return null
}

/**
 * Why the legion is not keeping its tradition, and so why every earned attribute is asleep.
 * `null` = it is in keeping.
 *
 * `MAX_COHORTS` is checked here TOO, not only at the door: a save can arrive holding more
 * cohorts than the oath allows (it was hand-edited, or the oath was sworn later), and a
 * rule that only ever ran on the way in would never notice.
 *
 * An empty legion is out of keeping for EVERY standing demand, including a share — 0 of 0
 * is arithmetically satisfied but a legion with nobody in it is not keeping anything. One
 * predicate, no exceptions to remember.
 */
export function outOfKeeping(design: TraditionDesign | null, cohorts: Unit[]): string | null {
  if (!design || design.invalid) return null
  const standing = design.constraints.filter((c) => c.kind !== 'DENY')
  if (standing.length > 0 && cohorts.length === 0) return 'it has no cohorts under arms'

  for (const c of design.constraints) {
    if (c.kind === 'MIN_COHORTS' && cohorts.length < c.n) {
      return `needs ${c.n} cohorts under arms, has ${cohorts.length}`
    }
    if (c.kind === 'MAX_COHORTS' && cohorts.length > c.n) {
      return `holds ${cohorts.length} cohorts where it swore to ${c.n}`
    }
    if (c.kind === 'SHARE') {
      // Ceiling, so "at least half" of an odd number is the LARGER half — a legion must
      // not be a minority of what it swore to be and still call itself in keeping.
      const need = Math.ceil((cohorts.length * c.minPct) / 100)
      const have = cohorts.filter((u) => isClass(u.type, c.cls)).length
      if (have < need) return `needs ${need} of ${cohorts.length} cohorts to be ${CLASS_LABEL[c.cls]}, has ${have}`
    }
  }
  return null
}

// ── Growing the tree ───────────────────────────────────────────────────────────────────

export interface GrowCandidate {
  prim: string
  steps: number
  parent: string | null
}

/**
 * Why this attribute cannot be added to the tree yet. `null` = it can.
 *
 * Three gates, and they are different in kind on purpose. LEVEL says how deep the legion
 * may reach and comes only from winning. PROOF says which attribute it has earned the
 * right to and comes from what it has repeatedly done. POINTS say how much of it. A legion
 * that only fights has the depth but no proof of character; one that only garrisons has
 * the proof and no depth. Neither alone grows a tradition.
 */
export function growBlocker(
  design: TraditionDesign, practice: DeedLedger, want: GrowCandidate,
): string | null {
  if (design.invalid) return 'This tradition no longer makes sense to the game'
  if (design.nodes.length >= DESIGN_MAX_NODES) return `A tradition holds at most ${DESIGN_MAX_NODES} attributes`

  const prim = primById(want.prim)
  if (!prim) return 'Unknown attribute'
  if (design.nodes.some((n) => n.prim === prim.id)) {
    return `${prim.name} is already part of this tradition — deepen it instead of repeating it`
  }
  const steps = Math.floor(want.steps)
  if (!(steps >= 1 && steps <= prim.maxSteps)) return `${prim.name} takes 1 to ${prim.maxSteps} steps`

  // Depth of the candidate = depth of its parent + 1. Computed against the design as it
  // stands, so a tree can only ever grow downward from something already taken.
  let depth = 0
  if (want.parent !== null) {
    if (!design.nodes.some((n) => n.id === want.parent)) return 'That attribute is not part of this tradition'
    depth = nodeDepth(design, want.parent) + 1
  }
  if (depth > MAX_DEPTH) return 'A tradition does not reach deeper than this'

  const needLevel = TIER_LEVEL[depth]
  const level = legionLevel(practice)
  if (level < needLevel) return `Needs Level ${needLevel}; this legion is Level ${level}`

  const needProof = prim.proofPerStep * steps
  const have = practice[prim.proof] ?? 0
  if (have < needProof) return `Needs ${needProof} ${proofLabel(prim.proof)}, has ${have}`

  const cost = prim.points * steps
  const left = availablePoints(design, practice) - spentPoints(design)
  if (cost > left) return `Costs ${cost} points; ${left} left`

  return null
}

/** The candidate as a node, once it has passed. Ids are positional and therefore stable. */
export function grownNode(design: TraditionDesign, want: GrowCandidate): DesignNode {
  return { id: `n${design.nodes.length}`, parent: want.parent, prim: want.prim, steps: Math.floor(want.steps) }
}

/** The counter's name as a demand reads it. Kept here so the tree and the record agree. */
export function proofLabel(k: DeedKey): string {
  return DEED_PROOF_LABEL[k] ?? k
}

const DEED_PROOF_LABEL: Partial<Record<DeedKey, string>> = {
  victories: 'victories',
  flawless: 'unbloodied returns',
  heldTheLine: 'grim stands',
  hardWon: 'hard-won battles',
  battles: 'battles',
  defeats: 'defeats',
  slain: 'slain',
  slainMounted: 'horsemen slain',
  slainArcher: 'archers slain',
  slainHeavyFoot: 'heavy foot slain',
  daysGarrisoned: 'days in garrison',
  daysDrilled: 'days at drill',
  daysPatrolled: 'days on patrol',
}

/** What the earned attributes are worth, folded and clamped on the TOTAL. */
export function channelsOf(design: TraditionDesign | null): LegionChannels {
  if (!design || design.invalid) return { ...NO_CHANNELS }
  const out: LegionChannels = { ...NO_CHANNELS }
  for (const n of design.nodes) {
    const p = primById(n.prim)
    if (!p) continue
    const amount = p.step * n.steps
    switch (p.channel) {
      case 'moraleFloor': out.moraleFloor += amount; break
      case 'defeatXpBonus': out.defeatXpBonus += amount; break
      case 'victoryStipend': out.victoryStipend += amount; break
      // Ratios compound, the way research does it: two +15% steps are ×1.32, so
      // specialising is worth more than spreading.
      case 'drillXpMult': out.drillXpMult *= 1 + amount; break
      case 'dutyCopperMult': out.dutyCopperMult *= 1 + amount; break
    }
  }
  return clampChannels(out)
}

export function isNoChannels(c: LegionChannels): boolean {
  return c.moraleFloor === 0 && c.defeatXpBonus === 0 && c.victoryStipend === 0
    && c.drillXpMult === 1 && c.dutyCopperMult === 1
}

/**
 * Every unit owed something by the tradition it serves under, resolved once.
 *
 * Takes the legions STRUCTURALLY rather than importing `Legion`: `legion.ts` imports this
 * file for the join bans, and importing back would close a cycle.
 *
 * Call with the army as it MARCHED. A legion that lost a cohort in the very battle being
 * resolved fought that battle in keeping, and judging afterwards would take the bonus away
 * for the loss it just suffered.
 */
export function legionChannelsByUnit(
  legions: { unitIds: string[]; tradition?: TraditionDesign | null }[],
  units: Unit[],
): Map<string, LegionChannels> {
  const byId = new Map(units.map((u) => [u.id, u]))
  const out = new Map<string, LegionChannels>()
  for (const l of legions) {
    if (!l.tradition) continue
    const cohorts = l.unitIds.map((id) => byId.get(id)).filter((u): u is Unit => !!u)
    if (outOfKeeping(l.tradition, cohorts)) continue
    const ch = channelsOf(l.tradition)
    if (isNoChannels(ch)) continue
    for (const u of cohorts) out.set(u.id, ch)
  }
  return out
}

// ── Words ──────────────────────────────────────────────────────────────────────────────

export function describeConstraint(c: Constraint): string {
  switch (c.kind) {
    case 'DENY': return `never ${CLASS_LABEL[c.cls]}`
    case 'MAX_COHORTS': return `at most ${c.n} cohorts`
    case 'MIN_COHORTS': return `at least ${c.n} cohorts under arms`
    case 'SHARE': return `at least ${c.minPct}% ${CLASS_LABEL[c.cls]}`
  }
}

/**
 * What ONE attribute contributes — a contribution, never a total.
 *
 * The distinction is not pedantry. These channels accumulate, so a tree holding a +20 floor
 * and a +12 floor is worth 32; printing each node's own number as though it were the result
 * makes the second one read as WORSE than the first. Nodes say what they add;
 * `describeChannels` says what the legion actually has.
 */
export function describeNode(node: DesignNode): string {
  const p = primById(node.prim)
  if (!p) return 'Unknown attribute'
  const amount = p.step * node.steps
  switch (p.channel) {
    case 'moraleFloor': return `${p.name} — raises the morale they come back with by ${Math.round(amount)}`
    case 'defeatXpBonus': return `${p.name} — a defeat teaches ${Math.round(amount * 100)}% more`
    case 'drillXpMult': return `${p.name} — training XP ×${(1 + amount).toFixed(2)}`
    case 'victoryStipend': return `${p.name} — ${Math.round(amount)}c on top of every victory`
    case 'dutyCopperMult': return `${p.name} — duties ${Math.round(-amount * 100)}% cheaper`
  }
}

/** What the legion actually HAS, folded and clamped — the numbers the game will apply. */
export function describeChannels(c: LegionChannels): string[] {
  const out: string[] = []
  if (c.moraleFloor > 0) out.push(`cohorts never return below ${c.moraleFloor} morale`)
  if (c.defeatXpBonus > 0) out.push(`a defeat teaches ${Math.round((0.4 + c.defeatXpBonus) * 100)}% of what a victory does`)
  if (c.drillXpMult !== 1) out.push(`training XP ×${c.drillXpMult.toFixed(2)}`)
  if (c.victoryStipend > 0) out.push(`${c.victoryStipend}c on every victory`)
  if (c.dutyCopperMult !== 1) out.push(`duties ${Math.round((1 - c.dutyCopperMult) * 100)}% cheaper`)
  return out
}

/**
 * Player-typed text that ends up in `addLog` lines, which `logKind` classifies by scanning
 * the whole string. The two glyphs it tests with `includes` come out; WORDS do not. A
 * tradition may be called "The Victors" and see its lines filed under Battles — cosmetic.
 * Mutilating a chosen name to protect a log filter would be the worse trade.
 *
 * Runs on LOAD as well as on entry, now that a design can arrive from a save.
 */
export function sanitizeAuthoredText(raw: string, fallback: string, maxCp: number): string {
  const cleaned = (raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // The two markers `logKind` tests with `includes`, plus the variation selector that
    // rides along with the warning sign.
    .replace(/[\u26a0\u{1F52C}]\ufe0f?/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Cut by CODE POINT: slicing a surrogate pair in half leaves a replacement glyph.
  return [...cleaned].slice(0, maxCp).join('').trim() || fallback
}
