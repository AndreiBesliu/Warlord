// src/logic/costs.ts
// One answer to "can I afford this, and if not, what exactly am I short of?"
//
// The game knew the answer all along — every buy path already compares a cost against
// the wallet and the stores — but the UI only ever rendered a dead grey "Cannot afford".
// That is the single largest information gap in the interface: the player is told NO
// without being told WHY, and has to go hunting through tabs to work it out.
//
// Pure: no React, no Registry lookups, no formatting decisions beyond the numbers.

import { fmtCopper, type ResourceMap, type Inventories } from './types'

export interface CostSpec {
  copper?: number
  resources?: Partial<Record<string, number>>
  weapons?: Partial<Record<string, number>>
  armors?: Partial<Record<string, number>>
  horses?: Partial<Record<string, number>>
}

export interface Holdings {
  wallet: number
  resources: ResourceMap
  inv?: Inventories
}

export type CostKind = 'copper' | 'resource' | 'weapon' | 'armor' | 'horse'

export interface CostLine {
  kind: CostKind
  key: string // 'COPPER' for money, otherwise the resource/item key
  need: number
  have: number
  short: number // 0 when covered — the number the player actually wants to see
}

export interface CostReport {
  ok: boolean
  lines: CostLine[]
  missing: CostLine[]
  /** "Need 28 Iron Ingot + 2g" — ready for a button label. */
  shortfallLabel: string
}

const pretty = (k: string) => k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())

export function evaluateCost(cost: CostSpec, have: Holdings): CostReport {
  const lines: CostLine[] = []

  if (cost.copper && cost.copper > 0) {
    lines.push({ kind: 'copper', key: 'COPPER', need: cost.copper, have: have.wallet, short: Math.max(0, cost.copper - have.wallet) })
  }
  for (const [key, need] of Object.entries(cost.resources ?? {})) {
    if (!need) continue
    const got = have.resources?.[key as keyof ResourceMap] ?? 0
    lines.push({ kind: 'resource', key, need, have: got, short: Math.max(0, need - got) })
  }
  for (const [key, need] of Object.entries(cost.weapons ?? {})) {
    if (!need) continue
    const got = have.inv?.weapons?.[key] ?? 0
    lines.push({ kind: 'weapon', key, need, have: got, short: Math.max(0, need - got) })
  }
  for (const [key, need] of Object.entries(cost.armors ?? {})) {
    if (!need) continue
    const got = have.inv?.armors?.[key] ?? 0
    lines.push({ kind: 'armor', key, need, have: got, short: Math.max(0, need - got) })
  }
  for (const [key, need] of Object.entries(cost.horses ?? {})) {
    if (!need) continue
    // Horses are {active, inactive}; only the ACTIVE ones can be spent.
    const stall = have.inv?.horses?.[key as keyof Inventories['horses']]
    const got = stall ? stall.active : 0
    lines.push({ kind: 'horse', key, need, have: got, short: Math.max(0, need - got) })
  }

  const missing = lines.filter((l) => l.short > 0)
  return {
    ok: missing.length === 0,
    lines,
    missing,
    shortfallLabel: missing.length === 0
      ? ''
      : 'Need ' + missing
          .map((l) => (l.kind === 'copper' ? fmtCopper(l.short) : `${l.short} ${pretty(l.key)}`))
          .join(' + '),
  }
}

export { pretty as prettyCostKey }
