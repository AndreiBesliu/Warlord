// src/logic/practice.ts
// What a legion has actually DONE, and the level that follows from it.
//
// Two registers, kept apart on purpose:
//
//   RENOWN is the level's fuel, and it comes only from outcomes that cannot be had for
//   free. Marching, losing and retreating are recorded — they are part of a legion's
//   history and later gate nodes that ask for them — but they buy no level. That
//   separation is not fastidiousness: `abandonBattle` applies a battle result with no
//   command ever issued, so starting a fight and retreating on the spot costs nothing and
//   loses nobody. Anything that counted it would be a level vending machine at two clicks
//   a day.
//
//   THE RECORD is everything else — kills, and kills by what kind of enemy, promotions,
//   battles, defeats. These are the proofs a tradition will later demand ("you may take
//   Horsebreakers when you have broken horses"), which is why they are counted per class
//   rather than in one lump.
//
// Level is DERIVED, never stored. Nothing writes it, so nothing can write it wrong, and no
// save edit inflates it without inflating a ledger that hydrate itself clamps.
//
// Pure: no React, no Date.now, no Math.random.

import { GameConfig } from './config'
import { classesOf } from './tradition'
import type { SoldierType } from './types'
import type { BattleState, Difficulty } from './combat/types'
import type { UnitReport } from './combat/army'

/** Deeds that buy level. Every one of them requires WINNING something. */
export const RENOWN_KEYS = ['victories', 'flawless', 'heldTheLine', 'hardWon'] as const
/** Deeds that are remembered and provable, but buy no level. */
export const RECORD_KEYS = [
  'battles', 'defeats', 'retreats', 'promotions',
  'slain', 'slainMounted', 'slainArcher', 'slainHeavyFoot',
] as const

export type DeedKey = (typeof RENOWN_KEYS)[number] | (typeof RECORD_KEYS)[number]
export const DEED_KEYS: readonly DeedKey[] = [...RENOWN_KEYS, ...RECORD_KEYS]

/** Sparse and monotone. An absent key is 0 — which is also today's behaviour, exactly. */
export type DeedLedger = Partial<Record<DeedKey, number>>

/**
 * What one deed is worth in renown.
 *
 * `flawless` and `heldTheLine` are equal and mutually exclusive by construction: you
 * either came back without a scratch or you ground it out bleeding. Two opposite ways of
 * being good at this, worth the same, so neither playstyle is the correct one.
 */
export const RENOWN_WEIGHT: Record<(typeof RENOWN_KEYS)[number], number> = {
  victories: 3,
  flawless: 5,
  heldTheLine: 5,
  hardWon: 4,
}

/**
 * How a herald would read the record. Both forms, because "1 battles" is a machine
 * talking, and this line is the one place a legion's history is spoken aloud.
 */
export const DEED_LABEL: Record<DeedKey, { one: string; many: string }> = {
  victories: { one: 'victory', many: 'victories' },
  flawless: { one: 'unbloodied', many: 'unbloodied' },
  heldTheLine: { one: 'grim stand', many: 'grim stands' },
  hardWon: { one: 'hard-won', many: 'hard-won' },
  battles: { one: 'battle', many: 'battles' },
  defeats: { one: 'defeat', many: 'defeats' },
  retreats: { one: 'retreat', many: 'retreats' },
  promotions: { one: 'promoted in the field', many: 'promoted in the field' },
  slain: { one: 'slain', many: 'slain' },
  slainMounted: { one: 'horseman slain', many: 'horsemen slain' },
  slainArcher: { one: 'archer slain', many: 'archers slain' },
  slainHeavyFoot: { one: 'heavy foot slain', many: 'heavy foot slain' },
}

export function deedLabel(key: DeedKey, n: number): string {
  const l = DEED_LABEL[key]
  return n === 1 ? l.one : l.many
}

export function emptyLedger(): DeedLedger {
  return {}
}

export function renownOf(d: DeedLedger): number {
  let r = 0
  for (const k of RENOWN_KEYS) r += (d[k] ?? 0) * RENOWN_WEIGHT[k]
  return Math.floor(r)
}

/** Renown needed to reach level `L`. Level 1 is free — a legion is raised, not earned. */
export function renownForLevel(L: number): number {
  const cfg = GameConfig.legionDeeds()
  return L <= 1 ? 0 : Math.round(cfg.levelBase * Math.pow(L - 1, cfg.levelCurve))
}

export function legionLevel(d: DeedLedger): number {
  const cfg = GameConfig.legionDeeds()
  const r = renownOf(d)
  let L = 1
  while (L < cfg.maxLevel && r >= renownForLevel(L + 1)) L++
  return L
}

/** How much renown remains before the next level. `null` at the ceiling. */
export function nextLevelAt(d: DeedLedger): { level: number; need: number } | null {
  const cfg = GameConfig.legionDeeds()
  const L = legionLevel(d)
  if (L >= cfg.maxLevel) return null
  return { level: L + 1, need: renownForLevel(L + 1) - renownOf(d) }
}

/** One legion's part in one finished battle, already reduced to numbers. */
export interface BattleShare {
  legionId: string
  /** Men this legion put in the line. */
  fielded: number
  lost: number
  kills: number
  promotions: number
  killsMounted: number
  killsArcher: number
  killsHeavyFoot: number
}

export interface BattleContext {
  won: boolean
  difficulty: Difficulty
  /** Every man the player put in the line, across all cohorts — the denominator for share. */
  totalFielded: number
  /** True when the player walked away rather than finished it. */
  retreated?: boolean
}

const add = (d: DeedLedger, k: DeedKey, n: number): void => {
  if (n > 0) d[k] = (d[k] ?? 0) + n
}

/**
 * Why this legion earns nothing from this battle. `null` = it earns.
 *
 * Two refusals, and they close the two ways a legion can appear to have fought without
 * fighting:
 *
 *   A legion that supplied a token handful of a large host did not fight the battle, it
 *   attended it. Without this, one five-man cohort parked in the back rank collects the
 *   same victory as the twelve cohorts that bled, AND collects "without a loss" for never
 *   having been reached — the exact inversion of what the record is supposed to mean.
 *
 *   A legion that neither dealt nor took a scratch never made contact. It was present.
 */
export function noCreditReason(share: BattleShare, ctx: BattleContext): string | null {
  const cfg = GameConfig.legionDeeds()
  const pct = ctx.totalFielded > 0 ? (share.fielded / ctx.totalFielded) * 100 : 0
  if (pct < cfg.minSharePct) {
    return `held ${Math.round(pct)}% of the line — a legion is credited from ${cfg.minSharePct}%`
  }
  if (share.kills <= 0 && share.lost <= 0) return 'never made contact'
  return null
}

/**
 * Fold one battle into a legion's ledger. Pure; returns a new ledger.
 *
 * A retreat is recorded and nothing else: `abandonBattle` resolves with no command issued,
 * so a retreat can cost literally nothing, and every counter it fed would be free.
 */
export function creditBattle(ledger: DeedLedger, share: BattleShare, ctx: BattleContext): DeedLedger {
  const cfg = GameConfig.legionDeeds()
  const next: DeedLedger = { ...ledger }

  if (ctx.retreated) {
    add(next, 'retreats', 1)
    return next
  }
  if (noCreditReason(share, ctx)) return next

  add(next, 'battles', 1)
  // Capped per battle: one enormous slaughter must not be worth a whole specialisation.
  add(next, 'slain', Math.min(share.kills, cfg.killsPerBattleCap))
  add(next, 'slainMounted', Math.min(share.killsMounted, cfg.killsPerBattleCap))
  add(next, 'slainArcher', Math.min(share.killsArcher, cfg.killsPerBattleCap))
  add(next, 'slainHeavyFoot', Math.min(share.killsHeavyFoot, cfg.killsPerBattleCap))
  add(next, 'promotions', share.promotions)

  if (!ctx.won) {
    add(next, 'defeats', 1)
    return next
  }

  add(next, 'victories', 1)
  if (ctx.difficulty === 'INVASION') add(next, 'hardWon', 1)
  // Contact is already established above, so "without a loss" cannot be earned by a
  // cohort that was never reached.
  if (share.lost === 0) add(next, 'flawless', 1)
  else if (share.lost / Math.max(1, share.fielded) >= cfg.heldTheLinePct / 100) {
    add(next, 'heldTheLine', 1)
  }
  return next
}

/** What marched under which banner, snapshotted when the host took the field. */
export interface MarchedLegion {
  id: string
  unitIds: string[]
}

/**
 * Reduce a finished battle to one share per legion that marched.
 *
 * Uses the DEPLOYMENT snapshot rather than the legions as they stand now: both tabs are
 * mounted at once in this game, so a player watching a massacre unfold can reassign
 * cohorts before collecting the result and move the credit to a legion that was never
 * there. Effects are still resolved live — that window is one battle and the effect is
 * transient — but credit is permanent, so credit gets the snapshot.
 */
export function sharesFromBattle(
  battle: BattleState,
  report: UnitReport[],
  marched: MarchedLegion[],
): { shares: BattleShare[]; totalFielded: number } {
  const byUnit = new Map(report.map((r) => [r.unitId, r]))

  // Enemy tokens, so a kill can be attributed to the KIND of thing that was killed.
  const enemyType = new Map<string, SoldierType>()
  const playerUnitOf = new Map<string, string>()
  for (const c of battle.combatants) {
    if (c.side === 'PLAYER') { if (c.unitId) playerUnitOf.set(c.id, c.unitId) }
    else enemyType.set(c.id, c.type)
  }

  // One pass over the log for the class breakdown. `Combatant.kills` already holds the
  // total, but it cannot say WHAT was killed, and "what you kill is what you learn from"
  // is the whole point of counting these separately.
  const classKills = new Map<string, { mounted: number; archer: number; heavyFoot: number }>()
  for (const e of battle.log) {
    if (e.kind !== 'attack' && e.kind !== 'retaliate') continue
    const unitId = e.actorId ? playerUnitOf.get(e.actorId) : undefined
    if (!unitId || !e.targetId) continue
    const t = enemyType.get(e.targetId)
    if (!t) continue
    const n = Number(e.detail?.kills ?? 0)
    if (!Number.isFinite(n) || n <= 0) continue
    const cls = classesOf(t)
    const bucket = classKills.get(unitId) ?? { mounted: 0, archer: 0, heavyFoot: 0 }
    if (cls.includes('MOUNTED')) bucket.mounted += n
    if (cls.includes('ARCHER')) bucket.archer += n
    if (cls.includes('HEAVY_FOOT')) bucket.heavyFoot += n
    classKills.set(unitId, bucket)
  }

  const killsOf = new Map<string, number>()
  for (const c of battle.combatants) {
    if (c.side === 'PLAYER' && c.unitId) killsOf.set(c.unitId, (killsOf.get(c.unitId) ?? 0) + c.kills)
  }

  const totalFielded = report.reduce((a, r) => a + r.fielded, 0)
  const shares: BattleShare[] = []
  for (const m of marched) {
    const s: BattleShare = {
      legionId: m.id, fielded: 0, lost: 0, kills: 0, promotions: 0,
      killsMounted: 0, killsArcher: 0, killsHeavyFoot: 0,
    }
    // Deduplicated: a snapshot that somehow named a unit twice would double its kills and
    // its losses, and inflate the legion's share of the line along with them.
    for (const uid of new Set(m.unitIds)) {
      const r = byUnit.get(uid)
      if (!r) continue
      s.fielded += r.fielded
      s.lost += r.lost
      s.kills += killsOf.get(uid) ?? 0
      s.promotions += r.promotions.reduce((a, p) => a + p.count, 0)
      const ck = classKills.get(uid)
      if (ck) {
        s.killsMounted += ck.mounted
        s.killsArcher += ck.archer
        s.killsHeavyFoot += ck.heavyFoot
      }
    }
    shares.push(s)
  }
  return { shares, totalFielded }
}

/** Rebuild a ledger from an untrusted save. Unknown keys are the whitelist's job to drop. */
export function hydrateLedger(saved: unknown): DeedLedger {
  if (!saved || typeof saved !== 'object') return emptyLedger()
  const s = saved as Record<string, unknown>
  const out: DeedLedger = {}
  for (const k of DEED_KEYS) {
    const v = s[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue
    out[k] = Math.min(DEED_MAX, Math.round(v))
  }
  return out
}

/** A clamp against corruption, not a game rule — no honest ledger comes near it. */
export const DEED_MAX = 1_000_000
