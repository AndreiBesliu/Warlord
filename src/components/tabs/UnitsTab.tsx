import React from 'react'
import Card from '../common/Card'
import MissingEquipment from '../units/MissingEquipment'
import SplitMergeControls from '../units/SplitMergeControls'
import type { GameStateShape } from '../../state/useGameState'
import CreateUnitForm from '../barracks/CreateUnitForm'
import { Ranks, SoldierTypes, type Unit } from '../../logic/types'
import ReplenishForm from '../units/ReplenishForm'

export default function UnitsTab({ state }: { state: GameStateShape }) {
  const {
    units = [],
    mergePick = [],
    computeReady,
    doSplit,
    togglePickForMerge,
    doMergeIfReady,
    toggleTraining,
  } = state as any

  const safeComputeReady = (computeReady ?? ((_u: Unit) => 0)) as (u: Unit)=>number
  const safeDoSplit = (doSplit ?? (()=>{})) as (id: string, n: number)=>void
  const safeTogglePick = (togglePickForMerge ?? (()=>{})) as (id: string)=>void
  const safeDoMerge = (doMergeIfReady ?? (()=>{})) as ()=>void
  const safeToggleTraining = (toggleTraining ?? (()=>{})) as (id: string)=>void

  return (
    <Card title="Units">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span>Merge picks:</span>
        <span className="px-2 py-0.5 bg-gray-100 rounded">
          {Array.isArray(mergePick) && mergePick.length ? mergePick.join(' , ') : 'none'}
        </span>
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          disabled={!Array.isArray(mergePick) || mergePick.length !== 2}
          onClick={safeDoMerge}
        >
          Merge selected
        </button>
      </div>

      {(!Array.isArray(units) || units.length === 0) && (
        <div className="text-sm text-gray-500">No units yet.</div>
      )}

      <div className="space-y-3">
        {Array.isArray(units) && units.map((u: Unit) => {
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
                Ready: <span className="font-semibold">{safeComputeReady(u)}</span> / {size}
              </div>

              <MissingEquipment unit={u} />

              <div className="mt-2 flex items-center gap-2">
                <label className="text-sm">Training</label>
                <input
                  type="checkbox"
                  checked={!!u.training}
                  onChange={() => safeToggleTraining(u.id)}
                />
              </div>

              <SplitMergeControls
                size={size}
                onSplit={(n) => safeDoSplit(u.id, n)}
                selectedForMerge={Array.isArray(mergePick) && mergePick.includes(u.id)}
                onToggleMergeSelect={() => safeTogglePick(u.id)}
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}