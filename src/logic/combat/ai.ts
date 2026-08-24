// src/logic/combat/ai.ts
// Deterministic enemy AI. chooseEnemyCommands(state) returns the full command list for
// the ENEMY turn, ending with END_TURN. It is a pure function of the state: no rng, no
// clock — identical state always yields identical commands. It plans with MEAN damage
// (estimateKills) and only consumes battle rng when the engine later APPLIES the commands.
//
// ── It explains itself ────────────────────────────────────────────────────────────────
//
// `planEnemyTurn` returns the same commands PLUS a trace: for every cohort, what it decided,
// which of the rules in `aiRules.ts` fired, what it was looking at, and — the part that used to
// be invisible — why a cohort did nothing. Silence was the AI's most common output and the
// hardest thing to debug, because "issued no command" and "was never considered" looked
// identical from outside. Every branch that produces no command now names itself.
//
// The trace is data, not a side effect: nothing is written, nothing is timed. That is what lets
// the admin replay any turn of any battle from its seed and get the identical explanation.

import type { SoldierType } from '../types'
import type { BattleState, Combatant, Command, Side } from './types'
import { resolveStats, TERRAIN } from './stats'
import {
  applyCommand, combatantById, legalMoves, hasLineOfSight, chebyshev, terrainAt, estimateKills,
} from './engine'
import type { AiRuleId } from './aiRules'

function idNum(id: string): number {
  const n = parseInt(id.slice(1), 10)
  return Number.isFinite(n) ? n : 0
}

export type AiDecision = 'ATTACK' | 'MOVE_AND_ATTACK' | 'ADVANCE' | 'HOLD' | 'SKIPPED'

export interface AiUnitTrace {
  id: string
  name: string
  from: { x: number; y: number }
  decision: AiDecision
  /** One sentence a human can read without opening the code. */
  detail: string
  /** What decided the action taken. */
  rules: AiRuleId[]
  /** Fired while weighing options that LOST. Cited separately so the decisive list stays honest. */
  weighed: AiRuleId[]
  moveTo?: { x: number; y: number }
  target?: { id: string; name: string; distance: number }
  expectedKills?: number
  score?: number
  /** How much was weighed — a cohort that held after considering 40 options is not stuck. */
  consideredPositions: number
  consideredShots: number
}

export interface AiTurnTrace {
  turn: number
  side: Side
  rules: AiRuleId[]
  units: AiUnitTrace[]
  /** Set when the whole turn was refused before any cohort was considered. */
  note?: string
}

interface Candidate {
  score: number
  move: Command | null
  attackTargetId: string
  expectedKills: number
  moved: boolean
  /** The rules that shaped THIS candidate — not every rule that fired anywhere. */
  rules: AiRuleId[]
  consideredPositions: number
  consideredShots: number
}

interface UnitPlan {
  candidate: Candidate | null
  decision: AiDecision
  detail: string
  rules: AiRuleId[]
  weighed: AiRuleId[]
  consideredPositions: number
  consideredShots: number
  advanceTargetId?: string
}

function planUnit(s: BattleState, self: Combatant, shadowHp: Record<string, number>): UnitPlan {
  // The same profile the engine will enforce. Passing the override matters the moment anything
  // gives an enemy one: the planner would otherwise queue a shot from a range the reducer then
  // refuses, and the cohort would move and then silently do nothing.
  const st = resolveStats(self.type as SoldierType, self.loadoutWeapon, self.statsOverride)
  const isRanged = st.range >= 2

  // TWO lists, and the difference is the whole of a bug that used to freeze the army.
  // `live` is who is actually on the field. `unbooked` is who has not already been claimed by an
  // earlier cohort this turn. Shooting uses `unbooked` so the army does not overkill one target;
  // ADVANCING uses `live`, because a booking is a note about this turn, not a death.
  const live = s.combatants.filter((c) => c.side === 'PLAYER' && c.hp > 0)
  if (!live.length) {
    return {
      candidate: null, decision: 'HOLD', consideredPositions: 0, consideredShots: 0,
      detail: 'No living enemy cohort remains — nothing to do.',
      rules: ['UNIT_NO_LIVING_FOE'], weighed: [],
    }
  }
  const unbooked = live.filter((c) => (shadowHp[c.id] ?? c.hp) > 0)

  const positions: { x: number; y: number; move: Command | null; moved: boolean }[] = [
    { x: self.x, y: self.y, move: null, moved: self.hasMoved },
    ...legalMoves(s, self.id).map((t) => ({ x: t.x, y: t.y, move: { kind: 'MOVE', id: self.id, to: { x: t.x, y: t.y } } as Command, moved: true })),
  ]

  // `base` is what is true of the cohort however it decides. `weighed` collects rules that fired
  // while evaluating options that LOST — kept, because the user asked for everything the AI does,
  // but kept SEPARATE, because a rule cited on the chosen action when it shaped a rejected one is
  // exactly the kind of plausible-looking lie this whole trace exists to prevent.
  // Cited only when there IS an override. Claiming it on every cohort made a rule that is latent
  // in the shipped game look decisive on every single row — noise dressed as reasoning.
  const base: AiRuleId[] = self.statsOverride
    ? ['UNIT_STATS_WITH_OVERRIDE', 'UNIT_POSITIONS_STAND_OR_MOVE']
    : ['UNIT_POSITIONS_STAND_OR_MOVE']
  const weighed = new Set<AiRuleId>()
  let shots = 0
  let best: Candidate | null = null

  for (const pos of positions) {
    const bonus = isRanged ? TERRAIN[terrainAt(s, pos.x, pos.y)].rangeBonus : 0
    const range = st.range + bonus
    for (const t of unbooked) {
      const d = chebyshev(pos.x, pos.y, t.x, t.y)
      if (d < 1 || d > range) continue
      if (d >= 2 && !hasLineOfSight(s, pos.x, pos.y, t.x, t.y)) { weighed.add('UNIT_NEEDS_LINE_OF_SIGHT'); continue }
      shots++
      const mine: AiRuleId[] = ['UNIT_SCORE_DAMAGE_SHARE', 'UNIT_THREAT_WEIGHT']
      if (bonus) mine.push('UNIT_TERRAIN_RANGE_BONUS')
      const isMelee = d <= 1
      // These two reach the score through estimateKills and had no rule citing them at all.
      // The charge term is the largest multiplier the AI applies, and terrain can zero it.
      const tile = TERRAIN[terrainAt(s, pos.x, pos.y)]
      if ((isMelee ? tile.atkMult : tile.rangedAtkMult) !== 1) mine.push('UNIT_TERRAIN_SHAPES_THE_BLOW')
      // The engine's exact condition: allowCharge (always true here) && mounted && aMoved && isMelee.
      if (isMelee && st.mounted && pos.moved) mine.push('UNIT_CHARGE_WEIGHS_THE_TILE')
      const expected = estimateKills(s, self, t, { isMelee, allowCharge: true, aX: pos.x, aY: pos.y, aMoved: pos.moved })
      const effHp = Math.max(1, shadowHp[t.id] ?? t.hp)
      const threat = 1 + resolveStats(t.type as SoldierType, t.loadoutWeapon, t.statsOverride).atk / 20
      let score = (expected / effHp) * threat
      if (expected >= effHp) { score *= 2; mine.push('UNIT_SECURE_THE_KILL') }
      if (isRanged) {
        if (isMelee) { score *= 0.5; mine.push('UNIT_RANGED_AVOIDS_MELEE') }
        else { score *= 1 + 0.05 * d; mine.push('UNIT_RANGED_PREFERS_DISTANCE') }
      }
      // Strictly greater, so a tie keeps whatever was found first: standing still beats moving,
      // and the earlier target wins. That tie-break IS the determinism.
      if (!best || score > best.score + 1e-9) {
        if (best) for (const r of best.rules) weighed.add(r)
        best = {
          score, move: pos.move, attackTargetId: t.id, expectedKills: expected, moved: pos.moved,
          rules: mine, consideredPositions: positions.length, consideredShots: 0,
        }
      } else {
        for (const r of mine) weighed.add(r)
      }
    }
  }

  if (best) {
    const decisive = [...base, ...best.rules, 'UNIT_TIES_KEEP_THE_EARLIER' as AiRuleId]
    const t = combatantById(s, best.attackTargetId)!
    const atX = best.move ? (best.move as { to: { x: number; y: number } }).to.x : self.x
    const atY = best.move ? (best.move as { to: { x: number; y: number } }).to.y : self.y
    const dist = chebyshev(atX, atY, t.x, t.y)
    return {
      candidate: { ...best, rules: decisive, consideredPositions: positions.length, consideredShots: shots },
      decision: best.move ? 'MOVE_AND_ATTACK' : 'ATTACK',
      detail: best.move
        ? `Steps to (${atX},${atY}) and strikes ${t.name} at range ${dist}; expects ${best.expectedKills} killed (score ${best.score.toFixed(3)}).`
        : `Strikes ${t.name} from where it stands, range ${dist}; expects ${best.expectedKills} killed (score ${best.score.toFixed(3)}).`,
      rules: decisive,
      weighed: [...weighed].filter((r) => !decisive.includes(r)),
      consideredPositions: positions.length,
      consideredShots: shots,
    }
  }

  // No shot from anywhere: close. Toward WHICHEVER living cohort it can actually approach —
  // not only the nearest, and not only the ones still unbooked.
  const advanceRules: AiRuleId[] = [
    ...base, 'UNIT_ADVANCE_WHEN_NO_SHOT', 'UNIT_ADVANCE_TOWARD_ANY_FOE',
    'UNIT_ADVANCE_MUST_CLOSE', 'UNIT_ADVANCE_TIES_KEEP_THE_EARLIER',
  ]
  const moves = legalMoves(s, self.id)
  let bestTile: { x: number; y: number } | null = null
  let bestResult = Infinity
  let bestTargetId = ''
  for (const p of live) {
    const now = chebyshev(self.x, self.y, p.x, p.y)
    for (const m of moves) {
      const d = chebyshev(m.x, m.y, p.x, p.y)
      if (d >= now) continue          // must close, never shuffle sideways
      if (d >= bestResult) continue   // strict, so ties keep the earlier target and tile
      bestResult = d
      bestTile = m
      bestTargetId = p.id
    }
  }

  if (bestTile) {
    const t = combatantById(s, bestTargetId)!
    return {
      candidate: {
        score: 0, move: { kind: 'MOVE', id: self.id, to: bestTile }, attackTargetId: '',
        expectedKills: 0, moved: true, rules: advanceRules,
        consideredPositions: positions.length, consideredShots: shots,
      },
      decision: 'ADVANCE',
      detail: `No shot from any of ${positions.length} position(s); advances to (${bestTile.x},${bestTile.y}), closing on ${t.name} to range ${bestResult}.`,
      rules: advanceRules,
      weighed: [...weighed],
      consideredPositions: positions.length,
      consideredShots: shots,
      advanceTargetId: bestTargetId,
    }
  }

  return {
    candidate: null,
    decision: 'HOLD',
    detail: moves.length === 0
      ? 'Holds: no legal move at all — every neighbouring tile is blocked by terrain cost or by an ally.'
      : `Holds: none of ${moves.length} legal move(s) closes on any of ${live.length} living cohort(s), and no shot was available.`,
    rules: [...advanceRules, 'UNIT_HOLDS_WHEN_BOXED_IN'],
    weighed: [...weighed],
    consideredPositions: positions.length,
    consideredShots: shots,
  }
}

/**
 * The turn, with its reasoning. `chooseEnemyCommands` is this without the reasoning.
 *
 * Keeping both means the explanation cannot drift from the behaviour: there is one planner, and
 * the admin's inspector and the live battle run the identical code over the identical state.
 */
export function planEnemyTurn(state: BattleState): { commands: Command[]; trace: AiTurnTrace } {
  const turnRules: AiRuleId[] = []
  if (state.status !== 'ONGOING' || state.side !== 'ENEMY') {
    return {
      commands: [{ kind: 'END_TURN' }],
      trace: {
        turn: state.turn, side: state.side, units: [],
        rules: ['TURN_ONLY_WHEN_ACTIVE', 'TURN_ALWAYS_ENDS'],
        note: state.status !== 'ONGOING'
          ? `The battle is ${state.status}; no plan is made.`
          : `It is the ${state.side} turn, not the enemy's; no plan is made.`,
      },
    }
  }

  const cmds: Command[] = []
  let s = structuredClone(state)
  const shadowHp: Record<string, number> = {}
  for (const c of s.combatants) shadowHp[c.id] = c.hp

  const enemies = s.combatants
    .filter((c) => c.side === 'ENEMY' && c.hp > 0 && !c.routed)
    .sort((a, b) => idNum(a.id) - idNum(b.id))
  turnRules.push('TURN_ORDER_BY_ID', 'TURN_SKIP_DEAD_OR_ROUTED')

  const units: AiUnitTrace[] = []

  for (const e of enemies) {
    const self = combatantById(s, e.id)
    if (!self || self.hp <= 0 || self.routed) {
      units.push({
        id: e.id, name: e.name, from: { x: e.x, y: e.y }, decision: 'SKIPPED',
        detail: 'Fell or routed earlier in this same turn, after the order was fixed.',
        rules: ['TURN_SKIP_DEAD_OR_ROUTED'], weighed: [], consideredPositions: 0, consideredShots: 0,
      })
      continue
    }

    const plan = planUnit(s, self, shadowHp)
    const rec: AiUnitTrace = {
      id: self.id, name: self.name, from: { x: self.x, y: self.y },
      decision: plan.decision, detail: plan.detail, rules: plan.rules, weighed: plan.weighed,
      consideredPositions: plan.consideredPositions, consideredShots: plan.consideredShots,
    }

    const c = plan.candidate
    if (c?.move) {
      s = applyCommand(s, c.move) // positions only, no rng — keeps occupancy correct for later units
      cmds.push(c.move)
      rec.moveTo = (c.move as { to: { x: number; y: number } }).to
      if (!turnRules.includes('TURN_MOVES_APPLIED_WHILE_PLANNING')) turnRules.push('TURN_MOVES_APPLIED_WHILE_PLANNING')
    }
    if (c?.attackTargetId) {
      cmds.push({ kind: 'ATTACK', id: self.id, targetId: c.attackTargetId })
      shadowHp[c.attackTargetId] = (shadowHp[c.attackTargetId] ?? 0) - c.expectedKills
      const t = combatantById(s, c.attackTargetId)
      // `self` was read BEFORE the move was applied, and `applyCommand` returns a new state, so
      // it is stale by now. Re-read the mover from the state the attack will actually happen in.
      const mover = combatantById(s, self.id)
      rec.target = {
        id: c.attackTargetId,
        name: t?.name ?? c.attackTargetId,
        distance: t && mover ? chebyshev(mover.x, mover.y, t.x, t.y) : -1,
      }
      rec.expectedKills = c.expectedKills
      rec.score = c.score
      if (!turnRules.includes('TURN_BOOK_THE_KILL')) turnRules.push('TURN_BOOK_THE_KILL')
    } else if (plan.advanceTargetId) {
      const t = combatantById(s, plan.advanceTargetId)
      if (t) rec.target = { id: t.id, name: t.name, distance: chebyshev(rec.moveTo?.x ?? self.x, rec.moveTo?.y ?? self.y, t.x, t.y) }
    }
    units.push(rec)
  }

  cmds.push({ kind: 'END_TURN' })
  turnRules.push('TURN_ALWAYS_ENDS')

  return { commands: cmds, trace: { turn: state.turn, side: state.side, rules: turnRules, units } }
}

export function chooseEnemyCommands(state: BattleState): Command[] {
  return planEnemyTurn(state).commands
}
