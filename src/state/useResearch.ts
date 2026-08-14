import { useState } from 'react'
import type { TechId } from '../logic/research/catalog'
import { DEFAULT_TECHS, resolveCatalog, type CatalogOverrides, type TechDef } from '../logic/research/catalog'
import type { ActiveBuff } from '../logic/research/momentum'
import { BRANCHES, emptyPools, studyCostOf, type StudyPools } from '../logic/research/study'
import type { Branch } from '../logic/research/effects'

// One research project in progress. Progress is STUDY, produced daily by the Scriptorium
// and by whatever share of a building's output the player diverts — not a day countdown.
// `studyTotal` is stored rather than recomputed so a mid-project admin retune of the tech
// cannot silently move the finish line under a player.
export interface ResearchProject {
  id: TechId
  name: string
  branch: Branch
  studyRemaining: number
  studyTotal: number
}

export interface ResearchState {
  unlocked: TechId[]
  queue: ResearchProject[]
  buffs: ActiveBuff[] // temporary momentum effects (victories, discoveries, defeats)
  pools: StudyPools // Study banked per branch, waiting to be spent
}

export function emptyResearch(): ResearchState {
  return { unlocked: [], queue: [], buffs: [], pools: emptyPools() }
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback

function hydratePools(saved: unknown): StudyPools {
  const pools = emptyPools()
  if (!saved || typeof saved !== 'object') return pools
  const s = saved as Record<string, unknown>
  for (const b of BRANCHES) pools[b] = num(s[b])
  return pools
}

/**
 * A project saved under the OLD day-countdown model, carried over without losing progress:
 * two days left out of three becomes two thirds of the study cost.
 */
function migrateProject(raw: Record<string, unknown>, catalog: TechDef[]): ResearchProject | null {
  const id = typeof raw.id === 'string' ? raw.id : null
  if (!id) return null
  const tech = catalog.find((t) => t.id === id)
  const name = typeof raw.name === 'string' ? raw.name : (tech?.name ?? id)
  const branch = (BRANCHES as string[]).includes(raw.branch as string)
    ? (raw.branch as Branch)
    : (tech?.branch ?? 'ECONOMY')

  if (typeof raw.studyRemaining === 'number' || typeof raw.studyTotal === 'number') {
    const total = Math.max(1, num(raw.studyTotal, tech ? studyCostOf(tech) : 1))
    return { id, name, branch, studyTotal: total, studyRemaining: Math.min(total, num(raw.studyRemaining, total)) }
  }

  // Old shape: { id, name, daysRemaining }.
  const total = tech ? studyCostOf(tech) : 1
  const days = tech?.days ?? 1
  const left = num(raw.daysRemaining, days)
  const fraction = days > 0 ? Math.min(1, left / days) : 1
  return { id, name, branch, studyTotal: total, studyRemaining: Math.max(0, Math.round(total * fraction)) }
}

// Merge a (possibly older) saved blob over fresh defaults so new fields always exist.
//
// NOTE this enumerates every field on purpose — but that is exactly why `pools` had to be
// added here as well as to the save object. A field written to localStorage and missing
// from this function is dropped on the next load, silently and with no error.
export function hydrateResearch(saved: unknown, catalogOverrides?: CatalogOverrides): ResearchState {
  if (!saved || typeof saved !== 'object') return emptyResearch()
  const s = saved as { unlocked?: unknown; queue?: unknown; buffs?: unknown; pools?: unknown }
  const catalog = catalogOverrides ? resolveCatalog(catalogOverrides) : DEFAULT_TECHS
  const rawQueue: unknown[] = Array.isArray(s.queue) ? s.queue : []
  const queue = rawQueue
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => migrateProject(p, catalog))
    .filter((p): p is ResearchProject => p !== null)
  return {
    unlocked: Array.isArray(s.unlocked) ? (s.unlocked as TechId[]) : [],
    queue,
    buffs: Array.isArray(s.buffs) ? (s.buffs as ActiveBuff[]) : [],
    pools: hydratePools(s.pools),
  }
}

export function useResearch(saved?: unknown, catalogOverrides?: CatalogOverrides) {
  const [research, setResearch] = useState<ResearchState>(() => hydrateResearch(saved, catalogOverrides))
  return { research, setResearch }
}
