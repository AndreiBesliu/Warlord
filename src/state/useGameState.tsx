
import { useEffect, useMemo, useState } from 'react'

//logic
import { GOLD, fmtCopper, Ranks, type Rank, type SoldierType, type Building } from '../logic/types'
import type { RecruitPool, Unit } from '../logic/types'
import { BuildingOutputChoices, BuildingCostCopper, FocusOptions } from '../logic/economy'
import { makeEmptyInventories, isHorseKey, type HorseKey } from '../logic/helpers'
import { demandFor, ensureEquipOrBuy } from '../logic/equipment'
import { itemValueCopper } from '../logic/items'  // if you use buy/sell here
import { batchSlots, batchDurationDays, newBatchId, enqueueBatch } from '../logic/batches' // or from your batches helper
import { queueLightTraining as qLight, queueLightCavConversion as qLC, 
          queueHeavyConversion as qHC, queueHorseArcherConversion as qHA } from '../logic/training'
          
//state
import { useEconomy } from './useEconomy'
import { useUnits } from './useUnits'
import useBarracks, { emptyBarracks } from './useBarracks' 
import { computeReady, mergeUnits, splitUnit } from '../logic/units'

function defaultBuildings(): Building[] {
  return [
    { id: 'barracks', type: 'BARRACKS', focusCoinPct: 100, fractionalBuffer: 0 },
    { id: 'wood1',   type: 'WOODWORKER', focusCoinPct: 60, outputItem: 'BOW', fractionalBuffer: 0 },
    { id: 'market',  type: 'MARKET', focusCoinPct: 100, fractionalBuffer: 0 },
  ]
}

export function useGameState() {
  // day + log
  const [day, setDay] = useState(1)
  const [log, setLog] = useState<string[]>([])
  const addLog = (s:string)=> setLog(l => [`${new Date().toLocaleString()} — ${s}`, ...l])


  const [units, setUnits] = useState<Unit[]>([])
  const [mergePick, setMergePick] = useState<string[]>([])

  // slices
  const econ = useEconomy(10 * GOLD, defaultBuildings)
  const barr = useBarracks()
  const unit = useUnits()
  
  function hasFreeBatchSlot() {
    return barr.batches.length < batchSlots(barr.barracksLevel)
  }
 
  useEffect(()=>{
    localStorage.setItem('warlord_save', JSON.stringify({
      day, log,
      wallet: econ.wallet, inv: econ.inv, buildings: econ.buildings,
      barracks: barr.barracks, barracksLevel: barr.barracksLevel,
      recruits: barr.recruits, batches: barr.batches,
      units: unit.units,
    }))
  }, [day, log, econ.wallet, econ.inv, econ.buildings, barr.barracks, barr.barracksLevel, barr.recruits, barr.batches, unit.units])

  function loadSave(){
    const raw = localStorage.getItem('warlord_save')
    if (!raw) return addLog('No save found.')
    try {
      const s = JSON.parse(raw)
      setDay(s.day ?? 1); setLog(s.log ?? [])
      econ.setWallet(s.wallet ?? 5*GOLD)
      econ.setInv(s.inv ?? econ.inv)
      econ.setBuildings(s.buildings ?? econ.buildings)
      barr.setBarracks(s.barracks ?? barr.barracks)
      barr.setBarracksLevel(s.barracksLevel ?? 1)
      barr.setRecruits(s.recruits ?? {count:0,avgXP:0})
      barr.setBatches(s.batches ?? [])
      unit.setUnits(s.units ?? [])
      addLog('Loaded save.')
    } catch { addLog('Failed to load save.') }
  }

  function resetAll() {
    setDay(1); setLog([])
    econ.setWallet(10 * GOLD)
    econ.setInv(makeEmptyInventories())
    econ.setBuildings(defaultBuildings())
    barr.setBarracks(emptyBarracks())
    barr.setBarracksLevel(1)
    barr.setRecruits({ count: 0, avgXP: 0 })
    barr.setBatches([])
    unit.setUnits([])
  }
 
  // type HorseKey = 'LIGHT_HORSE' | 'HEAVY_HORSE'
  // const isHorseKey = (x: string): x is HorseKey => x === 'LIGHT_HORSE' || x === 'HEAVY_HORSE'

  function buy(kind: 'WEAPON'|'ARMOR'|'HORSE', subtype: string, qty: number) {
    if (qty <= 0 || !Number.isFinite(qty)) return
    if (kind === 'HORSE') {
      if (!econ.hasStable) { addLog('You need a STABLE to buy horses.'); return }
      if (!isHorseKey(subtype)) { addLog('Invalid horse type.'); return }
    }

    const price = itemValueCopper(subtype) * qty
    if (econ.wallet < price) { addLog('Not enough funds.'); return }

    econ.setWallet(w => w - price)
    econ.setInv(prev => {
      const n = structuredClone(prev)
      if (kind === 'WEAPON') n.weapons[subtype] = (n.weapons[subtype] ?? 0) + qty
      else if (kind === 'ARMOR') n.armors[subtype] = (n.armors[subtype] ?? 0) + qty
      else n.horses[subtype as HorseKey].active += qty
      return n
    })
    addLog(`Bought ${qty} ${subtype} for ${fmtCopper(price)}.`)
  }
    
  function sell(kind: 'WEAPON'|'ARMOR'|'HORSE', subtype: string, qty: number) {
    if (qty <= 0 || !Number.isFinite(qty)) return
    econ.setInv(prev => {
      const n = structuredClone(prev)
      let have = 0
      if (kind === 'WEAPON') have = n.weapons[subtype] ?? 0
      else if (kind === 'ARMOR') have = n.armors[subtype] ?? 0
      else {
        if (!isHorseKey(subtype)) { addLog('Invalid horse type.'); return prev }
        have = n.horses[subtype].active
      }
      if (have < qty) { addLog('Not enough items to sell.'); return prev }

      const price = itemValueCopper(subtype) * qty
      if (kind === 'WEAPON') n.weapons[subtype] -= qty
      else if (kind === 'ARMOR') n.armors[subtype] -= qty
      else n.horses[subtype as HorseKey].active -= qty
      econ.setWallet(w => w + price)
      addLog(`Sold ${qty} ${subtype} for ${fmtCopper(price)}.`)
      return n
    })
  }
  
  function buyBuilding(type: Building['type']) {
    if (econ.buildings.some(b => b.type === type)) { addLog(`You already own a ${type}.`); return }
    const cost = BuildingCostCopper[type] || 0
    if (econ.wallet < cost) { addLog(`Not enough funds to buy ${type}. Need ${fmtCopper(cost)}.`); return }
    const id = `${type.toLowerCase()}_${Math.random().toString(36).slice(2,8)}`
    const outputItem = BuildingOutputChoices[type].options[0]
    econ.setWallet(w => w - cost)
    econ.setBuildings(bs => [...bs, { id, type, focusCoinPct: 100, outputItem, fractionalBuffer: 0 }])
    addLog(`Bought ${type} for ${fmtCopper(cost)}.`)
  }
  
  function setBuildingFocus(id: string, pct: number) {
    econ.setBuildings(bs => bs.map(b => b.id === id ? { ...b, focusCoinPct: pct as any } : b))
  }
  
  function setBuildingOutput(id: string, item: string) {
    econ.setBuildings(bs => bs.map(b => b.id === id ? { ...b, outputItem: item } : b))
  }
  
  function upgradeBarracks() {
    if (barr.barracksLevel >= 5) return
    const cost = barr.barracksUpgradeCost(barr.barracksLevel)
    if (!Number.isFinite(cost)) return
    if (econ.wallet < cost) {
      addLog(`Not enough funds to upgrade. Need ${fmtCopper(cost)}.`)
      return
    }
    econ.setWallet(w => w - cost)
    barr.setBarracksLevel(prev => {
      const next = Math.min(prev + 1, 5)
      addLog(`Upgraded Barracks to L${next}.`)
      return next
    })
  }
  
  
  function toggleTraining(unitId: string) {
    setUnits(us => {
      const used = us.filter(u => u.training).length
      const slots = barr.barracksLevel // or wherever your barracks level lives
      return us.map(u => {
        if (u.id !== unitId) return u
        if (!u.training) {
          if (used >= slots) { addLog(`Training queue full: ${used}/${slots}.`); return u }
          return { ...u, training: true }
        }
        return { ...u, training: false }
      })

    })

  }

  function doSplit(unitId: string, count: number) {
    setUnits(us => {
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
    setUnits(us => {
      if (mergePick.length !== 2) return us
      const [aId, bId] = mergePick
      const a = us.find(x => x.id === aId)
      const b = us.find(x => x.id === bId)
      if (!a || !b || a.type !== b.type) return us
      const merged = mergeUnits(a, b)
      const filtered = us.filter(x => x.id !== aId && x.id !== bId)
      setMergePick([])
      return [merged, ...filtered]
    })
  }

  function queueLightTraining(target: SoldierType, qty: number) {
    qLight({ econ, barr, addLog }, target, qty)
  }
  function queueLightCavConversion(fromType: SoldierType, qty: number) {
    qLC({ econ, barr, addLog }, fromType, qty)
  }
  function queueHeavyConversion(fromType: SoldierType, qty: number) {
    qHC({ econ, barr, addLog }, fromType, qty)
  }
  function queueHorseArcherConversion(qty: number) {
    qHA({ econ, barr, addLog }, qty)
  }
  
  function runDailyTick(){
    const notes:string[] = []
    const delta = econ.applyBuildingIncome(s => notes.push(s))
    const nextDay = day + 1
    setDay(nextDay)
    addLog(`Day ${nextDay} — ${notes.join(' | ')} | Wallet Δ ${fmtCopper(delta)}`)
    // Add: training batch progress here if you want (uses barr.batches etc)
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
    const totalCount = buckets.reduce((a,b)=>a+b.count,0)
    const wx = buckets.reduce((a,b)=>a+b.count*b.avgXP,0)
    const avgXP = totalCount ? Math.floor(wx / totalCount) : 0
  
    const unitObj: Unit = {
      id: `U_${Math.random().toString(36).slice(2,7)}`,
      type,
      buckets,
      avgXP,
      training: false,
      equip: { weapons:{}, armors:{}, horses:{} },
      loadout: { kind: type } as any
    }
    unit.setUnits(us => [unitObj, ...us])
  
    addLog(`Equipped & created ${total} ${type} ${res.spent>0 ? `(auto-bought ${fmtCopper(res.spent)})` : '(used stock)'}. AvgXP ${avgXP}.`)
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
  
    // 4) add to unit with +10% avgXP bonus
    const xpBonus = Math.floor(u.avgXP * 0.10)
    const newBuckets: Unit['buckets'] = u.buckets.map(b => ({ ...b }))
    for (const r of Ranks) {
      const qty = plan[r] || 0
      if (!qty) continue
      const incomingAvgXP = (barr.barracks[type][r].avgXP || 0) + xpBonus // use pre-change avg
      const i = newBuckets.findIndex(b => b.r === r)
      if (i >= 0) {
        const prev = newBuckets[i]
        const newCount = prev.count + qty
        const newWx = prev.count * prev.avgXP + qty * incomingAvgXP
        newBuckets[i] = { r, count: newCount, avgXP: Math.floor(newWx / newCount) }
      } else {
        newBuckets.push({ r, count: qty, avgXP: incomingAvgXP })
      }
    }
  
    const totalCount = newBuckets.reduce((a,b)=>a+b.count,0)
    const wx = newBuckets.reduce((a,b)=>a+b.count*b.avgXP,0)
    const newAvgXP = totalCount ? Math.floor(wx / totalCount) : 0
  
    unit.setUnits(us => us.map(x => x.id === unitId ? { ...x, buckets: newBuckets, avgXP: newAvgXP } : x))
  
    addLog(`Replenished ${total} → ${u.id} (${type}) ${res.spent>0 ? `(auto-bought ${fmtCopper(res.spent)})` : '(used stock)'}. +XP bonus ${xpBonus}. New size ${totalCount}, avgXP ${newAvgXP}.`)
  }

  // const [recruits, setRecruits] = useState<RecruitPool>({ count: 0, avgXP: 0 })

  function recruit(qty: number) {
    const n = Math.max(1, Math.floor(qty || 0))
    barr.recruit(n)
    addLog(`Recruited ${n} untyped recruits.`)
  }

  
  // Re-export everything your tabs need (keep names the same as today)
  return {
    // core
    day, log, addLog, runDailyTick, loadSave, resetAll, fmtCopper,
  
    // economy
    wallet: econ.wallet, inv: econ.inv, buildings: econ.buildings, hasStable: econ.hasStable,
    setWallet: econ.setWallet, setInv: econ.setInv, setBuildings: econ.setBuildings,
    BuildingCostCopper, BuildingOutputChoices, FocusOptions,
    buy, sell, buyBuilding, setBuildingFocus, setBuildingOutput,

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
    upgradeBarracks: () => {
      if (barr.barracksLevel >= 5) return
      const cost = barr.barracksUpgradeCost(barr.barracksLevel)
      if (econ.wallet < cost) { addLog(`Not enough funds: need ${fmtCopper(cost)}.`); return }
      econ.setWallet(w => w - cost)
      barr.setBarracksLevel(l => l + 1)
      addLog(`Upgraded Barracks to L${barr.barracksLevel + 1}.`)
    },
  
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
    createUnitFromBarracks,   // <-- add this
    replenishUnit,            // <-- and this
  }
  
  
}

export type GameStateShape = ReturnType<typeof useGameState>
