// src/logic/combat/aiReplay.ts
// Replay a battle and keep every enemy turn's reasoning.
//
// ── Why this lives in the game and not in the admin panel that uses it ─────────────────
//
// The admin requires an account, so it cannot be loaded in a browser during development: a
// typecheck, a full test suite and a green build can all pass with the panel crashed on an
// ErrorBoundary, and nobody finds out until a real operator opens the page. So the loop with the
// termination condition — the one thing here that could hang a page — lives on this side, where
// it is covered by tests, and the panel is left with nothing but rendering.
//
// It is exact rather than approximate: the AI is a pure function of state and the battle is
// reproducible from its seed, so the same (difficulty, seed, army) yields the same battle and the
// same reasoning a player's device would produce.

import { applyCommand, checkVictory } from './engine'
import { createBattle } from './enemies'
import { planEnemyTurn, type AiTurnTrace } from './ai'
import type { Difficulty } from './types'
import type { Unit, SoldierType } from '../types'

export interface AiReplay {
  turns: AiTurnTrace[]
  /** Human summary of how it ended, or that it did not. */
  outcome: string
  winner: string | null
  playerCohorts: number
  enemyCohorts: number
}

/**
 * Cohorts with nothing behind them — the AI weighs position, type and headcount, not provenance.
 * Kept here so the panel does not have to know the shape of a Unit.
 */
export function syntheticCohorts(count: number, size: number, type: SoldierType = 'LIGHT_INF_SWORD'): Unit[] {
  const n = Math.max(1, Math.floor(count))
  const men = Math.max(1, Math.floor(size))
  return Array.from({ length: n }, (_, i) => ({
    id: `sim${i}`,
    name: `Cohort ${i + 1}`,
    type,
    buckets: [{ r: 'TRAINED', count: men, avgXP: 40 }],
    morale: 100,
    equip: { weapons: {}, armors: {}, horses: {} },
    loadout: { kind: type },
  })) as unknown as Unit[]
}

/**
 * Run the battle with the PLAYER standing still, collecting each enemy turn's trace.
 *
 * The player holding is a simplification, and the caller is expected to say so out loud: it lets
 * the advance and target-selection rules show themselves without a second set of choices mixed
 * in, but it means the OUTCOME is not a balance result and must not be read as one.
 *
 * Termination is guaranteed by `guard`, not by the battle: an AI that holds every cohort every
 * turn would otherwise loop until the tab died — which is exactly the failure this tool exists to
 * find, so it must survive meeting it.
 */
export function replayEnemyTurns(
  units: Unit[],
  difficulty: Difficulty,
  seed: number,
  maxEnemyTurns = 12,
): AiReplay {
  const cap = Math.max(1, Math.floor(maxEnemyTurns))
  const created = createBattle(units, difficulty, seed >>> 0)
  const playerCohorts = created.state.combatants.filter((c) => c.side === 'PLAYER').length
  const enemyCohorts = created.state.combatants.filter((c) => c.side === 'ENEMY').length

  let s = created.state
  const turns: AiTurnTrace[] = []
  // Two sides per round plus a little slack, so the guard can never be the thing that ends a
  // battle the cap would have ended first.
  let guard = 0
  const guardMax = cap * 2 + 8

  while (!s.winner && turns.length < cap && guard < guardMax) {
    guard++
    if (s.side === 'ENEMY') {
      const { commands, trace } = planEnemyTurn(s)
      turns.push(trace)
      for (const cmd of commands) {
        s = applyCommand(s, cmd)
        if (s.winner) break
      }
    } else {
      s = applyCommand(s, { kind: 'END_TURN' })
    }
    s = checkVictory(s)
  }

  return {
    turns,
    winner: s.winner ?? null,
    outcome: s.winner
      ? `${s.winner} wins — ${String(s.status).replace(/_/g, ' ').toLowerCase()}`
      : `still fighting after ${turns.length} enemy turn(s)`,
    playerCohorts,
    enemyCohorts,
  }
}
