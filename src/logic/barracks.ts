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
import { itemValueCopper } from './items'
import { drillPayFor, type Intensity } from './batches'
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

// ── Capacity ──────────────────────────────────────────────────────────────
// The barracks had no bottom: you could recruit for ever, and the pool of trained
// soldiers waiting to be formed could grow without consequence. Men take up room now, so
// the way to recruit more is to FORM units — those soldiers are in the field, not in the
// barracks — or to raise the building. That is the barracks upgrade's second reason.

export function barracksCapacity(level: number): number {
  const { capacityBase, capacityPerLevel } = GameConfig.barracks()
  const lvl = Math.max(1, Math.floor(level || 1))
  return Math.max(1, Math.round(capacityBase + capacityPerLevel * (lvl - 1)))
}

/**
 * Everyone the barracks is housing: untyped recruits plus every trained soldier still
 * waiting to be formed. Soldiers inside a Unit are deliberately NOT counted — they have
 * marched out, and that is exactly what makes forming units the release valve.
 */
export function quarteredCount(
  recruits: number,
  pool: Partial<Record<string, Partial<Record<string, { count: number }>>>>,
): number {
  let total = Math.max(0, recruits || 0)
  for (const ranks of Object.values(pool ?? {})) {
    for (const slot of Object.values(ranks ?? {})) {
      total += Math.max(0, slot?.count ?? 0)
    }
  }
  return total
}

export function checkRecruit(
  qty: number,
  have: Holdings,
  quarters?: { quartered: number; capacity: number },
): ActionCheck {
  const n = Math.max(0, Math.floor(qty || 0))
  const room = quarters ? quarters.capacity - quarters.quartered : Infinity
  return checkAction({ copper: recruitCostCopper(n) }, have, [
    { ok: n > 0, says: 'Enter how many to recruit' },
    {
      ok: n <= room,
      says: quarters
        ? (room <= 0
            ? `Barracks full — ${quarters.quartered} of ${quarters.capacity} quartered. Form units or upgrade.`
            : `Only room for ${room} more — ${quarters.quartered} of ${quarters.capacity} quartered.`)
        : '',
    },
  ])
}

export function checkLightTraining(args: {
  target: SoldierType
  qty: number
  recruits: number
  slotFree: boolean
  have: Holdings
  intensity?: Intensity
}): ActionCheck {
  const n = Math.max(0, Math.floor(args.qty || 0))
  // Drill pay belongs in the same check as the gear: a button that allows a batch the
  // logic then refuses is a silent refusal by another route.
  const cost = { ...gearCost(args.target, n), copper: drillPayFor(n, args.intensity) }
  return checkAction(cost, args.have, [
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

  // With auto-buy on, missing gear is a PRICE, not a blocker — but a price the treasury
  // still has to cover. Sending an empty cost here is what let the button sit enabled while
  // the state refused the purchase and explained itself only in the Log tab.
  const gear = gearCost(args.type, total)
  const cost: CostSpec = args.autoBuy
    ? { copper: buyoutCopper(gear, args.have) }
    : gear
  return checkAction(cost, args.have, [
    { ok: total > 0, says: 'Select at least one soldier' },
    { ok: short.length === 0, says: short.length ? `Need ${short.join(' + ')}` : '' },
  ])
}

/** What it would cost to buy whatever part of a gear demand the stores cannot cover. */
export function buyoutCopper(gear: CostSpec, have: Holdings): number {
  const report = evaluateCost(gear, have)
  return report.missing.reduce((sum, line) => sum + line.short * (itemValueCopper(line.key) || 0), 0)
}
