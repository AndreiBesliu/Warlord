// src/logic/training.ts
import type { Rank, SoldierType } from './types'
import { enqueueBatch, canEnqueue } from './batches'

type Ctx = {
  econ: {
    hasStable: boolean
    inv: any
    wallet: number
    setInv: (fn: (prev: any) => any) => void
    setWallet: (fn: (w: number) => number) => void
  }
  barr: {
    barracksLevel: number
    batches: any[]
    setBatches: (fn: (prev: any[]) => any[]) => void
    recruits: { count: number; avgXP: number }
    setRecruits: (fn: (prev: { count: number; avgXP: number }) => { count: number; avgXP: number }) => void
    barracks: any
    setBarracks: (fn: (prev: any) => any) => void
  }
  addLog: (s: string) => void
}

// helpers
const ADV_PLUS: Rank[] = ['ADVANCED','VETERAN','ELITE']
const LIGHT_INF: SoldierType[] = ['LIGHT_INF_SWORD','LIGHT_INF_SPEAR','LIGHT_INF_HALBERD'] as any
const HEAVY_INF: SoldierType[] = ['HEAVY_INF_SWORD','HEAVY_INF_SPEAR','HEAVY_INF_HALBERD'] as any

function assertQty(qty: number) {
  const n = Math.max(1, Math.min(50, Math.floor(qty || 0)))
  return n
}

function requireSlot(ctx: Ctx) {
  if (!canEnqueue(ctx.barr.batches, ctx.barr.barracksLevel)) {
    ctx.addLog('Training queue full.')
    return false
  }
  return true
}

export interface EconSlice {
  inv: {
    weapons: Record<string, number>
    armors: Record<string, number>
    horses: Record<'LIGHT_HORSE'|'HEAVY_HORSE', { active: number; inactive: number }>
  }
  setInv: (updater: (prev: EconSlice['inv']) => EconSlice['inv']) => void
  wallet: number
  setWallet: (updater: (prev: number) => number) => void
}

export interface BarracksSlice {
  recruits: { count: number; avgXP: number }
  setRecruits: (updater: (prev: BarracksSlice['recruits']) => BarracksSlice['recruits']) => void
  barracks: any
  setBarracks: (updater: (prev: any) => any) => void
  batches: any[]
  setBatches: (updater: (prev: any[]) => any[]) => void
  barracksLevel: number
}

// recruits (untyped) -> light troop type
export function queueLightTraining(ctx: Ctx, target: SoldierType, qty: number) {
  const n = assertQty(qty)
  if (!requireSlot(ctx)) return
  if (!target.startsWith('LIGHT_')) {
    ctx.addLog('Only LIGHT_* training is allowed for recruits.')
    return
  }
  if (ctx.barr.recruits.count < n) {
    ctx.addLog('Not enough untyped recruits.')
    return
  }
  ctx.barr.setRecruits(prev => ({ ...prev, count: prev.count - n }))
  ctx.barr.setBatches(prev =>
    enqueueBatch(prev, { level: ctx.barr.barracksLevel, kind: 'LIGHT_TRAIN', target, qty: n })
  )
  ctx.addLog(`Queued LIGHT training: ${n} → ${target}.`)
}

// light inf -> light cav (consumes light horses immediately)
export function queueLightCavConversion(ctx: Ctx, fromType: SoldierType, qty: number) {
  const n = assertQty(qty)
  if (!requireSlot(ctx)) return
  if (!fromType.startsWith('LIGHT_INF')) {
    ctx.addLog('Light Cavalry converts from LIGHT_INF_* only.')
    return
  }
  // consume horses now if you want immediate reservation
  ctx.econ.setInv(prev => {
    const inv = structuredClone(prev)
    const have = inv.horses.LIGHT_HORSE?.active ?? 0
    if (have < n) { ctx.addLog('Not enough Light Horses.'); return prev }
    inv.horses.LIGHT_HORSE.active -= n
    return inv
  })
  ctx.barr.setBatches(prev =>
    enqueueBatch(prev, { level: ctx.barr.barracksLevel, kind: 'LIGHT_CAV', fromType, qty: n })
  )
  ctx.addLog(`Queued LIGHT_CAV conversion: ${n} from ${fromType}.`)
}

// heavy cav: from LIGHT_CAV (ADV+) or HEAVY_INF_* (ADV+)
// reserves heavy horse + horse armor immediately; if from LIGHT_CAV also heavy armor
export function queueHeavyConversion(ctx: Ctx, fromType: SoldierType, qty: number) {
  const n = assertQty(qty)
  if (!requireSlot(ctx)) return
  const fromLightCav = fromType === 'LIGHT_CAV'
  const fromHeavyInf = fromType.startsWith('HEAVY_INF')
  if (!fromLightCav && !fromHeavyInf) {
    ctx.addLog('Heavy Cavalry converts from LIGHT_CAV or HEAVY_INF_*.'); return
  }
  // reserve horses/armor up-front
  ctx.econ.setInv(prev => {
    const inv = structuredClone(prev)
    const hh = inv.horses.HEAVY_HORSE?.active ?? 0
    const ha = inv.armors.HORSE_ARMOR ?? 0
    if (hh < n || ha < n) { ctx.addLog('Need Heavy Horses and Horse Armor.'); return prev }
    if (fromLightCav) {
      const heavyArmor = inv.armors.HEAVY_ARMOR ?? 0
      if (heavyArmor < n) { ctx.addLog('Need Heavy Armor to convert LIGHT_CAV → HEAVY_CAV.'); return prev }
      inv.armors.HEAVY_ARMOR -= n
    }
    inv.horses.HEAVY_HORSE.active -= n
    inv.armors.HORSE_ARMOR -= n
    return inv
  })
  ctx.barr.setBatches(prev =>
    enqueueBatch(prev, { level: ctx.barr.barracksLevel, kind: 'HEAVY_CAV', fromType, qty: n })
  )
  ctx.addLog(`Queued HEAVY_CAV conversion: ${n} from ${fromType} (ADV+).`)
}

// horse archers: from LIGHT_ARCHER (ADV+) with light horses now
export function queueHorseArcherConversion(ctx: Ctx, qty: number) {
  const n = assertQty(qty)
  if (!requireSlot(ctx)) return
  ctx.econ.setInv(prev => {
    const inv = structuredClone(prev)
    const have = inv.horses.LIGHT_HORSE?.active ?? 0
    if (have < n) { ctx.addLog('Not enough Light Horses.'); return prev }
    inv.horses.LIGHT_HORSE.active -= n
    return inv
  })
  ctx.barr.setBatches(prev =>
    enqueueBatch(prev, { level: ctx.barr.barracksLevel, kind: 'HORSE_ARCHER', fromType: 'LIGHT_ARCHER', qty: n })
  )
  ctx.addLog(`Queued HORSE_ARCHER conversion: ${n} (ADV+ from LIGHT_ARCHER).`)
}