// src/logic/barracks.ts
// "Can I do this, and if not, what exactly is stopping me?" — for the army loop.
//
// Every barracks action already knew the answer: `queueLightTraining` and friends check
// recruits, training slots and equipment, then refuse with `addLog(...)`. But the log is a
// different tab, so on screen NOTHING happened — the button stayed enabled and identical.
// Pressing Train Batch with an empty armoury looked exactly like a broken game, and that is
// half of what "unit creation doesn't work" meant.
//
// The economy already solved this once: `evaluateCost` powers the disabled buttons and the
// "Need 200 Stone" labels in Research and Buildings. This is the same answer for the army.
//
// Pure: no React, no state.

import { GameConfig } from './config'
import { evaluateCost, type CostReport, type CostSpec, type Holdings } from './costs'
import { demandFor } from './equipment'
import type { Rank, SoldierType } from './types'

/** A blocker that is not about affording something — no recruits, no free slot. */
export interface Blocker {
  ok: boolean
  says: string
}

export interface ActionCheck {
  ok: boolean
  cost: CostReport
  /** Everything standing in the way, ready to render. Empty when the action is allowed. */
  reasons: string[]
  /** One line for a button label or a tooltip. */
  label: string
}

export function checkAction(cost: CostSpec, have: Holdings, blockers: Blocker[] = []): ActionCheck {
  const report = evaluateCost(cost, have)
  const reasons = blockers.filter((b) => !b.ok).map((b) => b.says)
  if (!report.ok) reasons.push(report.shortfallLabel)
  return {
    ok: report.ok && reasons.length === 0,
    cost: report,
    reasons,
    label: reasons.join(' · '),
  }
}

/** The gear a batch or a new unit needs, shaped for `evaluateCost`. */
export function gearCost(type: SoldierType, qty: number): CostSpec {
  const d = demandFor(type, qty)
  return { weapons: d.weapons, armors: d.armors, horses: d.horses }
}

// ── Recruiting ────────────────────────────────────────────────────────────
// Recruits used to be free: 50 men appeared and the treasury did not move. Men who cost
// nothing cannot be a decision, and the whole army loop hung off that free step.

export function recruitCostCopper(qty: number): number {
  const n = Math.max(0, Math.floor(qty || 0))
  return Math.round(GameConfig.recruitCost() * n)
}

export function checkRecruit(qty: number, have: Holdings): ActionCheck {
  const n = Math.max(0, Math.floor(qty || 0))
  return checkAction({ copper: recruitCostCopper(n) }, have, [
    { ok: n > 0, says: 'Enter how many to recruit' },
  ])
}

export function checkLightTraining(args: {
  target: SoldierType
  qty: number
  recruits: number
  slotFree: boolean
  have: Holdings
}): ActionCheck {
  const n = Math.max(0, Math.floor(args.qty || 0))
  return checkAction(gearCost(args.target, n), args.have, [
    { ok: n > 0, says: 'Enter a quantity' },
    { ok: args.slotFree, says: 'Training queue is full' },
    { ok: args.recruits >= n, says: `Need ${n - args.recruits} more untyped recruits` },
  ])
}

export function checkConversion(args: {
  target: SoldierType
  qty: number
  availableFromPool: number
  sourceLabel: string
  slotFree: boolean
  have: Holdings
}): ActionCheck {
  const n = Math.max(0, Math.floor(args.qty || 0))
  return checkAction(gearCost(args.target, n), args.have, [
    { ok: n > 0, says: 'Enter a quantity' },
    { ok: args.slotFree, says: 'Training queue is full' },
    {
      ok: args.availableFromPool >= n,
      says: `Need ${n - args.availableFromPool} more ${args.sourceLabel}`,
    },
  ])
}

export function checkCreateUnit(args: {
  type: SoldierType
  plan: Partial<Record<Rank, number>>
  pool: Partial<Record<Rank, number>>
  have: Holdings
  autoBuy: boolean
}): ActionCheck {
  const entries = Object.entries(args.plan) as [Rank, number][]
  const total = entries.reduce((a, [, n]) => a + Math.max(0, n || 0), 0)
  const short = entries
    .filter(([r, n]) => (n || 0) > (args.pool[r] ?? 0))
    .map(([r, n]) => `${(n || 0) - (args.pool[r] ?? 0)} more ${r}`)

  // With auto-buy on, missing gear is a price rather than a blocker — the check still
  // reports the shortfall so the player sees what the purchase will cost them.
  const cost: CostSpec = args.autoBuy ? {} : gearCost(args.type, total)
  return checkAction(cost, args.have, [
    { ok: total > 0, says: 'Select at least one soldier' },
    { ok: short.length === 0, says: short.length ? `Need ${short.join(' + ')}` : '' },
  ])
}
