// src/App.tsx
import React, { useState } from 'react'
import Card from './components/common/Card'
import InvSummary from './components/common/InvSummary'
import MarketPanel from './components/common/MarketPanel'
import MissingEquipment from './components/units/MissingEquipment'
import SplitMergeControls from './components/units/SplitMergeControls'
import BuildingsTab from './components/tabs/BuildingsTab'
import MarketTab from './components/tabs/MarketTab'
import OverviewTab from './components/tabs/OverviewTab'
import UnitsTab from './components/tabs/UnitsTab'
import LogTab from './components/tabs/LogTab'

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

      {tab === 'overview' && <OverviewTab state={state} />}

      {tab === 'buildings' && <BuildingsTab state={state} />}

      {tab === 'barracks' && <BarracksTab state={state} />}

      {tab === 'units' && <UnitsTab state={state} />}

      {tab === 'market' && <MarketTab state={state} />}

      {tab === 'log' && <LogTab state={state} />}
      
    </div>
  )
}
