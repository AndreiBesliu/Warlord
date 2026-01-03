import React, { useState } from 'react'
import Card from '../common/Card'
import RecruitForm from '../barracks/RecruitForm'
import MoneyDisplay from '../common/MoneyDisplay'
import { type SoldierType, } from '../../logic/types'
import type { GameStateShape } from '../../state/useGameState'
import { Registry } from '../../logic/registry'

export default function BarracksTab({ state }: { state: GameStateShape }) {
  const {
    recruits, barracks, barracksLevel, barracksUpgradeCost, upgradeBarracks, fmtCopper,
    recruit, queueLightTraining, queueHeavyConversion, queueLightCavConversion, queueHorseArcherConversion,
    batches, batchSlots, batchDurationDays
  } = state

  const [lightType, setLightType] = useState<SoldierType>('LIGHT_INF_SPEAR')
  const [lightQty, setLightQty] = useState(20)
  const [heavySrc, setHeavySrc] = useState<SoldierType>('LIGHT_CAV')
  const [heavyQty, setHeavyQty] = useState(10)
  const [lcSrc, setLcSrc] = useState<SoldierType>('LIGHT_INF_SPEAR')
  const [lcQty, setLcQty] = useState(10)
  const [haQty, setHaQty] = useState(10)

  const hasCostFn = typeof barracksUpgradeCost === 'function'
  const nextCost = hasCostFn ? barracksUpgradeCost(barracksLevel) : 0

  return (
    <Card title="Barracks">
      <div className="text-sm mb-2">
        Slots: {batches.length}/{batchSlots(barracksLevel)} • Batch duration: {batchDurationDays(barracksLevel)} days
      </div>
      <div className="grid md:grid-cols-1 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-sm">Level: {barracksLevel}</div>
            <button
              className="px-3 py-1 border rounded disabled:opacity-50 flex items-center gap-1"
              disabled={barracksLevel >= 5 || !hasCostFn}
              onClick={upgradeBarracks}
            >
              Upgrade
              {barracksLevel < 5 && hasCostFn && <span className="text-gray-600 text-xs ml-1">(<MoneyDisplay amount={nextCost} size={12} className="inline-flex" />)</span>}
              {barracksLevel >= 5 && <span className="text-gray-600 text-xs ml-1">(Max)</span>}
            </button>

          </div>

          <h3 className="font-semibold">Recruit</h3>
          <RecruitForm onRecruit={(qty) => recruit(qty)} />

          <div className="border rounded p-2">
            <div className="font-semibold mb-2">Queue LIGHT Training (recruits → light)</div>
            <div className="text-sm mb-2">Untyped recruits: <span className="font-mono">{recruits.count}</span></div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm">Target</label>
                <select className="border rounded px-2 py-1" value={lightType} onChange={e => setLightType(e.target.value as SoldierType)}>
                  {Registry.getAllUnits()
                    // Filter for "Light" units (could require a new property in UnitDef to classify broadly, 
                    // or just show all non-heavy/non-cav? For now, we replicate strings or show all NOVICE compatible?)
                    // The 'LIGHT_TRAIN' batch implies Novice rank. 
                    // Let's filter by name or some helper? 
                    // Actually, let's just show ALL units for extensibility, or filter for those with NOVICE support logic.
                    // For now, I'll filter logic-side: "light infantry or light archer"
                    // But 'isLightInf' relies on constants.
                    // Let's just list ALL units for now, or maybe only those that don't need horses?
                    // To be safe and extensible, let's list ALL. The user can try to train them.
                    .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm">Qty (≤50)</label>
                <input className="border rounded px-2 py-1 w-24" type="number" min={1} max={50}
                  value={lightQty} onChange={e => setLightQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
              </div>
              <button className="px-3 py-1 border rounded" onClick={() => queueLightTraining(lightType, lightQty)}>
                Queue
              </button>
            </div>
          </div>

        </div>

        <div className="grid md:grid-cols-1 gap-4">

          <div className="border rounded p-2">
            <div className="font-semibold mb-2">Queue LIGHT CAV Conversion</div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm">From</label>
                <select className="border rounded px-2 py-1" value={lcSrc} onChange={e => setLcSrc(e.target.value as SoldierType)}>
                  {(['LIGHT_INF_SWORD', 'LIGHT_INF_SPEAR', 'LIGHT_INF_HALBERD'] as SoldierType[])
                    .map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm">Qty (≤50)</label>
                <input className="border rounded px-2 py-1 w-24" type="number" min={1} max={50}
                  value={lcQty} onChange={e => setLcQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
              </div>
              <button className="px-3 py-1 border rounded" onClick={() => queueLightCavConversion(lcSrc, lcQty)}>
                Queue
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">Consumes Light Horses now.</div>
          </div>

        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded p-2">
            <div className="font-semibold mb-2">Queue HEAVY CAV Conversion (ADV+)</div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm">From</label>
                <select className="border rounded px-2 py-1" value={heavySrc} onChange={e => setHeavySrc(e.target.value as SoldierType)}>
                  {(['LIGHT_CAV', 'HEAVY_INF_SWORD', 'HEAVY_INF_SPEAR', 'HEAVY_INF_HALBERD'] as SoldierType[])
                    .map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm">Qty (ADV+ ≤50)</label>
                <input className="border rounded px-2 py-1 w-24" type="number" min={1} max={50}
                  value={heavyQty} onChange={e => setHeavyQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
              </div>
              <button className="px-3 py-1 border rounded" onClick={() => queueHeavyConversion(heavySrc, heavyQty)}>
                Queue
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Converts <b>Advanced+</b> troops to <b>HEAVY_CAV</b>.
              Consumes <b>1 Heavy Horse</b> and <b>1 Horse Armor</b> per soldier.
              If source is <b>LIGHT_CAV</b>, also consumes <b>1 Heavy Armor</b> per soldier.
              Sources: <b>LIGHT_CAV</b> or <b>HEAVY_INF_*</b>.
            </div>

          </div>

          <div className="border rounded p-2">
            <div className="font-semibold mb-2">Queue HORSE ARCHER Conversion (ADV+)</div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm">Qty (ADV+ ≤50)</label>
                <input className="border rounded px-2 py-1 w-24" type="number" min={1} max={50}
                  value={haQty} onChange={e => setHaQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
              </div>
              <button className="px-3 py-1 border rounded" onClick={() => queueHorseArcherConversion(haQty)}>
                Queue
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">Consumes Light Horses now.</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <h3 className="font-semibold">Active Batches</h3>
          <div className="space-y-2">
            {state.batches.length === 0 && <div className="text-sm text-gray-500">None</div>}
            {state.batches.map((b: any) => (
              <div key={b.id} className="border rounded p-2 text-sm">
                <div className="font-mono">{b.id}</div>
                <div>Kind: {b.kind}</div>
                <div>Target: {b.target}{b.fromType ? ` (from ${b.fromType})` : ''}</div>
                <div>Qty: {b.qty}</div>
                <div>Days remaining: {b.daysRemaining}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Card>
  )
}
