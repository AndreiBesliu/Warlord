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
// Value import, not a type: the recruit-source getter clamps against a real promotion
// threshold. `units.ts` reads types/registry/names and none of them read this file, so
// there is no cycle.
import { PROMOTE_AT } from './units'

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

export interface BarracksConfig {
  /** How many soldiers a level-1 barracks can quarter. */
  capacityBase: number
  /** Extra places each level above the first adds. */
  capacityPerLevel: number
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

export interface RecruitSourceConfig {
  /** Multiplies the base recruit price. */
  costMult: number
  /** XP every man from this source walks in with, before any training. */
  startingXp: number
}

/** The two numbers a tradition is worth. Declared HERE, not in `tradition.ts`, so the
 *  config store never has to import the catalog — `tradition.ts` already imports this file
 *  for the getters, and a value import back the other way would close a cycle. */
export interface TraditionNumbers {
  /** Morale handed to the legion's surviving cohorts after a battle. */
  moraleBonus: number
  /** Multiplies battle XP, under the absolute `XP_CAP` which no tradition can lift. */
  xpMult: number
}

export interface TraditionRules {
  /** Victories a legion must have to its name before it may swear at all. */
  minHonours: number
  /** Copper the oath costs — arms, banners, and the feast that goes with them. */
  adoptCostCopper: number
}

export interface LegionDeedsConfig {
  /** Percent of the men in the line a legion must supply before the battle counts for it. */
  minSharePct: number
  /** Losses, as a percent of what it fielded, above which a victory counts as ground out. */
  heldTheLinePct: number
  /** Most kills one battle may add to a counter. One slaughter is not a specialisation. */
  killsPerBattleCap: number
  levelBase: number
  levelCurve: number
  maxLevel: number
}

export interface DutyNumbers {
  /** Copper per soldier per day. Negative means the duty pays its way. */
  copperPerSoldier: number
}

/** What a crew is worth and how fast the town grows. Declared here, like `DutyNumbers`,
 *  so the config store never imports `population.ts` — that file imports this one. */
export interface PopulationConfig {
  /** What a FULL crew adds to a building's day. 0.5 = ×1.5. */
  staffBonus: number
  /** Share of the souls that would be born in a day, if the harvest allowed it. */
  growthPctPerDay: number
  /** Food one newcomer eats on arrival. */
  foodPerPerson: number
  /** Percent of the day's harvest the town may spend on growth; the rest fills the granary. */
  growthFoodSharePct: number
}

/** Most hands any building may ever hold, whatever an admin types. */
export const POP_MAX_CREW = 50
/** Most a full crew may ever be worth. `+1.0` means the day at most doubles. */
export const POP_MAX_STAFF_BONUS = 1.0
/** A town cannot be tuned into doubling overnight. */
export const POP_MAX_GROWTH_PCT = 0.25

export const DEFAULT_POPULATION: PopulationConfig = {
  // A hand at full crew is worth 0.5 × output / crew: 83c/day at the lumber mill, 100 at the
  // farm, 150 at the blacksmith, 250 at the Minter, 417 at the armoury. Against a levy at
  // 100c once plus 2-8c/day upkeep and 1-3 food/day, THAT is the trade being asked for.
  staffBonus: 0.5,
  // 100 souls make one a day; doubling takes ~70 game days. Deliberately slower than a
  // session: you must not be able to grow your way out of the recruiting decision while
  // you watch. Offline catch-up is capped at 24 days, so a return is worth at most +24.
  growthPctPerDay: 0.01,
  foodPerPerson: 10,
  // A farm at full material focus turns out 800 / (0.7 × 50) = 22.86 food/day. Half of that
  // is 11, which buys exactly one birth and leaves 12 food — the ration of 12 light infantry.
  growthFoodSharePct: 50,
}

export interface CommanderConfig {
  /** Battles a legion must have behind it before it can raise one of its own. */
  minBattles: number
  appointCostCopper: number
  /** Battles commanded per rank. */
  battlesPerRank: number
  /** Losses, as a percent of what the legion fielded, above which a defeat kills him. */
  fallsAboveLossPct: number
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
  /** Per-source recruiting knobs, keyed by 'LEVY' | 'VOLUNTEERS' | 'MERCENARIES'. */
  recruitSources?: Record<string, Partial<RecruitSourceConfig>>
  barracks?: Partial<BarracksConfig>
  /** Per-intensity training knobs, keyed by 'RUSHED' | 'STANDARD' | 'DRILLED'. */
  intensity?: Record<string, Partial<IntensityConfig>>
  /** How hard it is for a legion to swear to a tradition at all. */
  traditionRules?: Partial<TraditionRules>
  /** What a legion has to do to earn its level, and what stops that being farmed. */
  legionDeeds?: Partial<LegionDeedsConfig>
  /** Per-duty knobs, keyed by duty id ('GARRISON' | 'DRILL' | 'PATROL'). */
  duties?: Record<string, Partial<DutyNumbers>>
  /** What it takes to raise a commander, and what kills one. */
  commander?: Partial<CommanderConfig>
  /** What a crew is worth and how fast the town grows. */
  population?: Partial<PopulationConfig>
  /** Per-building crew sizes, keyed by BuildingType. Can RESIZE a crew, never create one. */
  crew?: Partial<Record<BuildingType, number>>
  /** Per-tradition knobs, keyed by tradition id ('SHIELDWALL', 'IRON_VOW', …). */
  traditions?: Record<string, Partial<TraditionNumbers>>
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

// A standard batch is 20, so a level-1 barracks quarters four of them — tight enough that
// stockpiling men has a cost, wide enough that the opening is not a straitjacket. Forming
// units is the release valve: those soldiers are in the field, not in the barracks.
export const DEFAULT_BARRACKS: BarracksConfig = { capacityBase: 80, capacityPerLevel: 40 }

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
//
// It also destroys the washed-out men's GEAR: `queueLightTraining` buys equipment for the
// whole batch up front and nothing refunds the difference. That is INTENTIONAL and load
// bearing — it is what makes rushing a squad of paid mercenaries cost more than rushing a
// squad of levies, without RUSHED needing to know anything about where the men came from.
// A refund here would make rushing strictly better the more you paid. Pinned by a test.
export const DEFAULT_INTENSITY: Record<string, IntensityConfig> = {
  RUSHED: { dayMult: 0.5, payPerSoldier: 0, xpGranted: 0, washoutPct: 20 },
  STANDARD: { dayMult: 1, payPerSoldier: 0, xpGranted: 0, washoutPct: 0 },
  DRILLED: { dayMult: 1.75, payPerSoldier: 50, xpGranted: 120, washoutPct: 0 },
}

// Where the men come from. LEVY is today's behaviour EXACTLY (×1 price, no XP), so an
// absent source — every save written before this existed — is unchanged.
//
// The load-bearing rule is that NO source reaches PROMOTE_AT.NOVICE (100) on its own.
// A source at or above it would promote a whole rank for money: no extra days, no drill
// pay, no washout. Rank is the one thing this game only ever sells for time, and the
// getter below enforces that as a ceiling rather than trusting these numbers.
//
// It matters a second time because rank is a STEP and the recruit pool is a blended
// average: past the threshold the premium buys nothing visible until bought men are two
// thirds of the pool, which is a cliff nobody can see. Below it the blend is smoothly
// linear in both price and outcome.
//
// The two paid tiers are not on one line. Volunteers give 0.40 XP per extra copper,
// mercenaries 0.30 — mercenaries cost MORE per point but deliver more per MAN, so
// volunteers win when copper is scarce and mercenaries when barracks room or time is.
export const DEFAULT_RECRUIT_SOURCES: Record<string, RecruitSourceConfig> = {
  LEVY: { costMult: 1, startingXp: 0 },
  VOLUNTEERS: { costMult: 2, startingXp: 40 },
  MERCENARIES: { costMult: 4, startingXp: 90 },
}

// Three victories is a legion that has done something, not a legion that exists.
//
// 25,000c is a quarter of the opening purse and 250 recruits — but the copper is ceremony,
// not the gate. The real price of a tradition is the CONSTRAINT: a legion sworn to the
// Shieldwall can never field a horseman again, for the rest of the game. Any coin figure
// that tried to be the whole cost would either be trivial by mid-game or lock the feature
// away from a player who has fought three battles and earned the right to it.
export const DEFAULT_TRADITION_RULES: TraditionRules = { minHonours: 3, adoptCostCopper: 25000 }

// Morale is clamped to 100 wherever it lands, but a legion that gained enough after every
// battle would simply never lose its nerve — and morale gates `computeReady`, so that would
// quietly delete a whole pressure from the game. The ceiling keeps it something you spend.
export const TRADITION_MORALE_CAP = 40

// A quarter of the line: four legions can share a battle and all be credited, five cannot.
// Low enough that real joint deployments work, high enough that a token cohort parked in
// the back rank collects nothing.
//
// The level curve, against a typical win worth 3 renown and an exceptional one worth 12
// (victory + hard-won + without-a-loss), and ONE battle per game-day: level 2 arrives in
// a couple of good days, level 5 around fifteen battles, level 10 around fifty. The pace
// is the calendar, which is the hardest currency this game has.
export const DEFAULT_LEGION_DEEDS: LegionDeedsConfig = {
  minSharePct: 25,
  heldTheLinePct: 40,
  killsPerBattleCap: 200,
  levelBase: 10,
  levelCurve: 1.6,
  maxLevel: 10,
}

// Ordinary upkeep is 2-8 copper per soldier per day before rank multipliers, so a duty
// priced in single copper is felt without dwarfing the thing it sits on top of. The pay
// bound is the tighter of the two because a duty that pays too much is income proportional
// to army size — a printer, not a discount.
export const DUTY_MAX_PAY = 5
export const DUTY_MAX_CHARGE = 50

// Five battles is a legion with a history rather than a roster. 10,000c is a tenth of the
// opening purse — he is a person you pay, not a building you buy. Four battles per rank puts
// rank 5 at sixteen battles commanded, which at one battle a game-day is a real career.
export const DEFAULT_COMMANDER: CommanderConfig = {
  minBattles: 5,
  appointCostCopper: 10_000,
  battlesPerRank: 4,
  fallsAboveLossPct: 50,
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

  recruitSource(key: string): RecruitSourceConfig {
    const base = DEFAULT_RECRUIT_SOURCES[key] ?? DEFAULT_RECRUIT_SOURCES.LEVY
    const o = this.o.recruitSources?.[key] ?? {}
    return {
      costMult: num(o.costMult, base.costMult),
      // A CEILING, not a default. At or above the first promotion threshold a source
      // hands over a whole rank for copper alone — no extra days, no drill pay, no
      // washout — and rank is the one thing this game only ever sells for time. The
      // admin may reprice recruiting however it likes; it cannot buy a rank with it.
      startingXp: Math.min(
        (PROMOTE_AT.NOVICE ?? Infinity) - 1,
        num(o.startingXp, base.startingXp),
      ),
    }
  }

  barracks(): BarracksConfig {
    const b = this.o.barracks ?? {}
    return {
      // A capacity of 0 would make the game unstartable — you could never hold a recruit.
      capacityBase: Math.max(1, num(b.capacityBase, DEFAULT_BARRACKS.capacityBase, 1)),
      capacityPerLevel: num(b.capacityPerLevel, DEFAULT_BARRACKS.capacityPerLevel),
    }
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

  legionDeeds(): LegionDeedsConfig {
    const d = this.o.legionDeeds ?? {}
    const base = DEFAULT_LEGION_DEEDS
    return {
      // A share threshold of 0 would re-open token deployment, which is the one thing this
      // number exists to close; above 100 nothing could ever be credited.
      minSharePct: Math.min(100, Math.max(1, num(d.minSharePct, base.minSharePct, 1))),
      heldTheLinePct: Math.min(100, Math.max(1, num(d.heldTheLinePct, base.heldTheLinePct, 1))),
      killsPerBattleCap: Math.max(1, num(d.killsPerBattleCap, base.killsPerBattleCap, 1)),
      // A base or curve of 0 would hand out the maximum level for one battle.
      levelBase: Math.max(1, num(d.levelBase, base.levelBase, 1)),
      levelCurve: Math.max(1, num(d.levelCurve, base.levelCurve, 1)),
      maxLevel: Math.min(50, Math.max(1, Math.round(num(d.maxLevel, base.maxLevel, 1)))),
    }
  }

  /**
   * `base` is the catalog entry's own numbers, passed in so this file never imports the
   * duty list — same shape as `tradition()`.
   *
   * A duty that PAYS is bounded harder than one that costs: overpaying is a money printer
   * that scales with army size, while overcharging merely makes a duty a bad idea. So the
   * floor is tight and the ceiling is loose, and `num`'s below-minimum fallback means
   * there is no value an admin can type that removes either bound.
   */
  duty(id: string, base: DutyNumbers): DutyNumbers {
    const o = this.o.duties?.[id] ?? {}
    const v = num(o.copperPerSoldier, base.copperPerSoldier, -DUTY_MAX_PAY)
    return { copperPerSoldier: Math.min(DUTY_MAX_CHARGE, v) }
  }

  commander(): CommanderConfig {
    const c = this.o.commander ?? {}
    const base = DEFAULT_COMMANDER
    return {
      minBattles: Math.round(num(c.minBattles, base.minBattles)),
      appointCostCopper: num(c.appointCostCopper, base.appointCostCopper),
      // A rank every zero battles would hand out the ceiling on day one.
      battlesPerRank: Math.max(1, num(c.battlesPerRank, base.battlesPerRank, 1)),
      // At 0 he would die in every defeat; above 100 he could never die at all.
      fallsAboveLossPct: Math.min(100, Math.max(1, num(c.fallsAboveLossPct, base.fallsAboveLossPct, 1))),
    }
  }

  /**
   * A crew that is worth nothing makes the whole feature inert; one worth too much makes
   * working strictly better than fighting. Both bounds live here, so no value anybody can
   * type removes either — `num`'s below-minimum fallback returns the DEFAULT, not the floor.
   */
  population(): PopulationConfig {
    const p = this.o.population ?? {}
    const base = DEFAULT_POPULATION
    return {
      staffBonus: Math.min(POP_MAX_STAFF_BONUS, num(p.staffBonus, base.staffBonus)),
      growthPctPerDay: Math.min(POP_MAX_GROWTH_PCT, num(p.growthPctPerDay, base.growthPctPerDay)),
      // At 0 food a head, a single farm would print the whole growth allowance every day.
      foodPerPerson: Math.max(1, num(p.foodPerPerson, base.foodPerPerson, 1)),
      // At 100 the town eats the entire harvest and the army starves behind it.
      growthFoodSharePct: Math.min(90, num(p.growthFoodSharePct, base.growthFoodSharePct)),
    }
  }

  /**
   * `base` is the crew table's own row, passed in so this file never imports `population.ts`.
   * An override can RESIZE a crew but never create one: a type with no row passes base 0 and
   * the clamp keeps it there, so a config edit cannot hand the barracks a production bonus.
   */
  crew(type: BuildingType, base: number): number {
    if (base <= 0) return 0
    return Math.min(POP_MAX_CREW, Math.max(1, Math.round(num(this.o.crew?.[type], base, 1))))
  }

  traditionRules(): TraditionRules {
    const t = this.o.traditionRules ?? {}
    return {
      minHonours: Math.round(num(t.minHonours, DEFAULT_TRADITION_RULES.minHonours)),
      adoptCostCopper: num(t.adoptCostCopper, DEFAULT_TRADITION_RULES.adoptCostCopper),
    }
  }

  /** `base` is the catalog entry's own numbers — passed in so this file never imports the catalog. */
  tradition(id: string, base: TraditionNumbers): TraditionNumbers {
    const o = this.o.traditions?.[id] ?? {}
    return {
      moraleBonus: Math.min(TRADITION_MORALE_CAP, num(o.moraleBonus, base.moraleBonus)),
      // `XP_CAP` is the real bound on this and no admin value can lift it — battle XP is
      // capped AFTER the multiplier, on purpose. This clamp only keeps out NaN and nonsense.
      xpMult: Math.min(3, num(o.xpMult, base.xpMult)),
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
