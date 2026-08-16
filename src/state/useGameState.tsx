import { useEffect, useMemo, useState } from 'react'

//logic
import { GOLD, fmtCopper, Ranks, type Rank, type SoldierType, type Building, type ResourceMap } from '../logic/types'
import type { Unit } from '../logic/types'
import { BuildingOutputChoices, FocusOptions } from '../logic/economy'
import { makeEmptyInventories, isHorseKey, type HorseKey } from '../logic/helpers'
import { demandFor, ensureEquipOrBuy, equipFromDemand, addEquip, releaseEquip } from '../logic/equipment'
import { itemValueCopper } from '../logic/items'  // if you use buy/sell here
import { batchSlots, batchDurationDays, survivorsOf, trainingXpFor, type Intensity } from '../logic/batches' // or from your batches helper
import {
  queueLightTraining as qLight, queueLightCavConversion as qLC,
  queueHeavyConversion as qHC, queueHorseArcherConversion as qHA
} from '../logic/training'

//state
import { dailyUpkeepCopper, dailyFoodConsumption, buildingUpgradeCostCopper, buildingCostCopper, buildingResourceCost, buildingLevelMult, BUILDING_MAX_LEVEL } from '../logic/economy'
import { useEconomy } from './useEconomy'
import { useUnits, hydrateUnits } from './useUnits'
import useBarracks, { emptyBarracks, hydrateRecruits } from './useBarracks'
import { takeFrom, startingXpOf, type RecruitSourceId } from '../logic/recruitSources'
import { labelOf, rankName, unitName } from '../logic/names'
import { computeReady, mergeUnits, splitUnit, applyMoraleChange, trainingGainPerDay, promoteBuckets, computeUnitAvgXP, reinforceBuckets } from '../logic/units'
import { Registry } from '../logic/registry'
import { rollDailyEvent } from '../logic/events'
import { recruitCostCopper, barracksCapacity, quarteredCount } from '../logic/barracks'
import { forecastDay } from '../logic/forecast'
import { loadSampleMod } from '../mods/sampleMod';
import { GameConfig, type GameConfigOverrides } from '../logic/config'
import { useCampaign, emptyCampaign, hydrateCampaign, type CampaignReward } from './useCampaign'
import { useResearch, emptyResearch, hydrateResearch, type ResearchProject } from './useResearch'
import { useLegions, emptyLegions, hydrateLegions } from './useLegions'
import {
  emptyLegion, pruneMembership, sanitizeLegionName, suggestLegionName, joinBlocker,
  unitsOfLegion, awardVictoryHonours,
} from '../logic/legion'
import { adoptBlocker, legionEffectsByUnit, outOfKeeping, traditionById } from '../logic/tradition'
import { inspectSave, stampSave } from '../logic/saveSchema'
import { resolveCatalog, techById, prereqsMet, missingBuildings, hasResearchBuilding, type TechId } from '../logic/research/catalog'
import { aggregate, availableTechs, onBattleWon, onBattleLost, onResearchCompleted, tickBuffs, resolveBuffs } from '../logic/research/momentum'
import { BRANCHES, addStudy, spendStudy, studyCostOf } from '../logic/research/study'
import { applyCommand } from '../logic/combat/engine'
import { chooseEnemyCommands } from '../logic/combat/ai'
import { createBattle, missionPresets, DIFFICULTIES, escalationMult, streakLootMult } from '../logic/combat/enemies'
import { applyBattleResult, prettyName } from '../logic/combat/army'
import type { Command, Difficulty } from '../logic/combat/types'

// Initialize registry with core data
Registry.init();
// Load mods (in a real app, this would be dynamic)
loadSampleMod();

function defaultBuildings(): Building[] {
  return [
    { id: 'barracks', type: 'BARRACKS', focusCoinPct: 100, fractionalBuffer: 0 },
    // { id: 'wood1', type: 'WOODWORKER', focusCoinPct: 60, outputItem: 'BOW', fractionalBuffer: 0 },
    { id: 'market', type: 'MARKET', focusCoinPct: 100, fractionalBuffer: 0 },
  ]
}

const emptyResources: ResourceMap = {
  WOOD: 100, STONE: 0,
  IRON_ORE: 0, COAL: 0, COPPER_ORE: 0, SILVER_ORE: 0,
  IRON_INGOT: 0, COPPER_INGOT: 0, SILVER_INGOT: 0,
  FOOD: 50,
}

function readSaveBlob(saveKey: string): any {
  try {
    const raw = localStorage.getItem(saveKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Pluggable persistence so the same game runs off localStorage (standalone) or a cloud
// store (the OurDaysApp embed passes a pre-loaded blob + an onPersist that writes Firestore).
export interface GameStatePersistOpts {
  initialBlob?: any // pre-loaded save (e.g. from the cloud); overrides the localStorage read
  onPersist?: (blob: any) => void // called on every save with the full blob (in addition to localStorage)
  config?: GameConfigOverrides | null // admin-tuned balance values (absent = built-in defaults)
}

const LOG_CAP = 300 // keep the persisted log bounded (display-only; protects the cloud doc size)

export function useGameState(saveKey = 'warlord_save', opts?: GameStatePersistOpts) {
  // Hydrate-on-init: read the save ONCE, synchronously, before any state exists.
  // (Previously the save-effect below ran on mount with fresh state and clobbered the
  // stored save before the player could press Load — a page refresh lost all progress.)
  // A caller-supplied initialBlob (cloud) wins; `undefined` means "read localStorage"
  // (standalone), `null` means "loaded from cloud, empty → fresh game".
  const [saved] = useState(() => (opts?.initialBlob !== undefined ? opts.initialBlob : readSaveBlob(saveKey)))
  const onPersist = opts?.onPersist
  // Defense-in-depth: remember which key this state was hydrated from. If the caller
  // ever changes saveKey without remounting (they should pass key={saveKey}), the
  // persist effect must NOT write state hydrated from another user's key.
  const [hydratedKey] = useState(saveKey)
  // Read ONCE, from the same snapshot the slices hydrated from. Re-reading storage later
  // would inspect a different save than the one in memory, which is the whole question.
  const [inspection, setInspection] = useState(() => inspectSave(saved))

  // day + log
  const [day, setDay] = useState<number>(() => saved?.day ?? 1)
  // Timestamp of the last completed day. This is THE clock: everything about the day
  // schedule is derived from it, and it lives in the save (not in a device-local key)
  // so it travels with the kingdom across devices exactly like `day` does. An older
  // save has no anchor — start it now, so nobody is retro-credited for the past.
  const [lastTickAt, setLastTickAt] = useState<number>(() => {
    const t = saved?.lastTickAt
    return typeof t === 'number' && Number.isFinite(t) ? t : Date.now()
  })
  const [log, setLog] = useState<string[]>(() => saved?.log ?? [])
  const addLog = (s: string) => setLog(l => [`${new Date().toLocaleString()} — ${s} `, ...l])

  const [mergePick, setMergePick] = useState<string[]>([])

  // Admin-tuned balance values. Initialised BEFORE the slices hydrate, not after: research
  // hydration converts an old day-countdown project into study using the CONFIGURED rate,
  // so an admin-tuned baseline has to be in force by then. (It also has to stay a plain
  // call on every render — several modules read GameConfig directly rather than via props.)
  GameConfig.init(opts?.config)
  const cfg = opts?.config ?? undefined

  // slices (each hydrates from the same save blob)
  const econ = useEconomy(10 * GOLD, defaultBuildings, saved ?? undefined)
  const barr = useBarracks(saved ?? undefined)
  const unit = useUnits(saved?.units ?? undefined)
  const camp = useCampaign(saved?.campaign)
  const rsc = useResearch(saved?.research, cfg?.catalog)
  const leg = useLegions(saved?.legions)

  // The tech catalog and the momentum table are DATA — the admin ships an override
  // object and everything downstream resolves against it.
  const catalog = useMemo(() => resolveCatalog(cfg?.catalog), [cfg])
  const buffTable = useMemo(() => resolveBuffs(cfg?.buffs), [cfg])
  const presets = useMemo(() => missionPresets(), [cfg])
  // THE single bonus pipeline: researched techs + active momentum buffs → one object
  // that every boostable knob below reads. No parallel bonus system.
  const mods = useMemo(
    () => aggregate(rsc.research.unlocked, rsc.research.buffs, catalog),
    [rsc.research.unlocked, rsc.research.buffs, catalog],
  )

  useEffect(() => {
    if (saveKey !== hydratedKey) return // never clobber another key's save (see above)
    // A save written by a NEWER build must not be written back by this one. Whatever this
    // build could not hydrate is already missing from the state below, so persisting would
    // truncate it — and `warlordCloud` bumps the rev on every write, so the truncated copy
    // would then win on the player's other devices. Standing down is the only safe move.
    if (inspection.fromNewerBuild) return
    const blob = {
      day, lastTickAt, log: log.slice(0, LOG_CAP),
      wallet: econ.wallet, inv: econ.inv, buildings: econ.buildings, resources: econ.resources,
      barracks: barr.barracks, barracksLevel: barr.barracksLevel,
      recruits: barr.recruits, batches: barr.batches,
      units: unit.units,
      campaign: camp.campaign,
      research: rsc.research,
      legions: leg.legions,
    }
    // Stamped, and carrying anything this build did not recognise. Both matter for the
    // same reason: a save must survive a round trip through a build that does not fully
    // understand it.
    const stamped = stampSave(blob, inspection.carried)
    localStorage.setItem(saveKey, JSON.stringify(stamped)) // fast local cache / offline fallback
    onPersist?.(stamped) // e.g. debounced cloud write (OurDaysApp embed)
  }, [saveKey, day, lastTickAt, log, econ.wallet, econ.inv, econ.buildings, econ.resources, barr.barracks, barr.barracksLevel, barr.recruits, barr.batches, unit.units, camp.campaign, rsc.research, leg.legions, inspection]) // econ.resources & camp.campaign included so those-only changes persist; `inspection` so pressing Load on a newer save stops the writes immediately

  function loadSave() {
    const raw = localStorage.getItem(saveKey)
    if (!raw) return addLog('No save found.')
    try {
      const s = JSON.parse(raw)
      // Re-inspected, because this is a second door into the same state: the mount-time
      // reading describes the blob the slices hydrated from, not whatever is being loaded
      // now. A newer save pressed in through here must stop the writes too.
      setInspection(inspectSave(s))
      setDay(s.day ?? 1); setLog(s.log ?? [])
      setLastTickAt(typeof s.lastTickAt === 'number' && Number.isFinite(s.lastTickAt) ? s.lastTickAt : Date.now())
      econ.setWallet(s.wallet ?? 5 * GOLD)
      econ.setInv(s.inv ?? econ.inv)
      econ.setBuildings(s.buildings ?? econ.buildings)
      econ.setResources(s.resources ?? emptyResources)
      barr.setBarracks(s.barracks ?? barr.barracks)
      barr.setBarracksLevel(s.barracksLevel ?? 1)
      barr.setRecruits(hydrateRecruits(s.recruits))
      barr.setBatches(s.batches ?? [])
      unit.setUnits(hydrateUnits(s.units))
      camp.setCampaign(hydrateCampaign(s.campaign))
      rsc.setResearch(hydrateResearch(s.research, cfg?.catalog))
      leg.setLegions(hydrateLegions(s.legions))
      addLog('Loaded save.')
    } catch { addLog('Failed to load save.') }
  }

  function resetAll() {
    setDay(1); setLog([]); setLastTickAt(Date.now())
    econ.setWallet(10 * GOLD)
    econ.setInv(makeEmptyInventories())
    econ.setBuildings(defaultBuildings())
    econ.setResources({ ...emptyResources })
    barr.setBarracks(emptyBarracks())
    barr.setBarracksLevel(1)
    barr.setRecruits({ count: 0, totalXp: 0 })
    barr.setBatches([])
    unit.setUnits([])
    camp.setCampaign(emptyCampaign())
    rsc.setResearch(emptyResearch())
    leg.setLegions(emptyLegions())
    setMergePick([])
  }

  // type HorseKey = 'LIGHT_HORSE' | 'HEAVY_HORSE'
  // const isHorseKey = (x: string): x is HorseKey => x === 'LIGHT_HORSE' || x === 'HEAVY_HORSE'

  function buy(kind: 'WEAPON' | 'ARMOR' | 'HORSE' | 'RESOURCE', subtype: string, qty: number) {
    if (qty <= 0 || !Number.isFinite(qty)) return
    if (kind === 'HORSE') {
      if (!econ.hasStable) { addLog('You need a STABLE to buy horses.'); return }
      if (!isHorseKey(subtype)) { addLog('Invalid horse type.'); return }
    }

    const price = itemValueCopper(subtype) * qty
    if (econ.wallet < price) { addLog('Not enough funds.'); return }

    econ.setWallet(w => w - price)
    if (kind === 'RESOURCE') {
      econ.setResources(prev => {
        const n = { ...prev }
        n[subtype as keyof ResourceMap] = (n[subtype as keyof ResourceMap] || 0) + qty
        return n
      })
    } else {
      econ.setInv(prev => {
        const n = structuredClone(prev)
        if (kind === 'WEAPON') n.weapons[subtype] = (n.weapons[subtype] ?? 0) + qty
        else if (kind === 'ARMOR') n.armors[subtype] = (n.armors[subtype] ?? 0) + qty
        else n.horses[subtype as HorseKey].active += qty
        return n
      })
    }
    addLog(`Bought ${qty} ${subtype} for ${fmtCopper(price)}.`)
  }

  function sell(kind: 'WEAPON' | 'ARMOR' | 'HORSE' | 'RESOURCE', subtype: string, qty: number) {
    if (qty <= 0 || !Number.isFinite(qty)) return

    if (kind === 'RESOURCE') {
      const have = econ.resources[subtype as keyof ResourceMap] || 0
      if (have < qty) { addLog('Not enough resources to sell.'); return }
      const price = itemValueCopper(subtype) * qty
      econ.setResources(prev => {
        const n = { ...prev }
        n[subtype as keyof ResourceMap] -= qty
        return n
      })
      econ.setWallet(w => w + price)
      addLog(`Sold ${qty} ${subtype} for ${fmtCopper(price)}.`)
    } else {
      let have = 0
      if (kind === 'WEAPON') have = econ.inv.weapons[subtype] ?? 0
      else if (kind === 'ARMOR') have = econ.inv.armors[subtype] ?? 0
      else {
        if (!isHorseKey(subtype)) { addLog('Invalid horse type.'); return }
        have = econ.inv.horses[subtype as HorseKey].active
      }
      if (have < qty) { addLog('Not enough items to sell.'); return }

      const price = itemValueCopper(subtype) * qty
      econ.setInv(prev => {
        const n = structuredClone(prev)
        if (kind === 'WEAPON') n.weapons[subtype] -= qty
        else if (kind === 'ARMOR') n.armors[subtype] -= qty
        else n.horses[subtype as HorseKey].active -= qty
        return n
      })
      econ.setWallet(w => w + price)
      addLog(`Sold ${qty} ${subtype} for ${fmtCopper(price)}.`)
    }
  }

  function buyBuilding(type: Building['type']) {
    if (econ.buildings.some(b => b.type === type)) { addLog(`You already own a ${type}.`); return }
    const cost = buildingCostCopper(type, mods.buildCostMult)
    if (econ.wallet < cost) { addLog(`Not enough funds to buy ${type}. Need ${fmtCopper(cost)}.`); return }

    // Check Resources
    const resCost = buildingResourceCost(type)
    const missing: string[] = []
    for (const [res, amt] of Object.entries(resCost)) {
      if ((econ.resources[res as keyof ResourceMap] || 0) < amt) {
        missing.push(`${amt} ${res} `)
      }
    }
    if (missing.length > 0) {
      addLog(`Not enough resources: need ${missing.join(', ')}.`)
      return;
    }

    // Deduct
    econ.setWallet(w => w - cost)
    econ.setResources(prev => {
      const n = { ...prev }
      for (const [res, amt] of Object.entries(resCost)) {
        n[res as keyof ResourceMap] -= amt
      }
      return n
    })

    const id = `${type.toLowerCase()}_${Math.random().toString(36).slice(2, 8)} `
    const outputItem = BuildingOutputChoices[type].options[0]
    econ.setBuildings(bs => [...bs, { id, type, focusCoinPct: 100, outputItem, fractionalBuffer: 0 }])
    addLog(`Bought ${type} for ${fmtCopper(cost)} and resources.`)
  }

  // Start a research project. Mirrors buyBuilding exactly: every check happens BEFORE
  // any setState, costs are deducted as two independent updaters, then the queue grows.
  function startResearch(techId: TechId) {
    const t = techById(catalog, techId)
    if (!t) { addLog('Unknown technology.'); return }
    if (rsc.research.unlocked.includes(techId)) { addLog(`🔬 ${t.name} is already researched.`); return }
    if (rsc.research.queue.some(p => p.id === techId)) { addLog(`🔬 ${t.name} is already being researched.`); return }
    if (!hasResearchBuilding(econ.buildings)) {
      addLog('🔬 You need a Scriptorium before anything can be researched.')
      return
    }
    const missingB = missingBuildings(t, econ.buildings)
    if (missingB.length > 0) {
      addLog(`🔬 ${t.name} needs: ${missingB.join(', ')}.`)
      return
    }
    if (!prereqsMet(t, rsc.research.unlocked)) {
      const missing = t.requires.filter(r => !rsc.research.unlocked.includes(r))
        .map(r => techById(catalog, r)?.name ?? r)
      addLog(`🔬 ${t.name} requires: ${missing.join(', ')}.`)
      return
    }
    if (econ.wallet < t.costCopper) {
      addLog(`🔬 Not enough funds for ${t.name}. Need ${fmtCopper(t.costCopper)}.`)
      return
    }
    const missingRes: string[] = []
    for (const [res, amt] of Object.entries(t.costResources)) {
      if ((econ.resources[res as keyof ResourceMap] || 0) < (amt as number)) missingRes.push(`${amt} ${res}`)
    }
    if (missingRes.length > 0) { addLog(`Not enough resources: need ${missingRes.join(', ')}.`); return }

    econ.setWallet(w => w - t.costCopper)
    econ.setResources(prev => {
      const n = { ...prev }
      for (const [res, amt] of Object.entries(t.costResources)) {
        n[res as keyof ResourceMap] -= (amt as number)
      }
      return n
    })
    const cost = studyCostOf(t)
    const project: ResearchProject = {
      id: t.id, name: t.name, branch: t.branch, studyRemaining: cost, studyTotal: cost,
    }
    rsc.setResearch(r => ({ ...r, queue: [...r.queue, project] }))
    addLog(`🔬 Research started: ${t.name} (${cost} study, ${fmtCopper(t.costCopper)}).`)
  }

  // Both writers clamp to a real step of the slider. The coin one used to cast through
  // `any`, so any number a caller passed reached the save and the literal union was a
  // decoration. A third channel is not the place to keep that.
  function clampFocus(pct: number): Building['focusCoinPct'] {
    const steps = [0, 20, 40, 60, 80, 100] as const
    const n = Number.isFinite(pct) ? pct : 0
    return steps.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), 0 as Building['focusCoinPct'])
  }

  function setBuildingFocus(id: string, pct: number) {
    const v = clampFocus(pct)
    econ.setBuildings(bs => bs.map(b => b.id === id ? { ...b, focusCoinPct: v } : b))
  }

  function setBuildingResearchFocus(id: string, pct: number) {
    const v = clampFocus(pct)
    econ.setBuildings(bs => bs.map(b => b.id === id ? { ...b, focusResearchPct: v } : b))
  }

  // Generic building upgrade (BARRACKS has its own leveling; MARKET/STABLE have no
  // passive production to scale, so none of the three is upgradable here).
  function upgradeBuilding(id: string) {
    const b = econ.buildings.find(x => x.id === id)
    if (!b) return
    if (['BARRACKS', 'MARKET', 'STABLE'].includes(b.type)) { addLog(`${b.type} cannot be upgraded here.`); return }
    const lvl = b.level ?? 1
    if (lvl >= BUILDING_MAX_LEVEL) { addLog(`${b.type} is already at max level (L${BUILDING_MAX_LEVEL}).`); return }
    const cost = buildingUpgradeCostCopper(b.type, lvl, mods.buildCostMult)
    if (cost <= 0) { addLog(`${b.type} cannot be upgraded.`); return }
    if (econ.wallet < cost) { addLog(`Not enough funds to upgrade ${b.type}. Need ${fmtCopper(cost)}.`); return }
    econ.setWallet(w => w - cost)
    econ.setBuildings(bs => bs.map(x => x.id === id ? { ...x, level: lvl + 1 } : x))
    addLog(`⬆ Upgraded ${b.type} to L${lvl + 1} for ${fmtCopper(cost)} (output ×${buildingLevelMult(lvl + 1).toFixed(1)}).`)
  }

  function setBuildingOutput(id: string, item: string) {
    econ.setBuildings(bs => bs.map(b => b.id === id ? { ...b, outputItem: item } : b))
  }

  function upgradeBarracks() {
    if (barr.barracksLevel >= 5) return
    const cost = barr.barracksUpgradeCost(barr.barracksLevel)
    if (!Number.isFinite(cost)) return

    // Resource cost for upgrades (scale with level?)
    // Basic scaling: (Level+1) * Base Cost
    const baseRes = buildingResourceCost('BARRACKS')
    const scale = barr.barracksLevel
    const missing: string[] = []

    for (const [res, amt] of Object.entries(baseRes)) {
      const required = amt * scale
      if ((econ.resources[res as keyof ResourceMap] || 0) < required) {
        missing.push(`${required} ${res} `)
      }
    }

    if (econ.wallet < cost) {
      addLog(`Not enough funds to upgrade.Need ${fmtCopper(cost)}.`)
      return
    }
    if (missing.length > 0) {
      addLog(`Not enough resources: need ${missing.join(', ')}.`)
      return
    }

    econ.setWallet(w => w - cost)
    econ.setResources(prev => {
      const n = { ...prev }
      for (const [res, amt] of Object.entries(baseRes)) {
        n[res as keyof ResourceMap] -= (amt * scale)
      }
      return n
    })

    barr.setBarracksLevel(prev => {
      const next = Math.min(prev + 1, 5)
      addLog(`Upgraded Barracks to L${next}.`)
      return next
    })
  }


  // NOTE: these used to write to a local, never-rendered `units` state — the buttons
  // silently did nothing. They now operate on the real list (unit.setUnits).
  function toggleTraining(unitId: string) {
    // checks BEFORE setState (no addLog inside the updater)
    const used = unit.units.filter(u => u.training).length
    const slots = barr.barracksLevel + mods.trainSlotsDelta
    const target = unit.units.find(u => u.id === unitId)
    if (!target) return
    if (!target.training && used >= slots) {
      addLog(`Training queue full: ${used}/${slots}.`)
      return
    }
    unit.setUnits(us => us.map(u => u.id === unitId ? { ...u, training: !u.training } : u))
  }

  function doSplit(unitId: string, count: number) {
    unit.setUnits(us => {
      const i = us.findIndex(x => x.id === unitId)
      if (i === -1) return us
      const u = us[i]
      const size = u.buckets.reduce((a, b) => a + b.count, 0)
      if (count <= 0 || count >= size) return us
      const { taken, remaining } = splitUnit(u, count)
      const copy = [...us]
      copy.splice(i, 1, remaining)
      copy.unshift(taken)
      return copy
    })
  }

  function togglePickForMerge(unitId: string) {
    setMergePick(prev => {
      if (prev.includes(unitId)) return prev.filter(id => id !== unitId)
      if (prev.length >= 2) return [prev[1], unitId]
      return [...prev, unitId]
    })
  }

  function doMergeIfReady() {
    if (mergePick.length !== 2) return
    const [aId, bId] = mergePick
    unit.setUnits(us => {
      const a = us.find(x => x.id === aId)
      const b = us.find(x => x.id === bId)
      if (!a || !b || a.type !== b.type) return us
      const merged = mergeUnits(a, b)
      return [merged, ...us.filter(x => x.id !== aId && x.id !== bId)]
    })
    setMergePick([])
  }

  function queueLightTraining(target: SoldierType, qty: number, intensity?: Intensity) {
    qLight({ econ, barr, addLog, mods }, target, qty, intensity)
  }
  function queueLightCavConversion(fromType: SoldierType, qty: number) {
    qLC({ econ, barr, addLog, mods }, fromType, qty)
  }
  function queueHeavyConversion(fromType: SoldierType, qty: number) {
    qHC({ econ, barr, addLog, mods }, fromType, qty)
  }
  function queueHorseArcherConversion(qty: number) {
    qHA({ econ, barr, addLog, mods }, qty)
  }

  // `anchorTo` is for the manual "Run Day" button: it restarts the countdown from that
  // instant. The automatic path passes nothing, so the anchor advances by exactly one
  // window and the schedule stays phase-locked instead of drifting on every late fire.
  function runDailyTick(anchorTo?: number) {
    setLastTickAt(t =>
      typeof anchorTo === 'number' && Number.isFinite(anchorTo) ? anchorTo : t + GameConfig.tickMs()
    )
    const notes: string[] = []
    const income = econ.applyBuildingIncome(s => notes.push(s), mods)
    const delta = income.walletDelta
    // Post-income/production values for this tick's checks: the setState updates from
    // applyBuildingIncome are queued, so the render snapshot is one day behind.
    const postWallet = econ.wallet + delta
    const postRes = income.resources

    // Unit upkeep
    const upkeep = dailyUpkeepCopper(unit.units, mods.upkeepMult)
    if (upkeep > 0) {
      econ.setWallet(w => w - upkeep)
      notes.push(`Upkeep ${fmtCopper(upkeep)}`)
      if (postWallet - upkeep < 0) {
        notes.push('⚠ Nu poți plăti upkeep-ul!')
      }
    }

    // Food consumption (checked against TODAY's production, matching the decrement below)
    const foodNeeded = dailyFoodConsumption(unit.units, mods.foodMult)
    const foodHave = postRes.FOOD ?? 0
    const foodShortage = foodNeeded > 0 && foodHave < foodNeeded
    if (foodNeeded > 0) {
      const foodConsumed = Math.min(foodNeeded, foodHave)
      econ.setResources(prev => ({ ...prev, FOOD: Math.max(0, (prev.FOOD ?? 0) - foodNeeded) }))
      notes.push(`Hrană: -${foodConsumed}/${foodNeeded}`)
      if (foodShortage) {
        notes.push(`⚠ Hrană insuficientă! Lipsesc ${foodNeeded - foodConsumed} unități`)
      }
    }

    // Morale update
    const canPayUpkeep = postWallet >= upkeep
    unit.setUnits(us => us.map(u => applyMoraleChange(u, canPayUpkeep, foodShortage)))

    // Training XP + rank promotions. Logging is computed in a pre-pass over the current
    // snapshot (buckets/XP are untouched by the morale update above, so the outcome is
    // identical) — the state write itself stays a pure functional update.
    const applyDailyXP = (u: Unit) => {
      const base = u.training
        ? u.buckets.map(b => ({ ...b, avgXP: b.avgXP + Math.round(trainingGainPerDay(b.r) * mods.trainXpMult) }))
        : u.buckets
      return promoteBuckets(base)
    }
    for (const u of unit.units) {
      const promo = applyDailyXP(u)
      for (const p of promo.promotions) {
        notes.push(`⬆ ${p.count} ${prettyName(u.type)}: ${p.from} → ${p.to}`)
        addLog(`⬆ ${p.count} ${prettyName(u.type)} promoted ${p.from} → ${p.to}.`)
      }
    }
    unit.setUnits(us => us.map(u => {
      const promo = applyDailyXP(u)
      if (!u.training && promo.promotions.length === 0) return u
      return { ...u, buckets: promo.buckets, avgXP: computeUnitAvgXP(promo.buckets) }
    }))

    // Random daily event
    const event = rollDailyEvent()
    if (event) {
      const { effect } = event
      if (effect.walletDelta) econ.setWallet(w => w + effect.walletDelta!)
      if (effect.resourceDelta) {
        econ.setResources(prev => {
          const n = { ...prev }
          for (const [k, v] of Object.entries(effect.resourceDelta!)) {
            n[k as keyof ResourceMap] = Math.max(0, (n[k as keyof ResourceMap] || 0) + (v || 0))
          }
          return n
        })
      }
      if (effect.moraleAllDelta) {
        unit.setUnits(us => us.map(u => ({
          ...u,
          morale: Math.max(0, Math.min(100, (u.morale ?? 100) + effect.moraleAllDelta!))
        })))
      }
      if (effect.recruitLoss) {
        // Deserters leave at the pool average like anyone else, so the men who stay are no
        // better and no worse trained than they were this morning.
        barr.setRecruits(prev => takeFrom(prev, effect.recruitLoss!))
      }
      notes.push(`${event.title} — ${event.description}`)
      addLog(`📅 Eveniment: ${event.title} — ${event.description}`)
    }

    // Research progress + momentum expiry. Same shape as the training-batch pre-pass:
    // compute over the current snapshot, then write with pure updaters. Placed BEFORE
    // the day-summary log so finished research and expired buffs appear in it.
    // Study produced by today's economy lands in the branch pools; each project then draws
    // from its own branch. `income.studyByBranch` comes from the same day the wallet did,
    // so what the topbar promised and what the pools receive cannot disagree.
    const gainedStudy = income.studyByBranch
    const pooledAfterGain = addStudy(rsc.research.pools, gainedStudy)
    const { pools: poolsAfterSpend, applied } = spendStudy(pooledAfterGain, rsc.research.queue)

    const keptProjects: ResearchProject[] = []
    const doneProjects: ResearchProject[] = []
    for (const p of rsc.research.queue) {
      const left = p.studyRemaining - (applied[p.id] ?? 0)
      if (left > 0) keptProjects.push({ ...p, studyRemaining: left })
      else doneProjects.push(p)
    }
    const { buffs: keptBuffs, expired } = tickBuffs(rsc.research.buffs)
    const studyGained = BRANCHES.some(br => (gainedStudy[br] ?? 0) > 0)
    // Write whenever anything is in flight OR any study came in — a pool filling up while
    // no project runs is real progress, and a length-only check would throw it away.
    if (rsc.research.queue.length > 0 || rsc.research.buffs.length > 0 || studyGained) {
      rsc.setResearch(r => {
        let buffs = keptBuffs
        // A discovery lifts the whole domain for a couple of days (cross-branch effect).
        for (let i = 0; i < doneProjects.length; i++) buffs = onResearchCompleted(buffs, buffTable)
        return {
          ...r,
          unlocked: [...r.unlocked, ...doneProjects.map(p => p.id)],
          queue: keptProjects,
          buffs,
          pools: poolsAfterSpend,
        }
      })
    }
    for (const p of doneProjects) {
      notes.push(`🔬 ${p.name} researched`)
      addLog(`🔬 Research complete: ${p.name}.`)
    }
    for (const name of expired) notes.push(`⏳ ${name} ended`)

    const nextDay = day + 1
    setDay(nextDay)
    addLog(`Day ${nextDay} — ${notes.join(' | ')} | Wallet Δ ${fmtCopper(delta - upkeep)}`)
    // Add: training batch progress here if you want (uses barr.batches etc)

    // Process training batches. Completion is computed in a pre-pass over the current
    // snapshot (nothing else in this tick touches batches), so every setState below is
    // a pure, side-effect-free updater — per the hard rule: no setState inside setState.
    const keptBatches: typeof barr.batches = []
    // A finished batch is a set of arrivals, each at a RANK — not a lump of NOVICE.
    const finished: { pool: SoldierType; arrivals: { r: Rank; count: number; avgXP: number }[]; note: string }[] = []
    for (const b of barr.batches) {
      const nextDays = b.daysRemaining - 1
      if (nextDays > 0) {
        keptBatches.push({ ...b, daysRemaining: nextDays })
        continue
      }
      const { kind, target, qty, intensity, takeByRank, carriedXp } = b
      if (kind === 'LIGHT_TRAIN' && target) {
        // Rushed drilling loses men; drilled training sends them out with XP, which the
        // SAME promotion logic units use turns into a rank. No parallel rank maths here.
        // `carriedXp` is what these men were bought with — absent on every batch queued
        // before recruit sources existed, and 0 means exactly what it always did.
        const out = survivorsOf(qty, intensity)
        const xp = trainingXpFor(intensity, mods.trainXpMult, carriedXp)
        const { buckets } = promoteBuckets([{ r: 'NOVICE', count: out, avgXP: xp }])
        const ranks = buckets.map(x => `${x.count} ${rankName(x.r)}`).join(', ')
        const lost = qty - out
        finished.push({
          pool: target,
          arrivals: buckets.map(x => ({ r: x.r, count: x.count, avgXP: x.avgXP })),
          note: `Training finished: ${ranks} ${unitName(target)}${lost > 0 ? ` (${lost} washed out)` : ''}.`,
        })
      } else if (kind === 'LIGHT_CAV' || kind === 'HEAVY_CAV' || kind === 'HORSE_ARCHER') {
        // A conversion used to consume ADVANCED+ soldiers and hand back NOVICE: the rank
        // they were gated on was destroyed by the very step that required it. `takeByRank`
        // was recorded at enqueue and never read. It is read now.
        const pool = kind as SoldierType
        const kept = Object.entries(takeByRank ?? {})
          .filter((e): e is [Rank, number] => typeof e[1] === 'number' && e[1] > 0)
          .map(([r, count]) => ({ r, count, avgXP: 0 }))
        const arrivals = kept.length ? kept : [{ r: 'NOVICE' as Rank, count: qty, avgXP: 0 }]
        const ranks = arrivals.map(x => `${x.count} ${rankName(x.r)}`).join(', ')
        finished.push({ pool, arrivals, note: `Conversion finished: ${ranks} ${unitName(pool)}.` })
      }
    }
    barr.setBatches(keptBatches)
    if (finished.length) {
      barr.setBarracks(prev => {
        const pool = structuredClone(prev)
        for (const f of finished) {
          for (const a of f.arrivals) {
            const slot = pool[f.pool][a.r]
            const merged = slot.count + a.count
            // Blend the arrivals' XP into the slot, count-weighted — the recruit pool and
            // disband already do this; batch completion used to add the count alone, so a
            // fresh intake silently inherited the average of whoever was already there.
            slot.avgXP = merged ? Math.floor((slot.count * slot.avgXP + a.count * a.avgXP) / merged) : 0
            slot.count = merged
          }
        }
        return pool
      })
      finished.forEach(f => addLog(f.note))
    }
  }

  function createUnitFromBarracks(
    type: SoldierType,
    take: Partial<Record<Rank, number>>,
    opts?: { autoBuy?: boolean }
  ) {
    const autoBuy = !!opts?.autoBuy

    // 1) build buckets & check availability
    const pool = structuredClone(barr.barracks)
    const buckets: Unit['buckets'] = []
    let total = 0
    for (const r of Ranks) {
      const want = take[r] || 0
      if (!want) continue
      if (pool[type][r].count < want) { addLog(`Not enough ${r} in ${type}.`); return }
      const avg = pool[type][r].avgXP
      pool[type][r].count -= want
      buckets.push({ r, count: want, avgXP: avg })
      total += want
    }
    if (total === 0) { addLog('Select at least one soldier.'); return }

    // 2) equipment check / auto-buy
    const need = demandFor(type, total)
    const invClone = structuredClone(econ.inv)
    const res = ensureEquipOrBuy(invClone, econ.wallet, need, autoBuy)
    if (!res.ok) { addLog('Not enough equipment. Enable auto-buy or adjust.'); return }

    // 3) commit inventory + wallet + barracks pool
    econ.setInv(invClone)
    if (res.spent > 0) econ.setWallet(w => w - res.spent)
    barr.setBarracks(pool)

    // 4) create unit
    const totalCount = buckets.reduce((a, b) => a + b.count, 0)
    const wx = buckets.reduce((a, b) => a + b.count * b.avgXP, 0)
    const avgXP = totalCount ? Math.floor(wx / totalCount) : 0

    const unitObj: Unit = {
      id: `U_${Math.random().toString(36).slice(2, 7)}`,
      type,
      buckets,
      avgXP,
      training: false,
      morale: 100,
      // The gear these soldiers just took out of the stores stays with them, so
      // `computeEquipped` measures something real and "Ready N/N" stops lying.
      equip: equipFromDemand(need),
      loadout: { kind: type } as any
    }
    unit.setUnits(us => [unitObj, ...us])

    addLog(`Equipped & created ${total} ${type} ${res.spent > 0 ? `(auto-bought ${fmtCopper(res.spent)})` : '(used stock)'}. AvgXP ${avgXP}.`)
  }

  /**
   * Disband a unit: the soldiers go back to the barracks pool at their rank, and the gear
   * they carried goes back to the stores. Without this, equipment only ever flows one way
   * and "the unit holds its gear" would be a cost with no way back.
   */
  function disbandUnit(unitId: string) {
    const u = unit.units.find(x => x.id === unitId)
    if (!u) { addLog('Disband failed: unit not found.'); return }
    const type = u.type as SoldierType

    const pool = structuredClone(barr.barracks)
    let total = 0
    for (const b of u.buckets) {
      if (b.count <= 0) continue
      const slot = pool[type][b.r]
      const merged = slot.count + b.count
      // Blend the XP the returning soldiers bring into the pool they rejoin.
      slot.avgXP = merged ? Math.floor((slot.count * slot.avgXP + b.count * b.avgXP) / merged) : 0
      slot.count = merged
      total += b.count
    }

    econ.setInv(releaseEquip(econ.inv, u.equip))
    barr.setBarracks(pool)
    unit.setUnits(us => us.filter(x => x.id !== unitId))
    setMergePick(p => p.filter(id => id !== unitId))
    addLog(`Disbanded ${u.id}: ${total} ${type} returned to the barracks, gear back in stores.`)
  }

  function replenishUnit(
    unitId: string,
    plan: Partial<Record<Rank, number>>,
    opts?: { autoBuy?: boolean }
  ) {
    const autoBuy = !!opts?.autoBuy
    const u = unit.units.find(x => x.id === unitId)
    if (!u) { addLog('Replenish failed: unit not found.'); return }
    const type = u.type as SoldierType

    // 1) check pool availability
    const pool = structuredClone(barr.barracks)
    let total = 0
    for (const r of Ranks) {
      const want = Math.max(0, plan[r] || 0)
      if (!want) continue
      if (pool[type][r].count < want) { addLog(`Not enough ${r} in pool for ${type}.`); return }
      pool[type][r].count -= want
      total += want
    }
    if (total === 0) { addLog('Select at least one soldier to replenish.'); return }

    // 2) equipment check / auto-buy
    const need = demandFor(type, total)
    const invClone = structuredClone(econ.inv)
    const res = ensureEquipOrBuy(invClone, econ.wallet, need, autoBuy)
    if (!res.ok) { addLog('Replenish blocked: missing gear.'); return }

    // 3) commit inventory + wallet + barracks pool
    econ.setInv(invClone)
    if (res.spent > 0) econ.setWallet(w => w - res.spent)
    barr.setBarracks(pool)

    // 4) the veterans bring the newcomers up — by SPENDING what they know, not by minting it.
    // The +10% used to be conjured from nothing on every replenishment (~700 XP on a veteran
    // unit) and it compounded, which is what made replenish → disband a loop that printed
    // ranks. `reinforceBuckets` keeps the teaching and makes it a transfer.
    const arrivals: Unit['buckets'] = Ranks
      .filter(r => (plan[r] || 0) > 0)
      .map(r => ({ r, count: plan[r] as number, avgXP: barr.barracks[type][r].avgXP || 0 }))
    const newBuckets = reinforceBuckets(u.buckets, arrivals)

    const unitLabel = `${unitName(type)} ${u.id}`
    const totalCount = newBuckets.reduce((a, b) => a + b.count, 0)
    const wx = newBuckets.reduce((a, b) => a + b.count * b.avgXP, 0)
    const newAvgXP = totalCount ? Math.floor(wx / totalCount) : 0

    unit.setUnits(us => us.map(x => x.id === unitId
      ? { ...x, buckets: newBuckets, avgXP: newAvgXP, equip: addEquip(x.equip, equipFromDemand(need)) }
      : x))

    addLog(`Reinforced ${total} → ${unitLabel} ${res.spent > 0 ? `(auto-bought ${fmtCopper(res.spent)})` : '(used stock)'}. Now ${totalCount} strong, ${newAvgXP} XP each.`)
  }

  function recruit(qty: number, source: RecruitSourceId = 'LEVY') {
    const n = Math.max(1, Math.floor(qty || 0))
    // Recruits used to be free: fifty men appeared and the treasury never moved, so the
    // first step of the whole army loop was not a decision at all. Where they come from
    // is the second half of that decision — price against the head start they bring.
    const cost = recruitCostCopper(n, source)
    if (econ.wallet < cost) {
      addLog(`Cannot afford ${n} ${labelOf(source)} (${fmtCopper(cost)}).`)
      return
    }
    // The barracks holds only so many. Refuse outright rather than recruiting "as many as
    // fit" — that would spend money on a result nobody asked for.
    const capacity = barracksCapacity(barr.barracksLevel)
    const quartered = quarteredCount(barr.recruits.count, barr.barracks)
    if (quartered + n > capacity) {
      addLog(`No room: ${quartered} of ${capacity} quartered. Form units or upgrade the barracks.`)
      return
    }
    if (cost > 0) econ.setWallet(w => w - cost)
    barr.recruit(n, source)
    const xp = startingXpOf(source)
    addLog(
      `Recruited ${n} ${labelOf(source)} for ${fmtCopper(cost)}${xp > 0 ? `, ${xp} XP each` : ''}.`,
    )
  }


  // ---- Legions ----
  // A legion holds units; it does not hold soldiers. Everything here writes only the
  // formation — no unit is ever created, moved or destroyed by these.

  function formLegion(rawName?: string) {
    const suggestion = suggestLegionName(leg.legions.map(l => l.name))
    const name = sanitizeLegionName(rawName ?? '', suggestion)
    const created = emptyLegion(name, day)
    leg.setLegions(ls => [...ls, created])
    addLog(`${name} was raised.`)
    return created.id
  }

  function renameLegion(legionId: string, rawName: string) {
    // The fallback is the CURRENT name, not a fresh suggestion: clearing the field and
    // clicking away must give the name back, not rebaptise the legion.
    leg.setLegions(ls => ls.map(l =>
      l.id === legionId ? { ...l, name: sanitizeLegionName(rawName, l.name) } : l))
  }

  function assignToLegion(legionId: string, unitId: string) {
    const target = leg.legions.find(l => l.id === legionId)
    if (!target) return
    const blocked = joinBlocker(target, unitId, unit.units, leg.legions)
    if (blocked) { addLog(`Cannot assign: ${blocked}.`); return }
    leg.setLegions(ls => {
      // Checked AGAIN, against the current list rather than the render snapshot the message
      // above was built from. Two assignments dispatched inside one frame both read the same
      // stale snapshot, and the second one would happily put a unit into a second legion —
      // fielded twice, numbered twice, in two places at once. The check above exists to tell
      // the player why; this one is what actually holds the invariant.
      const t = ls.find(l => l.id === legionId)
      if (!t || joinBlocker(t, unitId, unit.units, ls)) return ls
      // Prune on the way in. Reads already ignore ids whose units are gone, but the array
      // itself would keep growing: a legion whose twelve cohorts all fell would accept twelve
      // more and end up holding twenty-four strings, twelve of them ghosts.
      const tidied = pruneMembership(t, unit.units)
      return ls.map(l => (l.id === legionId ? { ...tidied, unitIds: [...tidied.unitIds, unitId] } : l))
    })
  }

  function removeFromLegion(legionId: string, unitId: string) {
    leg.setLegions(ls => ls.map(l =>
      l.id === legionId ? { ...l, unitIds: l.unitIds.filter(id => id !== unitId) } : l))
  }

  /**
   * Swear a legion to a tradition. Once, and for good — the only way out is dissolving the
   * legion, which costs it every honour it ever earned. That permanence is the point: a
   * commitment you can walk away from is a preference, not an identity.
   */
  function adoptTradition(legionId: string, traditionId: string) {
    const target = leg.legions.find(l => l.id === legionId)
    const def = traditionById(traditionId)
    if (!target || !def) return
    const cohorts = unitsOfLegion(target, unit.units)
    const blocked = adoptBlocker(target, def, cohorts, econ.wallet)
    if (blocked) { addLog(`Cannot swear: ${blocked}.`); return }

    const cost = GameConfig.traditionRules().adoptCostCopper
    econ.setWallet(w => w - cost)
    leg.setLegions(ls => ls.map(l =>
      l.id === legionId ? { ...l, tradition: def.id, traditionDay: day } : l))
    addLog(`🚩 ${target.name} swore to ${def.name} for ${fmtCopper(cost)}.`)
    // Said at the moment of the oath, not discovered three battles later when the bonus
    // never seemed to arrive.
    const lapsed = outOfKeeping(def, cohorts)
    if (lapsed) addLog(`${target.name} is out of keeping with ${def.name}: ${lapsed}.`)
  }

  /** Disbanding the FORMATION, not its men: the units survive and become unattached. */
  function disbandLegion(legionId: string) {
    const doomed = leg.legions.find(l => l.id === legionId)
    if (!doomed) return
    const freed = unitsOfLegion(doomed, unit.units).length
    leg.setLegions(ls => ls.filter(l => l.id !== legionId))
    addLog(`${doomed.name} was dissolved${freed > 0 ? `; ${freed} cohorts stand unattached` : ''}.`)
  }

  // ---- Campaign / Combat ----

  // Grant battle loot. Validation-free (loot is always non-negative); mirrors the
  // daily-event effect applier — independent setState calls, never nested.
  function grantLoot(reward: CampaignReward) {
    if (reward.copper) econ.setWallet(w => w + reward.copper)
    const res = reward.resources || {}
    if (Object.keys(res).length) {
      econ.setResources(prev => {
        const n = { ...prev }
        for (const [k, v] of Object.entries(res)) {
          n[k as keyof ResourceMap] = Math.max(0, (n[k as keyof ResourceMap] || 0) + (v || 0))
        }
        return n
      })
    }
  }

  function startBattle(deployedUnitIds: string[], difficulty: Difficulty) {
    if (camp.campaign.battle) { addLog('A battle is already in progress.'); return }
    if (camp.campaign.lastBattleDay === day) { addLog('⚔ Your host has already taken the field today. March again tomorrow.'); return }
    const chosen = unit.units.filter(u => deployedUnitIds.includes(u.id))
    if (chosen.length === 0) { addLog('Select at least one unit to deploy.'); return }
    // Seed selection is UI-level (not part of the deterministic engine); the battle is
    // fully reproducible from the seed stored inside its state.
    const seed = (Math.floor(Math.random() * 0x7fffffff)) >>> 0
    const ratioMult = escalationMult(camp.campaign.clears?.[difficulty] ?? 0)
    const rewardMult = streakLootMult(camp.campaign.streak ?? 0) * mods.lootMult
    const created = createBattle(chosen, difficulty, seed, { ratioMult, rewardMult })
    camp.setCampaign(c => ({
      ...c,
      battle: created.state,
      deployedIds: created.deployedIds,
      reward: created.reward,
      lastResult: null,
      lastBattleDay: day,
    }))
    const esc = ratioMult > 1 ? ` (escalated ×${ratioMult.toFixed(2)})` : ''
    addLog(`⚔ Battle started: ${presets[difficulty].name}${esc} (${chosen.length} units vs enemy strength ${created.enemyStrength}).`)
  }

  // Apply one player command to the active battle.
  function battleCommand(cmd: Command) {
    camp.setCampaign(c => {
      if (!c.battle) return c
      return { ...c, battle: applyCommand(c.battle, cmd) }
    })
  }

  // Resolve the whole ENEMY turn deterministically (AI plans, engine applies).
  function runEnemyTurn() {
    camp.setCampaign(c => {
      if (!c.battle || c.battle.status !== 'ONGOING' || c.battle.side !== 'ENEMY') return c
      let b = c.battle
      for (const cmd of chooseEnemyCommands(b)) b = applyCommand(b, cmd)
      return { ...c, battle: b }
    })
  }

  // Collect the outcome of a finished battle: write casualties back into the army,
  // pay loot on a win, update the W/L record, then clear the active battle.
  function finishBattle() {
    const c = camp.campaign
    const b = c.battle
    if (!b || b.status === 'ONGOING') return
    // Resolved against the army as it MARCHED — see `legionEffectsByUnit`. Both channels
    // read this one map, so a legion out of keeping is out of keeping for both.
    const trad = legionEffectsByUnit(leg.legions, unit.units)
    const outcome = applyBattleResult(unit.units, b, c.deployedIds, 'PLAYER',
      id => trad.get(id)?.xpMult ?? 1)
    unit.setUnits(outcome.units)
    const won = outcome.won
    if (won && c.reward) grantLoot(c.reward)
    const rewardText = won && c.reward
      ? ` Loot: ${fmtCopper(c.reward.copper)}${Object.keys(c.reward.resources).length ? ' + resources' : ''}.`
      : ''
    addLog(`⚔ ${won ? 'Victory' : 'Defeat'} at ${presets[b.difficulty].name}! Lost ${outcome.totalLosses} soldiers${outcome.destroyed ? `, ${outcome.destroyed} units wiped out` : ''}, killed ${outcome.totalKills}.${rewardText}`)
    for (const r of outcome.report) {
      for (const p of r.promotions) addLog(`⬆ ${p.count} ${r.name} promoted ${p.from} → ${p.to} in battle.`)
    }
    // Cross-branch momentum: a victory doesn't just pay loot — it lifts the workshops
    // AND the soldiers still in training for a few days. A defeat costs a little output.
    rsc.setResearch(r => ({ ...r, buffs: won ? onBattleWon(r.buffs, buffTable) : onBattleLost(r.buffs, buffTable) }))
    if (won) addLog('🔥 Momentum: War Spoils (+production) and Martial Fervour (+training XP).')
    // Steadier survivors: field surgeons and the like from research, plus whatever the
    // legion's own tradition is worth to its cohorts. One write, not two — they are the
    // same kind of thing arriving at the same moment.
    const survived = new Set(outcome.report.filter(r => !r.destroyed).map(r => r.unitId))
    const moraleFor = (id: string) => mods.postBattleMoraleBonus + (trad.get(id)?.moraleBonus ?? 0)
    if (outcome.report.some(r => !r.destroyed && moraleFor(r.unitId) > 0)) {
      unit.setUnits(us => us.map(u => survived.has(u.id)
        ? { ...u, morale: Math.max(0, Math.min(100, (u.morale ?? 100) + moraleFor(u.id))) }
        : u))
      const held = [...new Set(leg.legions
        .filter(l => l.tradition && l.unitIds.some(id => survived.has(id) && (trad.get(id)?.moraleBonus ?? 0) > 0)
        ).map(l => `${l.name} held to ${traditionById(l.tradition)?.name}`))]
      for (const line of held) addLog(`🚩 ${line}.`)
    }
    // A legion is decorated when its cohorts come home. `deployedIds` is the wrong list to
    // ask — it still names the units that were wiped out, and those are gone from
    // `outcome.units` entirely, so an honour written against them is written to a corpse.
    // The survivor predicate is the one three lines up, deliberately not a second copy.
    if (won) {
      const label = presets[b.difficulty].name
      // Cohorts fell in this battle, so the same write tidies the rolls.
      leg.setLegions(ls => awardVictoryHonours(
        ls.map(l => pruneMembership(l, outcome.units)),
        [...survived],
        { key: `WIN:${b.difficulty}`, label: `Victor of ${label}`, day },
      ))
    }
    camp.setCampaign(prev => ({
      ...prev,
      battle: null,
      deployedIds: [],
      reward: null,
      record: { wins: prev.record.wins + (won ? 1 : 0), losses: prev.record.losses + (won ? 0 : 1) },
      streak: won ? (prev.streak ?? 0) + 1 : 0,
      clears: won
        ? { ...prev.clears, [b.difficulty]: (prev.clears?.[b.difficulty] ?? 0) + 1 }
        : prev.clears,
      lastResult: {
        difficulty: b.difficulty,
        won,
        totalLosses: outcome.totalLosses,
        totalKills: outcome.totalKills,
        destroyed: outcome.destroyed,
        reward: won ? c.reward : null,
        report: outcome.report,
      },
    }))
  }

  function abandonBattle() {
    if (!camp.campaign.battle) return
    // Abandon = treat as a loss with the casualties taken so far (write-back still applies).
    const b = camp.campaign.battle
    const outcome = applyBattleResult(unit.units, { ...b, winner: 'ENEMY' }, camp.campaign.deployedIds)
    unit.setUnits(outcome.units)
    addLog(`⚑ Retreated from ${presets[b.difficulty].name}. Lost ${outcome.totalLosses} soldiers.`)
    rsc.setResearch(r => ({ ...r, buffs: onBattleLost(r.buffs, buffTable) }))
    camp.setCampaign(prev => ({
      ...prev,
      battle: null,
      deployedIds: [],
      reward: null,
      record: { ...prev.record, losses: prev.record.losses + 1 },
      streak: 0,
      lastResult: { difficulty: b.difficulty, won: false, totalLosses: outcome.totalLosses, totalKills: outcome.totalKills, destroyed: outcome.destroyed, reward: null, report: outcome.report },
    }))
  }

  function dismissBattleResult() {
    camp.setCampaign(c => ({ ...c, lastResult: null }))
  }


  // Re-export everything your tabs need (keep names the same as today)
  return {
    // core
    day, log, addLog, runDailyTick, loadSave, resetAll, fmtCopper,
    lastTickAt, setLastTickAt,

    // economy
    wallet: econ.wallet, inv: econ.inv, buildings: econ.buildings, hasStable: econ.hasStable,
    resources: econ.resources, // Export resources
    setWallet: econ.setWallet, setInv: econ.setInv, setBuildings: econ.setBuildings,
    // Prices go out as FUNCTIONS, not raw tables: the displayed price must include the
    // admin config AND the research discount, or the shop lies about what you'll pay.
    buildingPrice: (t: Building['type']) => buildingCostCopper(t, mods.buildCostMult),
    buildingResCost: (t: Building['type']) => buildingResourceCost(t),
    BuildingOutputChoices, FocusOptions,
    buy, sell, buyBuilding, setBuildingFocus, setBuildingResearchFocus, setBuildingOutput, upgradeBuilding,

    // barracks (state)
    recruits: barr.recruits,
    barracks: barr.barracks,
    barracksLevel: barr.barracksLevel,
    batches: barr.batches,
    batchSlots,
    batchDurationDays: (lvl: number) => batchDurationDays(lvl),

    // barracks actions (wrappers)
    barracksUpgradeCost: (lvl: number) => barr.barracksUpgradeCost(lvl),
    recruit,
    upgradeBarracks: upgradeBarracks,

    queueLightTraining,
    queueLightCavConversion,  // implement like above
    queueHeavyConversion,     // implement like above
    queueHorseArcherConversion, // implement like above

    // units
    units: unit.units,
    mergePick,
    computeReady,
    doSplit,
    togglePickForMerge,
    doMergeIfReady,
    toggleTraining,
    // units slice passthroughs you had before…
    createUnitFromBarracks,
    disbandUnit,   // <-- add this
    replenishUnit,            // <-- and this

    // research / momentum
    research: rsc.research,
    mods,
    catalog,
    startResearch,
    // The Scriptorium gates the whole discipline; individual techs gate on their own
    // infrastructure (see missingBuildings) so the UI can say WHAT is missing.
    hasResearchBuilding: hasResearchBuilding(econ.buildings),
    barracksCapacity: barracksCapacity(barr.barracksLevel),
    quartered: quarteredCount(barr.recruits.count, barr.barracks),
    // What tomorrow adds to each branch, from the same function the tick banks with.
    studyPerDay: forecastDay({ buildings: econ.buildings, resources: econ.resources, inv: econ.inv, units: unit.units, mods }).studyByBranch,
    availableResearch: () => availableTechs(catalog, rsc.research.unlocked, rsc.research.queue.map(p => p.id)),

    // Nothing is being saved, because this build is older than the save it opened. The
    // screen has to say so: silence here reads as a working game right up until the
    // player closes the tab and finds an afternoon missing.
    staleBuild: inspection.fromNewerBuild,

    // legions
    legions: leg.legions,
    formLegion,
    adoptTradition,
    renameLegion,
    assignToLegion,
    removeFromLegion,
    disbandLegion,

    // campaign / combat
    campaign: camp.campaign,
    MISSION_PRESETS: presets,
    DIFFICULTIES,
    startBattle,
    battleCommand,
    runEnemyTurn,
    finishBattle,
    abandonBattle,
    dismissBattleResult,
    grantLoot,
  }


}

export type GameStateShape = ReturnType<typeof useGameState>
