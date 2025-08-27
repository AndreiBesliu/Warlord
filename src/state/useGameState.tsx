// src/state/useGameState.ts
import { useEffect, useMemo, useState } from 'react'
import {
  GOLD, fmtCopper,
  type Unit, type Rank, type SoldierType, type Building, type BarracksPool, type RecruitPool,
  SoldierTypes, Ranks, WeaponTypes, ArmorTypes, HorseTypes,
  TrainingBatch, RankCount, isLightInf, isHeavyInf, isLightArcher, isHeavyArcher
} from '../logic/types'
import { itemValueCopper } from '../logic/items'
import { BuildingCostCopper, BuildingOutputChoices, FocusOptions, passiveIncomeAndProduction } from '../logic/economy'
import { computeReady, splitUnit, mergeUnits, trainingGainPerDay } from '../logic/units'
import { trainRecruitsInto, convertToCavalry } from '../logic/training'
import { batchDurationDays, batchSlots, newBatchId, deductByRank, addByRank, sumPlan } from '../logic/batches'

function makeEmptyInventories() {
  return {
    weapons: { HALBERD: 0, SPEAR: 0, SWORD: 0, BOW: 0 } as Record<string, number>,
    armors: { SHIELD: 0, HEAVY_ARMOR: 0, LIGHT_ARMOR: 0, HORSE_ARMOR: 0 } as Record<string, number>,
    horses: {
      LIGHT_HORSE: { active: 0, inactive: 0 },
      HEAVY_HORSE: { active: 0, inactive: 0 }
    } as Record<string, { active: number; inactive: number }>
  }
}

function emptyBarracks(): BarracksPool {
  const pool: any = {}
  SoldierTypes.forEach(t=>{
    pool[t] = {}
    Ranks.forEach(r=>{ pool[t][r] = { r, count: 0, avgXP: 0 } })
  })
  return pool as BarracksPool
}

function makeTestUnit(): Unit {
  const buckets = [
    { r: 'NOVICE', count: 30, avgXP: 0 },
    { r: 'TRAINED', count: 15, avgXP: 150 },
    { r: 'ADVANCED', count: 5, avgXP: 600 },
  ] as Unit['buckets']
  const total = buckets.reduce((a,b)=>a+b.count,0)
  const wx = buckets.reduce((a,b)=>a+b.count*b.avgXP,0)
  return {
    id: `U_${Math.random().toString(36).slice(2,7)}`,
    type: 'LIGHT_INF_SPEAR',
    buckets,
    avgXP: total ? Math.floor(wx/total) : 0,
    training: false,
    equip: { weapons: { SPEAR: 50 }, armors: { LIGHT_ARMOR: 50, SHIELD: 50 }, horses: {} },
    loadout: { kind:'LIGHT_INF_SPEAR', weapon:'SPEAR', shield:true, lightArmor:true },
  }
}

export function useGameState() {
  
  function defaultBuildings(): Building[] {
    return [
      { id: 'barracks', type: 'BARRACKS',  focusCoinPct: 100, fractionalBuffer: 0 },
      { id: 'wood1',    type: 'WOODWORKER',focusCoinPct: 60,  outputItem: 'BOW', fractionalBuffer: 0 },
      { id: 'market',   type: 'MARKET',    focusCoinPct: 100, fractionalBuffer: 0 },
    ]
  }
  
  // Economy / buildings
  const [wallet, setWallet] = useState(10 * GOLD)
  const [inv, setInv] = useState(makeEmptyInventories())
  // initial state:
  const [buildings, setBuildings] = useState<Building[]>(defaultBuildings())
  const [log, setLog] = useState<string[]>([])

  // Barracks
  const [recruits, setRecruits] = useState<RecruitPool>({ count: 0, avgXP: 0 })
  const [barracks, setBarracks] = useState<BarracksPool>(emptyBarracks())
  const [barracksLevel, setBarracksLevel] = useState<number>(1) // slots & duration
  const [batches, setBatches] = useState<TrainingBatch[]>([])

  // Units
  const [units, setUnits] = useState<Unit[]>([])
  const [mergePick, setMergePick] = useState<string[]>([])
  
  // Global day tracker
  const [day, setDay] = useState<number>(1)

  const addLog = (s: string) =>
    setLog((l) => [`${new Date().toLocaleString()} — ${s}`, ...l])

  const hasStable = useMemo(()=>buildings.some(b => b.type === 'STABLE'), [buildings])

  useEffect(() => {
    const save = { wallet, inv, buildings, units, barracks, barracksLevel, recruits, batches, day, }
    localStorage.setItem('warlord_save', JSON.stringify(save))
  }, [wallet, inv, buildings, units, barracks, barracksLevel, recruits, batches, day])

  function loadSave() {
    const raw = localStorage.getItem('warlord_save')
    if (!raw) { addLog('No save found.'); return }
    try {
      const s = JSON.parse(raw)
      setWallet(s.wallet ?? 10 * GOLD)
      setInv(s.inv ?? makeEmptyInventories())
      setBuildings(s.buildings ?? defaultBuildings())          // <- guard
      setUnits(s.units ?? [])
      setBarracks(s.barracks ?? emptyBarracks())
      setBarracksLevel(s.barracksLevel ?? 1)
      setRecruits(s.recruits ?? { count: 0, avgXP: 0 })
      setBatches(s.batches ?? [])
      setDay(s.day ?? 1)
      addLog('Loaded save.')
    } catch {
      addLog('Failed to load save.')
    }
  }

  function resetAll() {
    setWallet(10 * GOLD)
    setInv(makeEmptyInventories())
    setBuildings(defaultBuildings())  
    setUnits([])
    setBarracks(emptyBarracks())
    setBarracksLevel(1)
    setRecruits({ count: 0, avgXP: 0 })
    setBatches([])
    setDay(1)
    setLog([])
    
  }

  // --------- Market ----------
  function buy(kind:'WEAPON'|'ARMOR'|'HORSE', subtype:string, qty:number){
    if (qty<=0) return
    if (kind==='HORSE' && !hasStable) { addLog('You need a STABLE to buy horses.'); return }
    const price = itemValueCopper(subtype) * qty
    if (wallet < price) { addLog('Not enough funds.'); return }
    setWallet(w=>w - price)
    setInv(prev=>{
      const n = structuredClone(prev)
      if (kind==='WEAPON') n.weapons[subtype] = (n.weapons[subtype] ?? 0) + qty
      else if (kind==='ARMOR') n.armors[subtype] = (n.armors[subtype] ?? 0) + qty
      else n.horses[subtype].active += qty
      return n
    })
    addLog(`Bought ${qty} ${subtype} for ${price}c.`)
  }

  function sell(kind:'WEAPON'|'ARMOR'|'HORSE', subtype:string, qty:number){
    if (qty<=0) return
    setInv(prev=>{
      const n = structuredClone(prev)
      let have = kind==='WEAPON' ? (n.weapons[subtype] ?? 0)
               : kind==='ARMOR'  ? (n.armors[subtype] ?? 0)
               : n.horses[subtype].active
      if (have < qty) { addLog('Not enough items to sell.'); return prev }
      const price = itemValueCopper(subtype) * qty
      if (kind==='WEAPON') n.weapons[subtype] -= qty
      else if (kind==='ARMOR') n.armors[subtype] -= qty
      else n.horses[subtype].active -= qty
      setWallet(w=>w + price)
      addLog(`Sold ${qty} ${subtype} for ${price}c.`)
      return n
    })
  }

  // --------- Buildings ----------
  function buyBuilding(type: Building['type']) {
    if (buildings.some((b) => b.type === type)) { addLog(`You already own a ${type}.`); return }
    const cost = BuildingCostCopper[type]
    if (wallet < cost) { addLog(`Not enough funds to buy ${type}. Need ${fmtCopper(cost)}.`); return }
    const id = `${type.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`
    const outputItem = BuildingOutputChoices[type].options[0]
    setWallet((w) => w - cost)
    setBuildings((bs) => [...bs, { id, type, focusCoinPct: 100, outputItem, fractionalBuffer: 0 }])
    addLog(`Bought ${type} for ${fmtCopper(cost)}.`)
  }

  function setBuildingFocus(id: string, pct: number) {
    setBuildings((bs) => bs.map((b) => (b.id === id ? { ...b, focusCoinPct: pct as any } : b)))
  }
  function setBuildingOutput(id: string, item: string) {
    setBuildings((bs) => bs.map((b) => (b.id === id ? { ...b, outputItem: item } : b)))
  }

  // --------- Daily Tick ----------
  function runDailyTick() {
    let walletDelta = 0
    const notes: string[] = []
    const ninv = structuredClone(inv)
   

    // Training XP (first N training units)
    setUnits(us=>{
      let used = 0
      const slots = barracksLevel
      return us.map(u=>{
        if (u.training && used < slots){
          used++
          const nb = u.buckets.map(b=>({ ...b, avgXP: b.avgXP + trainingGainPerDay(b.r) }))
          const total = nb.reduce((a,b)=>a+b.count,0)
          const wx = nb.reduce((a,b)=>a+b.count*b.avgXP,0)
          return { ...u, buckets: nb, avgXP: total? Math.floor(wx/total): 0 }
        }
        return u
      })
    })

    // Building income/production
    const updatedBuildings = buildings.map((b) => {
      const row = { ...b }
  
      // Skip non-income buildings
      if (['STABLE', 'MARKET', 'BARRACKS'].includes(row.type)) return row
  
      const cost = BuildingCostCopper[row.type] || 0
      const { coinGain, items, newBuffer } = passiveIncomeAndProduction({
        costCopper: cost,
        focusCoinPct: row.focusCoinPct,
        outputItem: row.outputItem ?? BuildingOutputChoices[row.type].options[0],
        fractionalBuffer: row.fractionalBuffer ?? 0,
      })
  
      walletDelta += coinGain
      row.fractionalBuffer = newBuffer
  
      const item = row.outputItem ?? BuildingOutputChoices[row.type].options[0]
      if ((WeaponTypes as readonly string[]).includes(item as any)) {
        ninv.weapons[item] = (ninv.weapons[item] ?? 0) + items
      } else if ((ArmorTypes as readonly string[]).includes(item as any)) {
        ninv.armors[item] = (ninv.armors[item] ?? 0) + items
      }
  
      notes.push(`${row.type} → +${items} ${item}, +${fmtCopper(coinGain)}`)
      return row
    })
  
    // --- apply the computed results to state ---
    setBuildings(updatedBuildings)
  
    // Stable: breeding & upkeep (once per day if you have a STABLE)
    if (hasStable) {
      const breedL = Math.floor(0.01 * (ninv.horses.LIGHT_HORSE.active || 0))
      const breedH = Math.floor(0.01 * (ninv.horses.HEAVY_HORSE.active || 0))
      ninv.horses.LIGHT_HORSE.active += breedL
      ninv.horses.HEAVY_HORSE.active += breedH
      const activeTotal = (ninv.horses.LIGHT_HORSE.active || 0) + (ninv.horses.HEAVY_HORSE.active || 0)
      const upkeep = Math.round(activeTotal * (0.005 * GOLD))
      walletDelta -= upkeep
      notes.push(`Stable: +${breedL + breedH} foals; upkeep ${fmtCopper(upkeep)} for ${activeTotal} horses`)
    }

    // Tick batches
    setBatches(prev=>{
      const durNote: string[] = []
      const slots = batchSlots(barracksLevel)
      // (No per-day enforcement needed here; slots enforced at queue time.)
      const next: TrainingBatch[] = []
      let completed: TrainingBatch[] = []

      for (const b of prev) {
        const nb = { ...b, daysRemaining: b.daysRemaining - 1 }
        if (nb.daysRemaining <= 0) completed.push(nb)
        else next.push(nb)
      }

      if (completed.length) {
        setBarracks(bp=>{
          const np = structuredClone(bp)
          for (const b of completed) {
            if (b.kind === 'LIGHT_TRAIN') {
              // add NOVICE of target
              np[b.target].NOVICE.count += b.qty
              durNote.push(`Batch ${b.id}: +${b.qty} ${b.target} (NOVICE)`)
            } else if (b.kind === 'CONVERT_HEAVY') {
              // move by rank from fromType to target using b.takeByRank (ADV+)
              const plan = b.takeByRank || {}
              addByRank(np, b.target, plan)
              durNote.push(`Batch ${b.id}: converted ${sumPlan(plan)} → ${b.target}`)
            } else if (b.kind === 'CONVERT_LIGHT_CAV') {
              const plan = b.takeByRank || {}
              addByRank(np, b.target, plan)
              durNote.push(`Batch ${b.id}: converted ${sumPlan(plan)} → LIGHT_CAV`)
            } else if (b.kind === 'CONVERT_HORSE_ARCHER') {
              const plan = b.takeByRank || {}
              addByRank(np, b.target, plan)
              durNote.push(`Batch ${b.id}: converted ${sumPlan(plan)} → HORSE_ARCHER`)
            }
          }
          if (durNote.length) addLog(durNote.join(' | '))
          return np
        })
      }

      return next
    })

    setInv(ninv)

    const nextDay = day + 1
    setDay(nextDay)

    setWallet((w) => {
      const nw = w + walletDelta
      addLog(`Day ${nextDay} — ${notes.join(' | ')} | Wallet Δ ${fmtCopper(walletDelta)}`)
      return nw
    })
  }

  // --------- Barracks: queue batches ----------
  function queueLightTraining(target: SoldierType, qty: number) {
    // recruits -> LIGHT_* only
    if (!(target === 'LIGHT_ARCHER' || isLightInf(target))) { addLog('Recruits can only train to LIGHT infantry or LIGHT archers.'); return }
    if (qty <= 0 || qty > 50) { addLog('Batch must be between 1 and 50.'); return }
    if (recruits.count < qty) { addLog('Not enough untyped recruits.'); return }
    if (batches.length >= batchSlots(barracksLevel)) { addLog('Barracks training slots are full.'); return }
    setRecruits(r=>({ ...r, count: r.count - qty }))
    const days = batchDurationDays(barracksLevel)
    setBatches(bs=>[...bs, { id: newBatchId(), kind:'LIGHT_TRAIN', target, qty, daysRemaining: days }])
    addLog(`Queued LIGHT training: ${qty} → ${target} (${days} days).`)
  }

  function queueHeavyConversion(fromType: SoldierType, qtyAdvPlus: number) {
    // Allowed sources: LIGHT_CAV or HEAVY_INF_*; all must be ADVANCED+
    const allowedSources: SoldierType[] = [
      'LIGHT_CAV',
      'HEAVY_INF_SWORD','HEAVY_INF_SPEAR','HEAVY_INF_HALBERD'
    ]
    if (!allowedSources.includes(fromType)) {
      addLog('HEAVY_CAV converts from LIGHT_CAV or HEAVY infantry only.')
      return
    }
    if (qtyAdvPlus <= 0 || qtyAdvPlus > 50) { addLog('Batch must be between 1 and 50.'); return }
    if (batches.length >= batchSlots(barracksLevel)) { addLog('Barracks training slots are full.'); return }
  
    // Build plan from ADV -> VET -> ELITE
    const plan: RankCount = {}
    let need = qtyAdvPlus
    for (const r of ['ADVANCED','VETERAN','ELITE'] as Rank[]) {
      const avail = barracks[fromType][r].count
      const take = Math.min(avail, need)
      if (take > 0) { plan[r] = take; need -= take }
    }
    if (need > 0) { addLog(`Not enough ${fromType} Advanced+ to convert.`); return }
  
    // Resource requirements for HEAVY_CAV:
    // - ALWAYS: 1 Heavy Horse + 1 Horse Armor per soldier
    // - EXTRA when source is LIGHT_CAV: 1 Heavy Armor per soldier  ✅ new
    const total = Object.values(plan).reduce((a, b) => a + (b || 0), 0)
    const needHeavyHorse = total
    const needHorseArmor = total
    const needHeavyArmor = fromType === 'LIGHT_CAV' ? total : 0   // ✅
  
    if ((inv.horses.HEAVY_HORSE.active || 0) < needHeavyHorse) { addLog('Not enough HEAVY_HORSE.'); return }
    if ((inv.armors.HORSE_ARMOR || 0) < needHorseArmor) { addLog('Not enough HORSE_ARMOR.'); return }
    if (needHeavyArmor > 0 && (inv.armors.HEAVY_ARMOR || 0) < needHeavyArmor) { // ✅
      addLog('Not enough HEAVY_ARMOR for LIGHT_CAV conversion.')
      return
    }
  
    // Reserve resources now
    setInv(n => {
      const c = structuredClone(n)
      c.horses.HEAVY_HORSE.active -= needHeavyHorse
      c.armors.HORSE_ARMOR       -= needHorseArmor
      if (needHeavyArmor > 0) c.armors.HEAVY_ARMOR -= needHeavyArmor  // ✅
      return c
    })
  
    // Deduct trainees from source (they’re in training)
    setBarracks(bp=>{
      const np = structuredClone(bp)
      for (const r of Object.keys(plan) as (keyof RankCount)[]) {
        const q = plan[r] || 0
        if (q > 0) np[fromType][r as Rank].count -= q
      }
      return np
    })
  
    const days = batchDurationDays(barracksLevel)
    setBatches(bs=>[
      ...bs,
      {
        id: newBatchId(),
        kind: 'CONVERT_HEAVY',
        target: 'HEAVY_CAV',
        fromType,
        takeByRank: plan,
        qty: qtyAdvPlus,
        daysRemaining: days
      }
    ])
    addLog(`Queued HEAVY_CAV conversion: ${qtyAdvPlus} from ${fromType} (${days} days).`)
  }
  

  function queueLightCavConversion(fromLightInf: SoldierType, qty: number) {
    if (!isLightInf(fromLightInf)) { addLog('Light Cavalry converts from LIGHT infantry.'); return }
    if (qty <= 0 || qty > 50) { addLog('Batch must be between 1 and 50.'); return }
    if (batches.length >= batchSlots(barracksLevel)) { addLog('Barracks training slots are full.'); return }
    // pull by rank (any ranks allowed)
    let need = qty
    const plan: RankCount = {}
    for (const r of Ranks) {
      const avail = barracks[fromLightInf][r].count
      const take = Math.min(avail, need)
      if (take>0){ plan[r]=take; need-=take }
    }
    if (need>0){ addLog('Not enough source infantry.'); return }
    // horses required
    const total = sumPlan(plan)
    if ((inv.horses.LIGHT_HORSE.active || 0) < total) { addLog('Not enough LIGHT_HORSE.'); return }
    setInv(n => { const c = structuredClone(n); c.horses.LIGHT_HORSE.active -= total; return c })
    // deduct from source
    setBarracks(bp=>{ const np = structuredClone(bp); deductByRank(np, fromLightInf, plan); return np })
    const days = batchDurationDays(barracksLevel)
    setBatches(bs=>[...bs, { id:newBatchId(), kind:'CONVERT_LIGHT_CAV', target:'LIGHT_CAV', fromType:fromLightInf, takeByRank:plan, qty, daysRemaining:days }])
    addLog(`Queued LIGHT_CAV conversion: ${qty} from ${fromLightInf} (${days} days).`)
  }

  function queueHorseArcherConversion(qtyAdvPlus: number) {
    const fromType: SoldierType = 'LIGHT_ARCHER'
    if (qtyAdvPlus <= 0 || qtyAdvPlus > 50) { addLog('Batch must be between 1 and 50.'); return }
    if (batches.length >= batchSlots(barracksLevel)) { addLog('Barracks training slots are full.'); return }

    const plan: RankCount = {}
    let need = qtyAdvPlus
    for (const r of ['ADVANCED','VETERAN','ELITE'] as Rank[]) {
      const avail = barracks[fromType][r].count
      const take = Math.min(avail, need)
      if (take > 0) { plan[r] = take; need -= take }
    }
    if (need > 0) { addLog('Not enough LIGHT_ARCHER Advanced+.'); return }

    const total = sumPlan(plan)
    if ((inv.horses.LIGHT_HORSE.active || 0) < total) { addLog('Not enough LIGHT_HORSE.'); return }
    setInv(n => { const c = structuredClone(n); c.horses.LIGHT_HORSE.active -= total; return c })
    setBarracks(bp=>{ const np = structuredClone(bp); deductByRank(np, fromType, plan); return np })

    const days = batchDurationDays(barracksLevel)
    setBatches(bs=>[...bs, { id:newBatchId(), kind:'CONVERT_HORSE_ARCHER', target:'HORSE_ARCHER', fromType, takeByRank:plan, qty:qtyAdvPlus, daysRemaining:days }])
    addLog(`Queued HORSE_ARCHER conversion: ${qtyAdvPlus} from LIGHT_ARCHER (${days} days).`)
  }

  // Legacy actions you already use in UI:
  function recruit(qty: number){
    if (qty <= 0) return
    setRecruits(r => ({ ...r, count: r.count + qty }))
    addLog(`Recruited ${qty} untrained recruits.`)
  }
  
  function trainTo(t: SoldierType, n: number){ queueLightTraining(t, n) } // alias for UI
  function convertCav(from: SoldierType, to: 'LIGHT_CAV'|'HEAVY_CAV'|'HORSE_ARCHER', planOrQty: any) {
    // keep compatibility with existing UI ConvertCavForm:
    if (to === 'LIGHT_CAV')      queueLightCavConversion(from, sumPlan(planOrQty) || planOrQty)
    else if (to === 'HEAVY_CAV') queueHeavyConversion('LIGHT_CAV', sumPlan(planOrQty) || planOrQty) // if you want heavy cav via light cav (ADV+), call this directly elsewhere
    else if (to === 'HORSE_ARCHER') queueHorseArcherConversion(sumPlan(planOrQty) || planOrQty)
  }

  function createUnitFromBarracks(type: SoldierType, take: Partial<Record<Rank, number>>){
    setBarracks(prev=>{
      const pool = structuredClone(prev)
      const buckets: Unit['buckets'] = []
      let total = 0
      for (const r of Ranks){
        const want = take[r] || 0
        if (want>0){
          if (pool[type][r].count < want){ addLog(`Not enough ${r} in barracks.`); return prev }
          const avg = pool[type][r].avgXP
          pool[type][r].count -= want
          buckets.push({ r, count: want, avgXP: avg })
          total += want
        }
      }
      if (total===0){ addLog('Select at least one soldier.'); return prev }

      const totalCount = buckets.reduce((a,b)=>a+b.count,0)
      const wx = buckets.reduce((a,b)=>a+b.count*b.avgXP,0)
      const avgXP = totalCount? Math.floor(wx/totalCount) : 0

      const unit: Unit = {
        id: `U_${Math.random().toString(36).slice(2,7)}`,
        type,
        buckets,
        avgXP,
        training: false,
        equip: { weapons:{}, armors:{}, horses:{} },
        loadout:
          type.startsWith('LIGHT_INF') ? { kind: type as any, weapon: (type.includes('SWORD')?'SWORD':type.includes('SPEAR')?'SPEAR':'HALBERD'), shield:true, lightArmor:true }
        : type.startsWith('HEAVY_INF') ? { kind: type as any, weapon: (type.includes('SWORD')?'SWORD':type.includes('SPEAR')?'SPEAR':'HALBERD'), shield:true, heavyArmor:true }
        : type === 'LIGHT_ARCHER'      ? { kind: 'LIGHT_ARCHER', weapon:'BOW', lightArmor:true, shield:false }
        : type === 'HEAVY_ARCHER'      ? { kind: 'HEAVY_ARCHER', weapon:'BOW', heavyArmor:true, shield:false }
        : type === 'LIGHT_CAV'         ? { kind: 'LIGHT_CAV', weapon:'SPEAR', lightArmor:true }
        : type === 'HEAVY_CAV'         ? { kind: 'HEAVY_CAV', weapon:'HALBERD', heavyArmor:true, horseArmor:true }
        :                                 { kind: 'HORSE_ARCHER', weapon:'BOW', lightArmor:true }
      }
      setUnits(us=>[unit, ...us])
      addLog(`Created ${unit.id} (${type}) size ${total}, avgXP ${avgXP}.`)
      return pool
    })
  }

  function toggleTraining(unitId: string){
    setUnits(us=>{
      const used = us.filter(u=>u.training).length
      const slots = barracksLevel
      return us.map(u=>{
        if (u.id !== unitId) return u
        if (!u.training){
          if (used >= slots) { addLog(`Training queue full: ${used}/${slots} slots in use.`); return u }
          return { ...u, training: true }
        }
        return { ...u, training: false }
      })
    })
  }

  // define (keep whatever values you had)
  function barracksUpgradeCost(level:number){
    if (level===1) return 50*GOLD
    if (level===2) return 150*GOLD
    if (level===3) return 400*GOLD
    if (level===4) return 800*GOLD
    return Infinity
  }

  function upgradeBarracks(){
    if (barracksLevel>=5) return
    const cost = barracksUpgradeCost(barracksLevel)
    if (wallet < cost){ addLog(`Not enough funds to upgrade Barracks to L${barracksLevel+1}. Cost: ${fmtCopper(cost)}`); return }
    setWallet(w=>w-cost)
    setBarracksLevel(l=>l+1)
    addLog(`Upgraded Barracks to level ${barracksLevel+1} (slots: ${batchSlots(barracksLevel+1)}, batch days: ${batchDurationDays(barracksLevel+1)}).`)
  }

  // --------- Units / merge/split ----------
  function addTestUnit() { setUnits((u) => [makeTestUnit(), ...u]) }
  function doSplit(unitId: string, count: number) {
    setUnits((us) => {
      const i = us.findIndex((x) => x.id === unitId)
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
    setMergePick((prev) => {
      if (prev.includes(unitId)) return prev.filter((id) => id !== unitId)
      if (prev.length >= 2) return [prev[1], unitId]
      return [...prev, unitId]
    })
  }
  function doMergeIfReady() {
    if (mergePick.length !== 2) return
    setUnits((us) => {
      const [aId, bId] = mergePick
      const a = us.find((x) => x.id === aId)
      const b = us.find((x) => x.id === bId)
      if (!a || !b || a.type !== b.type) return us
      const merged = mergeUnits(a, b)
      const filtered = us.filter((x) => x.id !== aId && x.id !== bId)
      setMergePick([])
      return [merged, ...filtered]
    })
  }

  return {
    // state
    day, wallet, inv, buildings, units, mergePick, log,
    barracks, barracksLevel, recruits, hasStable, batches,
  
    // helpers
    fmtCopper,
    BuildingCostCopper, BuildingOutputChoices, FocusOptions,
    WeaponTypes, ArmorTypes, HorseTypes,
    computeReady, batchDurationDays, batchSlots,
  
    // actions
    loadSave, resetAll, runDailyTick,
    buy, sell, buyBuilding, setBuildingFocus, setBuildingOutput,
    addTestUnit, doSplit, togglePickForMerge, doMergeIfReady, toggleTraining,
    recruit, trainTo, convertCav, createUnitFromBarracks, upgradeBarracks,
    queueLightTraining, queueHeavyConversion, queueLightCavConversion, queueHorseArcherConversion,
    barracksUpgradeCost,
  }
  
}

export type GameStateShape = ReturnType<typeof useGameState>
