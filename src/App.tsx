// src/App.tsx
import React, { useState } from 'react'
import Card from './components/common/Card'
import InvSummary from './components/common/InvSummary'
import MarketPanel from './components/common/MarketPanel'
import MissingEquipment from './components/units/MissingEquipment'
import SplitMergeControls from './components/units/SplitMergeControls'
import BuildingsTab from './components/tabs/BuildingsTab'
import MarketTab from './components/tabs/MarketTab'

import BarracksTab from './components/tabs/BarracksTab'
import { useGameState } from './state/useGameState'
import { WeaponPriceCopper, ArmorPriceCopper, HorsePriceCopper } from './logic/items'

import { fmtCopper as fmtCopperUtil } from './logic/types'

export default function App() {
  const state = useGameState()
  const {
    // state
    wallet, inv, buildings, units, mergePick, log,
    // helpers
    fmtCopper: fmtFromState,
    BuildingCostCopper, BuildingOutputChoices, FocusOptions,
    WeaponTypes, ArmorTypes, HorseTypes,
    computeReady,
    // actions
    loadSave, resetAll, runDailyTick,
    buy, sell, buyBuilding, setBuildingFocus, setBuildingOutput,
    addTestUnit, doSplit, togglePickForMerge, doMergeIfReady, toggleTraining,
  } = state
  
  const fmtCopper = fmtFromState || fmtCopperUtil
  const buildingsArr = buildings ?? []                   // <- safe fallback
  const owns = (t: string) => buildingsArr.some(b => b.type === t)

  const [tab, setTab] = useState<'overview'|'buildings'|'barracks'|'units'|'market'|'log'>('overview')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex gap-2 items-center">
        <h1 className="text-3xl font-bold">Warlord</h1>
        <div className="ml-auto flex gap-2">
          <button className="px-3 py-2 border rounded" onClick={loadSave}>Load</button>
          <button className="px-3 py-2 border rounded" onClick={resetAll}>Reset</button>
          <button className="px-3 py-2 bg-black text-white rounded" onClick={runDailyTick}>Run Day ▶</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-lg">Wallet:</span>
        <span className="px-2 py-1 bg-gray-100 rounded font-mono">{fmtCopper(wallet)}</span>
      </div>

      <nav className="flex flex-wrap gap-2">
        {[
          ['overview','Overview'],
          ['buildings','Buildings'],
          ['barracks','Barracks'],
          ['units','Units'],
          ['market','Market'],
          ['log','Log']
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-3 py-1 rounded border ${tab === k ? 'bg-black text-white' : 'bg-white'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Buildings">
            <ul className="text-sm list-disc ml-4">
              {buildingsArr.map((b) => (
                <li key={b.id}>
                  {b.type} — focus {b.focusCoinPct}%{b.outputItem ? ` → ${b.outputItem}` : ''}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Inventories"><InvSummary inv={inv} /></Card>
          <Card title="Quick Actions">
            <button className="px-3 py-2 border rounded" onClick={addTestUnit}>+ Add test unit</button>
          </Card>
        </div>
      )}

      {tab === 'buildings' && <BuildingsTab state={state} />}

      {tab === 'barracks' && <BarracksTab state={state} />}

      {tab === 'units' && (
        <Card title="Units">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span>Merge picks:</span>
            <span className="px-2 py-0.5 bg-gray-100 rounded">{mergePick.join(' , ') || 'none'}</span>
            <button className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={mergePick.length !== 2} onClick={state.doMergeIfReady}>
              Merge selected
            </button>
          </div>

          {units.length === 0 && (<div className="text-sm text-gray-500">No units yet. Add a test unit from Overview.</div>)}

          <div className="space-y-3">
            {units.map((u) => {
              const size = u.buckets.reduce((a, b) => a + b.count, 0)
              return (
                <div key={u.id} className="border rounded p-3 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{u.id}</div>
                    <div className="text-sm">{u.type}</div>
                    <div className="ml-auto text-sm">avgXP {u.avgXP}</div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 mt-2 text-sm">
                    {u.buckets.map((b) => (
                      <div key={b.r} className="p-2 bg-gray-50 rounded">
                        <div className="text-xs text-gray-500">{b.r}</div>
                        <div className="font-mono">{b.count}</div>
                        <div className="text-[10px] text-gray-400">avgXP {b.avgXP}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-sm">
                    Ready: <span className="font-semibold">{computeReady(u)}</span> / {size}
                  </div>

                  <MissingEquipment unit={u} />

                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm">Training</label>
                    <input type="checkbox" checked={u.training} onChange={()=>toggleTraining(u.id)} />
                  </div>

                  <SplitMergeControls
                    size={size}
                    onSplit={(n) => doSplit(u.id, n)}
                    selectedForMerge={mergePick.includes(u.id)}
                    onToggleMergeSelect={() => togglePickForMerge(u.id)}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === 'market' && <MarketTab state={state} />}


      {tab === 'log' && (
        <Card title="Activity Log">
          <div className="space-y-1 text-sm">
            {log.map((l, i) => (<div key={i} className="border-b py-1">{l}</div>))}
          </div>
        </Card>
      )}
    </div>
  )
}
