// src/logic/population.ts
// The souls of the domain, and where their hands are.
//
// ── The one decision this exists to create ─────────────────────────────────────────────
//
// A hundred souls will crew your whole domain or fill your barracks, never both. Recruiting
// takes them out of the pool permanently; posting them at a building multiplies that
// building's whole day. So every soldier you raise is a worker the mine no longer has, and
// the choice is not "can I afford it" (copper was never the constraint — a levy costs 100c
// against a 100,000c treasury) but "which of my two engines do I starve".
//
// ── Why a job is not a thing ───────────────────────────────────────────────────────────
//
// There is no job catalog, no MINER/SMITH ids, no legality matrix. The man posted at the
// iron mine is a miner because the mine is a mine. A job list would demand a second
// hydration that resolves ids, a compatibility table, and its own screen — and every
// property that was actually asked for (efficiency, levels, something like the traditions)
// is deliverable without one.
//
// ── The conservation law, as an enumeration rather than a principle ────────────────────
//
// Souls come from exactly ONE place: growth, fed by the food the farms produced TODAY. And
// they leave at exactly ONE place: `recruit()`. Nothing gives them back — not battle deaths
// (`applyBattleResult`), not a retreat (`abandonBattle`), not RUSHED washout, not the
// EPIDEMIC/DESERTERS events, not disbanding a unit, and not the PvP write-back in the other
// repo that rewrites `blob.units` without any hydration running at all.
//
// That one-way street is deliberate. Every closed loop this codebase has shipped turned out
// to be a fountain: `reinforceBuckets` had to be rewritten to close one, and the XP fountain
// in the recruit sources is still open. Discharge → recruit → discharge would launder the
// recruit pool's average XP today and a crew's skill tomorrow.
//
// If building demolition is ever added, it MUST delete the entry from `population.at` in
// the same updater — that is where the conservation test lives.
//
// Pure: no React, no Date.now, no Math.random.

// Deliberately does NOT import `economy.ts`: the day's maths imports THIS file, and the
// same anti-cycle discipline as `GameConfig.duty(id, base)` applies — the dependency runs
// one way only. For the same reason `PopulationConfig` and the two ceilings are declared in
// `config.ts`, next to the getter that enforces them, rather than here.
import { GameConfig, POP_MAX_CREW, POP_MAX_STAFF_BONUS } from './config'
import type { Building, BuildingType } from './types'

export interface PopulationState {
  /** Everyone NOT under arms. Authoritative; `idle` is derived from it, never stored. */
  souls: number
  /** Hands posted, keyed by `Building.id`. Lives HERE and not on the building — see below. */
  at: Record<string, number>
  /**
   * Days this building's crew has actually worked, keyed by `Building.id`. Monotone; the
   * LEVEL is derived from it at read and never stored, so nothing can write a level wrong
   * and no migration is ever owed for one.
   */
  work?: Record<string, number>
  /**
   * What each house has actually PUT OUT, keyed by `Building.id`. Every field monotone and
   * every field derivable from one day-line, so it can never disagree with the day that
   * produced it.
   *
   * It exists because a promise has to be priced against something a player cannot simply
   * WAIT for. `work` is a clock — it counts days, and a day is had by letting time pass.
   * This is a ledger: it counts what the house turned out, and the shares within it are
   * rival by construction (coin, goods and study are three slices of ONE scalar, so a house
   * cannot be excellent at all three). That rivalry is the whole reason it is not a second
   * clock wearing a different name.
   */
  record?: Record<string, CrewRecord>
}

/**
 * One house's account of itself. Copper-denominated where it can be, so the three channel
 * shares sum to the day and can be compared against each other rather than against nothing.
 */
export interface CrewRecord {
  /** Days the crew was present and the day actually ran. */
  days: number
  /** Value of the day paid out as coin. */
  coinVal: number
  /** Value of the day left for goods — whether or not the inputs allowed making any. */
  goodsVal: number
  /** Value of the day diverted to study. The COST of the study, not its yield. */
  studyVal: number
  /** Pieces actually turned out. */
  goods: number
  /** Units of raw material eaten by recipes. */
  fed: number
  /** Hands posted, summed over the counted days. */
  handDays: number
  /** Days every post was filled. */
  daysFull: number
  /** Days the house turned out nothing at all, on any channel. */
  daysDry: number
  /** Days it made goods without consuming anything. */
  daysLean: number
}

export function emptyRecord(): CrewRecord {
  return {
    days: 0, coinVal: 0, goodsVal: 0, studyVal: 0, goods: 0, fed: 0,
    handDays: 0, daysFull: 0, daysDry: 0, daysLean: 0,
  }
}

export function addRecord(a: CrewRecord, b: CrewRecord): CrewRecord {
  return {
    days: a.days + b.days,
    coinVal: a.coinVal + b.coinVal,
    goodsVal: a.goodsVal + b.goodsVal,
    studyVal: a.studyVal + b.studyVal,
    goods: a.goods + b.goods,
    fed: a.fed + b.fed,
    handDays: a.handDays + b.handDays,
    daysFull: a.daysFull + b.daysFull,
    daysDry: a.daysDry + b.daysDry,
    daysLean: a.daysLean + b.daysLean,
  }
}

/** One day's entry, or `null` when there was nothing to enter. */
export function recordDeltaFrom(line: {
  skipped: boolean; coinGain: number; itemsProduced: number; researchValue: number
  studyValue: number; remainderValue: number; inputsConsumed: Partial<Record<string, number>>
}, crew: number, hands: number): CrewRecord | null {
  if (!crewPresent(line, crew, hands)) return null
  const fed = Object.values(line.inputsConsumed).reduce<number>((sum, n) => sum + (n ?? 0), 0)
  const turnedOut = line.coinGain > 0 || line.itemsProduced > 0 || line.studyValue > 0
  return {
    days: 1,
    coinVal: Math.max(0, Math.round(line.coinGain)),
    goodsVal: Math.max(0, Math.round(line.remainderValue)),
    studyVal: Math.max(0, Math.round(line.studyValue)),
    goods: Math.max(0, line.itemsProduced),
    fed,
    handDays: hands,
    daysFull: hands >= crew ? 1 : 0,
    // A day that turned out NOTHING on any channel. Deliberately not `blocked`: a house on
    // full coin focus is never blocked, so a `blocked` counter would say the focus slider's
    // name rather than the day's.
    daysDry: turnedOut ? 0 : 1,
    daysLean: line.itemsProduced > 0 && fed === 0 ? 1 : 0,
  }
}

export function recordAt(pop: PopulationState | null | undefined, b: Building): CrewRecord {
  const raw = pop?.record?.[b.id]
  return raw ? { ...emptyRecord(), ...raw } : emptyRecord()
}

// Why the postings are in this key rather than a `workers` field on `Building`:
//
// `econ.buildings` is the one slice with NO hydration — `saved?.buildings ?? defaults()` and
// `econ.setBuildings(s.buildings ?? …)` are two raw doors with zero coercion. Today that is
// harmless because every field is defended at the point of reading, but `workers` would be
// summed to produce `idle`, and a wrong sum is not a wrong number, it is a wrong INVARIANT.
//
// Worse: a build from before 2026-08-16 writes a fixed literal of 14 keys with no stamping.
// It would DELETE `population` and KEEP `buildings[].workers` — the surviving half would make
// `idle` negative for ever. In one key an old build loses both halves at once and the save
// degrades to "everybody is at home": wrong, but never negative and never stuck.

/**
 * How many hands a building has room for. A type with no row here has no crew at all —
 * asked of this table rather than of a list of building names, so a building added by a mod
 * inherits "no crew" instead of quietly getting one for free.
 *
 * Sized in proportion to `BUILDING_OUTPUT_VALUE`, which is what keeps a hand worth roughly
 * comparable copper everywhere: at the shipped bonus a hand is worth 83c/day at the lumber
 * mill and 417c/day at the armoury. A five-fold band, not a forty-fold one — with a flat
 * crew of ten the mill would pay 15c a hand and the armoury 600c, and "which engine do I
 * starve" would collapse into a sort.
 */
export const CREW_SIZE: Partial<Record<BuildingType, number>> = {
  LUMBER_MILL: 3,
  QUARRY: 3,
  FARM: 4,
  WOODWORKER: 6,
  TAILOR: 8,
  COAL_MINE: 10,
  COPPER_MINE: 10,
  BLACKSMITH: 10,
  SMELTER: 12,
  IRON_MINE: 14,
  MINTER: 16,
  SILVER_MINE: 18,
  ARMORY: 24,
}
// No row for STABLE, MARKET, BARRACKS or SCRIPTORIUM: those four skip the production maths
// entirely, so a crew would multiply nothing.

/**
 * The souls a domain starts with.
 *
 * A module constant rather than a config getter, and that is load-bearing: this is the only
 * number that gets frozen permanently into a save, and `loadWarlordConfig` returns `null`
 * silently when Firestore does not answer — a player who first loaded the game offline would
 * have the default grant frozen for ever while everyone else got the tuned one.
 *
 * Calibrated to refuse: the barracks holds 80 at level 1 and the recruit form proposes 50,
 * so the first attempt to fill the barracks is turned down and the refusal sentence is the
 * feature's tutorial.
 */
export const STARTING_SOULS = 60

/** A day counter nobody can inflate past a plausible lifetime of play. */
const MAX_DAYS_WORKED = 1_000_000
/** Copper adds up faster than days do, so the ledger's ceiling is its own. */
const MAX_LEDGER_ENTRY = 1_000_000_000

export function emptyPopulation(): PopulationState {
  // NOT zeroes, unlike `emptyCampaign`/`emptyLegions`/`emptyResearch`. A domain with no souls
  // refuses every action there is, so "empty" here means "a new town", and the absent-key
  // branch of `hydratePopulation` has to agree with it. There is a test that compares them.
  return { souls: STARTING_SOULS, at: {}, work: {}, record: {} }
}

export function crewSizeOf(type: BuildingType): number {
  // A type with no row gets no crew, and `GameConfig.crew` refuses to create one from a
  // base of 0 — an admin may resize a crew, never invent one, or a config edit would hand
  // the barracks a production bonus it has no way to earn.
  return GameConfig.crew(type, CREW_SIZE[type] ?? 0)
}

/** Hands actually working at this building. Clamped HERE, at the point of reading. */
export function handsAt(pop: PopulationState | null | undefined, b: Building): number {
  const raw = Math.floor(Number(pop?.at?.[b.id]) || 0)
  // Clamping at read rather than at hydration is lossless under the souls-authoritative
  // model: hands over the ceiling simply return to `idle` on their own. So lowering the
  // armoury's crew from the admin cannot strand anyone inside a building with no control.
  return Math.max(0, Math.min(crewSizeOf(b.type), raw))
}

export function postedHands(pop: PopulationState | null | undefined, buildings: Building[]): number {
  let total = 0
  for (const b of buildings) total += handsAt(pop, b)
  return total
}

/** Souls not posted anywhere — the pool recruiting draws on. Derived, never stored. */
export function idleHands(pop: PopulationState | null | undefined, buildings: Building[]): number {
  return Math.max(0, Math.floor(pop?.souls ?? 0) - postedHands(pop, buildings))
}

// ── The crew learns ───────────────────────────────────────────────────────────────────
//
// What a level buys is the VALUE of the work, never freed hands. Freeing hands would be a
// second payment for the same posting, denominated in exactly the resource this feature
// exists to make scarce — and it would be paid by the calendar rather than by a choice.
// Copper is bounded by the aggregate clamp; souls are bounded nowhere.
//
// Nor does a level reset when the hands come off. A mine knows its seams. Resetting would
// punish exactly the micro-management the feature wants to leave free, and it would break
// the monotonicity that makes a derived level safe.

export function daysWorkedAt(pop: PopulationState | null | undefined, b: Building): number {
  const raw = Math.floor(Number(pop?.work?.[b.id]) || 0)
  return raw > 0 ? raw : 0
}

/** Days of work the Nth level asks for. Level 1 is free; the rest compound. */
export function daysForCrewLevel(level: number): number {
  const { levelBase, levelCurve } = GameConfig.population()
  if (level <= 1) return 0
  return Math.round(levelBase * Math.pow(levelCurve, level - 2))
}

/** Derived at READ, from a counter that only ever goes up. */
export function crewLevelFor(daysWorked: number): number {
  const { maxCrewLevel } = GameConfig.population()
  const days = Math.max(0, Math.floor(daysWorked || 0))
  let level = 1
  while (level < maxCrewLevel && days >= daysForCrewLevel(level + 1)) level++
  return level
}

export function crewLevelAt(pop: PopulationState | null | undefined, b: Building): number {
  return crewSizeOf(b.type) > 0 ? crewLevelFor(daysWorkedAt(pop, b)) : 1
}

/** What experience multiplies a crew's worth by. Level 1 is ×1, so slice 1 is unchanged. */
export function crewLevelMult(level: number): number {
  const { perLevelBonus } = GameConfig.population()
  return 1 + perLevelBonus * (Math.max(1, level) - 1)
}

/**
 * Does the day just simulated count as a day of work for this crew?
 *
 * The test is PROOF OF WORK, not the absence of failure. `blocked` cannot be the gate: it is
 * only ever set inside `if (recipe && items > 0)`, and at full coin focus `items` is 0 — so a
 * building on 100% coin is NEVER blocked, and a "not blocked" gate would be something you buy
 * with the focus slider and a wait.
 *
 * Turning out value on ANY of the three channels counts, because all three are the building
 * working. Requiring goods specifically would have taught a coin-focused mill nothing while
 * it produced its whole value, which is not a rule anybody could explain.
 */
/**
 * Was there a crew here, on a day that ran at all? Split out of `creditsADayOfWork` so the
 * ledger and the clock ask the SAME question about attendance and can only ever disagree
 * about what the day produced.
 */
export function crewPresent(line: { skipped: boolean }, crew: number, hands: number): boolean {
  if (line.skipped || crew <= 0) return false
  // `hands > 0` explicitly: without it `0 >= Math.ceil(0.5 * 0)` is true, and every building
  // with no crew row would quietly accrue days it can never spend.
  return hands > 0 && hands >= Math.ceil(0.5 * crew)
}

export function creditsADayOfWork(line: {
  skipped: boolean; coinGain: number; itemsProduced: number; researchValue: number
}, crew: number, hands: number): boolean {
  if (!crewPresent(line, crew, hands)) return false
  return line.coinGain > 0 || line.itemsProduced > 0 || line.researchValue > 0
}

export function staffRatioOf(b: Building, pop: PopulationState | null | undefined): number {
  const crew = crewSizeOf(b.type)
  if (crew <= 0) return 0
  return Math.min(1, handsAt(pop, b) / crew)
}

/**
 * What this building's day is multiplied by, given who is working it.
 *
 * ALWAYS ≥ 1: staffing is a bonus, never a condition. A factor of 0 would fall through
 * `if (!basePerDay)` and return `researchValue: 0` in silence, so a building's Research%
 * slider would stop producing with no message anywhere — and there would be no way out of
 * the "I recruited my own workers" spiral.
 */
export function staffMultOf(b: Building, pop: PopulationState | null | undefined): number {
  const { staffBonus } = GameConfig.population()
  const worth = staffBonus * crewLevelMult(crewLevelAt(pop, b)) * staffRatioOf(b, pop)
  return Math.min(1 + POP_MAX_STAFF_BONUS, 1 + worth)
}

// ── Growth ────────────────────────────────────────────────────────────────────────────
//
// Fed by the food PRODUCED today, never by the granary. That is not a flavour choice: FOOD
// is a market good at 50c in both directions with no spread and no stock, so a granary-fed
// town is bought — 10,000 food costs 500,000c and sells back for the same, which makes a
// head cost 1,000c and pay for itself in a handful of days. Reading the day's harvest puts
// the ceiling on the farm, which is where the design always claimed it was.
//
// It also dissolves a second problem. The tick runs the day with `units: []` and the
// forecast runs it with the real army, so anything read from the granary would disagree
// between the two. Today's harvest is identical in both.

export interface GrowthResult {
  grown: number
  foodSpent: number
  /** Why nobody was born, in three words, for the chip. `null` when somebody was. */
  reason: string | null
}

export function growthFromHarvest(souls: number, foodProduced: number): GrowthResult {
  const cfg = GameConfig.population()
  const have = Math.max(0, Math.floor(foodProduced || 0))
  // The floor of 1 keeps a domain that recruited every last soul from being dead for ever.
  // It still costs the full ration and still needs a farm that produced something today.
  const wanted = Math.max(1, Math.floor(Math.max(0, souls || 0) * cfg.growthPctPerDay))
  const available = Math.floor(have * (cfg.growthFoodSharePct / 100))
  const grown = Math.min(wanted, Math.floor(available / Math.max(1, cfg.foodPerPerson)))
  if (grown > 0) return { grown, foodSpent: grown * cfg.foodPerPerson, reason: null }
  return {
    grown: 0,
    foodSpent: 0,
    reason: have <= 0 ? 'no harvest today' : 'the harvest is too small',
  }
}

// ── Refusals ──────────────────────────────────────────────────────────────────────────

/**
 * Why these hands cannot move. `null` = they can.
 *
 * A refusal rather than a silent clamp: a control that accepts 30 and posts 3 is a silent
 * refusal by another route, which is the thing this codebase keeps having to fix.
 */
export function assignBlocker(
  b: Building, delta: number, pop: PopulationState, buildings: Building[],
): string | null {
  const n = Math.floor(delta || 0)
  if (n === 0) return 'Nothing to move'
  const crew = crewSizeOf(b.type)
  if (crew <= 0) return `A ${pretty(b.type)} has no work for hands`
  const here = handsAt(pop, b)
  if (n > 0) {
    const idle = idleHands(pop, buildings)
    if (idle < n) {
      return idle <= 0
        ? 'No hands free — everyone is posted or under arms'
        : `Only ${idle} hand${idle === 1 ? '' : 's'} free`
    }
    if (here + n > crew) {
      const room = crew - here
      return room <= 0
        ? `The ${pretty(b.type)} is fully crewed at ${crew}`
        : `Room for ${room} more here — extra hands would do nothing`
    }
    return null
  }
  if (here < -n) {
    return here <= 0 ? `Nobody is posted at the ${pretty(b.type)}` : `Only ${here} posted here`
  }
  return null
}

/** Why this many cannot be recruited. `null` = they can. Used by `checkRecruit`. */
export function levyBlocker(qty: number, idle: number): string | null {
  const n = Math.max(0, Math.floor(qty || 0))
  if (n <= 0 || idle >= n) return null
  return idle <= 0
    ? 'No hands left in the domain — take some off a building, or wait for the town to grow'
    : `Only ${idle} hands free — ${n} asked for. Take some off a building, or wait for the town to grow.`
}

// ── Hydration ─────────────────────────────────────────────────────────────────────────

const n0 = (v: unknown, max = Number.MAX_SAFE_INTEGER): number => {
  const x = Math.floor(Number(v))
  return Number.isFinite(x) && x > 0 ? Math.min(max, x) : 0
}

/**
 * Takes the WHOLE save, not just its `population` key — unlike every other slice's hydrate.
 * It has to: with no key at all, the seed depends on what the domain has already built.
 */
export function hydratePopulation(save: unknown): PopulationState {
  const s = (save && typeof save === 'object' ? save : {}) as Record<string, unknown>
  const p = s.population

  if (p && typeof p === 'object') {
    const raw = p as Record<string, unknown>
    const at: Record<string, number> = {}
    const src = raw.at
    if (src && typeof src === 'object') {
      for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
        const hands = n0(v, POP_MAX_CREW)
        if (hands > 0) at[id] = hands
      }
    }
    const work: Record<string, number> = {}
    const wsrc = raw.work
    if (wsrc && typeof wsrc === 'object') {
      for (const [id, v] of Object.entries(wsrc as Record<string, unknown>)) {
        const days = n0(v, MAX_DAYS_WORKED)
        if (days > 0) work[id] = days
      }
    }
    const record: Record<string, CrewRecord> = {}
    const rsrc = raw.record
    if (rsrc && typeof rsrc === 'object') {
      for (const [id, v] of Object.entries(rsrc as Record<string, unknown>)) {
        if (!v || typeof v !== 'object') continue
        const r = v as Record<string, unknown>
        const entry = emptyRecord()
        for (const k of Object.keys(entry) as (keyof CrewRecord)[]) {
          entry[k] = n0(r[k], MAX_LEDGER_ENTRY)
        }
        if (entry.days > 0) record[id] = entry
      }
    }
    return { souls: n0(raw.souls), at, work, record }
  }

  // No key: a save from before this build, or a brand new game. Seed enough souls to
  // roughly crew what is already standing — the soldiers such a save already has are free
  // in retrospect, because charging for them would punish exactly the players who played
  // the most. A day-500 domain of thirteen buildings gets 60 + 138 = 198, all at home; a
  // day-1 domain (barracks + market, neither of which has a crew) gets exactly 60.
  const buildings = Array.isArray(s.buildings) ? (s.buildings as Building[]) : []
  let posts = 0
  for (const b of buildings) {
    if (b && typeof b.type === 'string') posts += crewSizeOf(b.type)
  }
  return { souls: STARTING_SOULS + posts, at: {}, work: {}, record: {} }
}

const pretty = (t: string) =>
  t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())

/** Everything a building's crew row needs to render. One call, so the screens agree. */
export function crewLine(b: Building, pop: PopulationState | null | undefined): {
  crew: number; hands: number; mult: number; has: boolean
  level: number; days: number; nextAt: number | null; record: CrewRecord
} {
  const crew = crewSizeOf(b.type)
  const level = crewLevelAt(pop, b)
  const { maxCrewLevel } = GameConfig.population()
  return {
    crew, hands: handsAt(pop, b), mult: staffMultOf(b, pop), has: crew > 0,
    level, days: daysWorkedAt(pop, b),
    nextAt: level < maxCrewLevel ? daysForCrewLevel(level + 1) : null,
    record: recordAt(pop, b),
  }
}

/**
 * The house's account of itself, in one line. Shares rather than totals, because the shares
 * are what a promise will one day be priced against — and because a total only ever says
 * how long you have been playing.
 */
export function describeRecord(r: CrewRecord): string {
  if (r.days <= 0) return 'this house has kept no account yet'
  const value = r.coinVal + r.goodsVal + r.studyVal
  const pct = (n: number) => `${Math.round((n / Math.max(1, value)) * 100)}%`
  const parts = [
    `${r.days} ${r.days === 1 ? 'day' : 'days'} on the books`,
    value > 0 ? `${pct(r.coinVal)} coin · ${pct(r.goodsVal)} goods · ${pct(r.studyVal)} study` : 'nothing turned out yet',
  ]
  if (r.goods > 0) parts.push(`${r.goods} made`)
  if (r.fed > 0) parts.push(`${r.fed} consumed`)
  if (r.daysDry > 0) parts.push(`${r.daysDry} idle`)
  return parts.join(' · ')
}

/** Every post the standing domain has to offer — for the chip's tooltip. */
export function totalCrewPosts(buildings: Building[]): number {
  let total = 0
  for (const b of buildings) total += crewSizeOf(b.type)
  return total
}
