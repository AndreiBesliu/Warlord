// src/logic/config.ts
// Runtime game configuration: every balance number the Warlord admin can retune.
//
// Why a singleton (mirroring `Registry`): several of these tables are read directly
// from their modules by UI components (BuildingsTab, ProductionModal), not through
// useGameState. Threading a config prop would leave those reads on the defaults —
// you'd see one price and pay another. A single store initialised once before the
// game mounts keeps every reader honest.
//
// The DEFAULT tables stay exactly where they are and are never mutated; overrides are
// merged on top at init. An empty/absent override = today's behaviour, exactly.

import type { BuildingType, ResourceMap, SoldierType, Rank } from './types'
import type { CatalogOverrides } from './research/catalog'
import type { BuffDef } from './research/momentum'

export interface TrainingConfig {
  baseDays: number // days for a level-1 barracks batch
  minDays: number // floor after level and research reductions
  maxSlots: number // hard cap on concurrent batches
}

export interface TickConfig {
  minutesPerDay: number // real minutes that make one in-game day
  maxOfflineDays: number // how much of an absence is resolved on return (0 = none)
}

export interface StudyConfig {
  /**
   * Study a REFERENCE domain turns out in a day. A tech's `days` is multiplied by this to
   * get its cost, so the catalog keeps meaning what it meant: a 3-day tech costs three
   * reference days of study, and the old numbers stay balanced.
   */
  baselinePerDay: number
  /**
   * What one Scriptorium contributes per level, spread across every branch. Deliberately
   * below the baseline: a lone Scriptorium researches SLOWER than the old day clock, and
   * the old speed is something you buy by diverting workshops. Otherwise the Research%
   * slider would only ever be a bonus, never a decision.
   */
  scriptoriumPerLevel: number
  /** How much a branch can bank while no project is running there. */
  poolCap: number
  /** Copper of diverted building value that becomes one point of Study. */
  copperPerStudy: number
}

export interface IntensityConfig {
  /** Multiplies the base batch duration. */
  dayMult: number
  /** Copper per soldier, charged when the batch is queued. */
  payPerSoldier: number
  /** XP each finished soldier carries out, before research/momentum multipliers. */
  xpGranted: number
  /** Percent of the batch that never finishes. Rushed training loses men. */
  washoutPct: number
}

export interface MissionOverride {
  ratio?: number
  rewardCopperPerStrength?: number
  rewardResources?: Partial<Record<string, number>>
  minTokens?: number
  maxTokens?: number
  baseMorale?: number
}

export interface GameConfigOverrides {
  buildingCost?: Partial<Record<BuildingType, number>>
  buildingResourceCost?: Partial<Record<BuildingType, Partial<ResourceMap>>>
  /** Copper of value a building turns out per day at level 1 — the primary output axis. */
  buildingOutputValue?: Partial<Record<BuildingType, number>>
  /** What an item costs in materials to craft. */
  recipes?: Record<string, Partial<ResourceMap>>
  /** Legacy: output keyed by the produced resource. Still honoured, see buildingOutputValue. */
  resourceBaseValue?: Partial<Record<string, number>>
  upkeepBase?: Partial<Record<SoldierType, number>>
  upkeepRankMult?: Partial<Record<Rank, number>>
  foodBase?: Partial<Record<SoldierType, number>>
  training?: Partial<TrainingConfig>
  tick?: Partial<TickConfig>
  study?: Partial<StudyConfig>
  /** Copper per untyped recruit. Men who cost nothing cannot be a decision. */
  recruitCost?: number
  /** Per-intensity training knobs, keyed by 'RUSHED' | 'STANDARD' | 'DRILLED'. */
  intensity?: Record<string, Partial<IntensityConfig>>
  missions?: Record<string, MissionOverride>
  catalog?: CatalogOverrides
  buffs?: Record<string, Partial<Omit<BuffDef, 'id'>>>
}

export const DEFAULT_TRAINING: TrainingConfig = { baseDays: 7, minDays: 3, maxSlots: 5 }

// 24 days = two real hours of absence resolved on return. Deliberately conservative:
// every caught-up day still charges upkeep and eats food, so a huge catch-up can starve
// an army the player never got to feed. Raise it from the admin if you want more.
export const DEFAULT_TICK: TickConfig = { minutesPerDay: 5, maxOfflineDays: 24 }

// Calibrated against the real scale of the economy, not picked round:
// - baseline 100/day means a 3-day tech costs 300 Study and a tier-3 one 800-1000.
// - a Scriptorium gives 50/branch/day at L1 and, on the shared level curve (×1/1.3/1.6),
//   only 80 at L3 — so even a maxed one never reaches the old day-clock pace on its own.
//   The last stretch always has to come out of production. That is the decision.
// - 50 copper per Study point puts a fully diverted lumber mill (500c/day) at 10/day and
//   a blacksmith (3000c/day) at 60 — diverting a real workshop roughly doubles your pace,
//   and you feel it in the coin and goods you stop getting.
// A recruit costs about a fifth of what a lumber mill turns out in a day, so raising
// fifty men is a real bite out of the treasury rather than a free click.
export const DEFAULT_RECRUIT_COST = 100

// STANDARD is today's behaviour EXACTLY (×1 days, no pay, no XP, no washout) so an
// existing save and every conversion are untouched.
//
// DRILLED grants 120 XP: the NOVICE threshold is 100, so a drilled batch comes out
// TRAINED with 20 carried over. Deliberately short of ADVANCED (which needs another
// 250) — intensity buys a head start, not a shortcut past the 22-day climb through
// Training Mode. Its pay is ~half a recruit per soldier per batch.
//
// RUSHED halves the wait and loses a fifth of the men. Without a real loss the fast
// option would strictly dominate and STANDARD would be dead.
export const DEFAULT_INTENSITY: Record<string, IntensityConfig> = {
  RUSHED: { dayMult: 0.5, payPerSoldier: 0, xpGranted: 0, washoutPct: 20 },
  STANDARD: { dayMult: 1, payPerSoldier: 0, xpGranted: 0, washoutPct: 0 },
  DRILLED: { dayMult: 1.75, payPerSoldier: 50, xpGranted: 120, washoutPct: 0 },
}

export const DEFAULT_STUDY: StudyConfig = {
  baselinePerDay: 100,
  scriptoriumPerLevel: 50,
  poolCap: 1500,
  copperPerStudy: 50,
}

// Only finite, non-negative numbers survive — an admin typo (or a corrupted doc) must
// never turn a price into NaN and brick the economy.
function num(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback
}

class GameConfigStore {
  private o: GameConfigOverrides = {}

  // Replace the active overrides. Called once before the game mounts (and again if the
  // admin saves while the player has the game open and reloads).
  init(overrides?: GameConfigOverrides | null): void {
    this.o = overrides && typeof overrides === 'object' ? overrides : {}
  }

  raw(): GameConfigOverrides {
    return this.o
  }

  buildingCost(type: BuildingType, base: number): number {
    return num(this.o.buildingCost?.[type], base)
  }

  buildingResourceCost(type: BuildingType, base: Partial<ResourceMap>): Partial<ResourceMap> {
    const ov = this.o.buildingResourceCost?.[type]
    return ov && typeof ov === 'object' ? { ...base, ...ov } : base
  }

  buildingOutputValue(type: BuildingType): number | undefined {
    const v = this.o.buildingOutputValue?.[type]
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined
  }

  /** The raw legacy override, with no default folded in — the caller decides precedence. */
  resourceBaseValueOverride(item: string): number | undefined {
    const v = this.o.resourceBaseValue?.[item]
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined
  }

  recipe(item: string, base: Partial<ResourceMap> | undefined): Partial<ResourceMap> | undefined {
    const ov = this.o.recipes?.[item]
    if (!ov || typeof ov !== 'object') return base
    const out: Partial<ResourceMap> = {}
    for (const [k, v] of Object.entries(ov)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) (out as Record<string, number>)[k] = v
    }
    return Object.keys(out).length > 0 ? out : base
  }

  resourceBaseValue(item: string, base: number | undefined): number | undefined {
    const ov = this.o.resourceBaseValue?.[item]
    return typeof ov === 'number' && Number.isFinite(ov) && ov >= 0 ? ov : base
  }

  upkeepBase(type: SoldierType, base: number): number {
    return num(this.o.upkeepBase?.[type], base)
  }

  upkeepRankMult(rank: Rank, base: number): number {
    return num(this.o.upkeepRankMult?.[rank], base)
  }

  foodBase(type: SoldierType, base: number): number {
    return num(this.o.foodBase?.[type], base)
  }

  training(): TrainingConfig {
    const t = this.o.training ?? {}
    const minDays = Math.max(1, num(t.minDays, DEFAULT_TRAINING.minDays, 1))
    return {
      baseDays: Math.max(minDays, num(t.baseDays, DEFAULT_TRAINING.baseDays, 1)),
      minDays,
      maxSlots: Math.max(1, num(t.maxSlots, DEFAULT_TRAINING.maxSlots, 1)),
    }
  }

  tick(): TickConfig {
    const t = this.o.tick ?? {}
    return {
      // A day shorter than 10s would spin the catch-up loop; a missing/absurd value falls back.
      minutesPerDay: Math.max(1 / 6, num(t.minutesPerDay, DEFAULT_TICK.minutesPerDay, 1 / 6)),
      maxOfflineDays: Math.min(2000, Math.floor(num(t.maxOfflineDays, DEFAULT_TICK.maxOfflineDays))),
    }
  }

  tickMs(): number {
    return Math.round(this.tick().minutesPerDay * 60_000)
  }

  recruitCost(): number {
    return num(this.o.recruitCost, DEFAULT_RECRUIT_COST)
  }

  intensity(key: string): IntensityConfig {
    const base = DEFAULT_INTENSITY[key] ?? DEFAULT_INTENSITY.STANDARD
    const o = this.o.intensity?.[key] ?? {}
    return {
      // A zero multiplier would make every batch instant; the floor keeps a batch a batch.
      dayMult: Math.max(0.1, num(o.dayMult, base.dayMult, 0.1)),
      payPerSoldier: num(o.payPerSoldier, base.payPerSoldier),
      xpGranted: num(o.xpGranted, base.xpGranted),
      // Above 99 a batch could finish with nobody in it.
      washoutPct: Math.min(99, num(o.washoutPct, base.washoutPct)),
    }
  }

  study(): StudyConfig {
    const s = this.o.study ?? {}
    return {
      // A baseline of 0 would make every tech free; a copper rate of 0 would divide by zero.
      baselinePerDay: Math.max(1, num(s.baselinePerDay, DEFAULT_STUDY.baselinePerDay, 1)),
      scriptoriumPerLevel: num(s.scriptoriumPerLevel, DEFAULT_STUDY.scriptoriumPerLevel),
      poolCap: num(s.poolCap, DEFAULT_STUDY.poolCap),
      copperPerStudy: Math.max(1, num(s.copperPerStudy, DEFAULT_STUDY.copperPerStudy, 1)),
    }
  }

  mission(id: string): MissionOverride | undefined {
    return this.o.missions?.[id]
  }
}

export const GameConfig = new GameConfigStore()
