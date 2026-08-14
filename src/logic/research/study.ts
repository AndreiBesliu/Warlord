// src/logic/research/study.ts
// Study — what research actually costs, and where it comes from.
//
// Research used to be a countdown: start a project, wait three days, done. It cost nothing
// the domain was otherwise producing, so it was a queue rather than a decision. Study makes
// it a cost: it is PRODUCED, per branch, by the Scriptorium and by whatever share of a
// building's daily output the player diverts to it.
//
// Pure: no React, no I/O. Every number is read through GameConfig so the admin can tune it.

import { GameConfig } from '../config'
import { buildingLevelMult } from '../economy'
import type { Building, BuildingType } from '../types'
import type { Branch } from './effects'
import type { TechDef } from './catalog'

export const BRANCHES: Branch[] = ['ECONOMY', 'ARMY', 'CAMPAIGN', 'UNLOCKS']

export type StudyPools = Record<Branch, number>

export const emptyPools = (): StudyPools => ({ ECONOMY: 0, ARMY: 0, CAMPAIGN: 0, UNLOCKS: 0 })

/**
 * Which branch a building studies for. A workshop learns about production, a barracks about
 * soldiers. Buildings absent from this map cannot be diverted at all — the Scriptorium
 * because its whole output is already Study, the Market because trade teaches nobody.
 */
const BRANCH_BUILDINGS: Partial<Record<BuildingType, Branch>> = {
  LUMBER_MILL: 'ECONOMY', QUARRY: 'ECONOMY', FARM: 'ECONOMY',
  IRON_MINE: 'ECONOMY', COAL_MINE: 'ECONOMY', COPPER_MINE: 'ECONOMY', SILVER_MINE: 'ECONOMY',
  SMELTER: 'ECONOMY', MINTER: 'ECONOMY', WOODWORKER: 'ECONOMY', TAILOR: 'ECONOMY',
  BLACKSMITH: 'ARMY', ARMORY: 'ARMY', BARRACKS: 'ARMY', STABLE: 'CAMPAIGN',
}

/** The branch this building can study for, or null when it cannot study at all. */
export function branchOfBuilding(type: BuildingType): Branch | null {
  return BRANCH_BUILDINGS[type] ?? null
}

/**
 * What a tech costs in Study. Derived from its `days` so the catalog keeps its meaning and
 * its balance: a 3-day tech costs three reference days of study. `days` is now effort, not
 * elapsed time — how long it actually takes depends on what the domain produces.
 */
export function studyCostOf(tech: Pick<TechDef, 'days'>): number {
  return Math.max(1, Math.round(tech.days * GameConfig.study().baselinePerDay))
}

/**
 * A Scriptorium's contribution, PER BRANCH. It feeds all four, which is why Campaign and
 * Doctrine are researchable at all — no building studies for Doctrine.
 */
export function scriptoriumStudy(level: number): number {
  return GameConfig.study().scriptoriumPerLevel * buildingLevelMult(level)
}

/** Copper of diverted building value → Study. */
export function studyFromValue(copper: number): number {
  return copper / GameConfig.study().copperPerStudy
}

/**
 * How much Study each branch gains in a day, given the domain as it stands. THE single
 * source: the tick, the topbar forecast and the admin preview all call this, so the number
 * shown and the number banked cannot drift. (This codebase has shipped that drift twice.)
 *
 * `divertedValue` is the copper each building routed to research this day — the economy day
 * computes it, because only the economy knows a building's output after level and research.
 */
export function studyPerDay(
  buildings: Building[],
  divertedValue: Partial<Record<string, number>> = {},
): StudyPools {
  const pools = emptyPools()
  for (const b of buildings) {
    if (b.type === 'SCRIPTORIUM') {
      const each = scriptoriumStudy(b.level ?? 1)
      for (const br of BRANCHES) pools[br] += each
      continue
    }
    const branch = branchOfBuilding(b.type)
    if (!branch) continue
    const copper = divertedValue[b.id] ?? 0
    if (copper > 0) pools[branch] += studyFromValue(copper)
  }
  for (const br of BRANCHES) pools[br] = Math.round(pools[br] * 100) / 100
  return pools
}

/** Adding a day's study to the pools, respecting the bank cap. */
export function addStudy(pools: StudyPools, gained: StudyPools): StudyPools {
  const cap = GameConfig.study().poolCap
  const out = emptyPools()
  for (const br of BRANCHES) {
    out[br] = Math.min(cap, (pools[br] ?? 0) + (gained[br] ?? 0))
  }
  return out
}

export interface StudySpendResult {
  pools: StudyPools
  /** Study actually applied to each project id — never more than its branch had. */
  applied: Record<string, number>
}

/**
 * Spend a branch's pool on the projects in that branch. Several projects in one branch share
 * what the branch produced, oldest first — the queue has no length cap, and without this a
 * player could start every tech and have them all advance at full rate for free.
 */
export function spendStudy(
  pools: StudyPools,
  projects: { id: string; branch: Branch; studyRemaining: number }[],
): StudySpendResult {
  const left: StudyPools = { ...pools }
  const applied: Record<string, number> = {}
  for (const p of projects) {
    const available = left[p.branch] ?? 0
    if (available <= 0) continue
    const spend = Math.min(available, p.studyRemaining)
    if (spend <= 0) continue
    left[p.branch] = available - spend
    applied[p.id] = spend
  }
  return { pools: left, applied }
}

/** Days until a project finishes at the current rate — null when nothing is coming in. */
export function daysAtRate(studyRemaining: number, perDay: number): number | null {
  if (!Number.isFinite(perDay) || perDay <= 0) return null
  return Math.ceil(studyRemaining / perDay)
}
