import React from 'react'
import Card from '../common/Card'
import MissingEquipment from '../units/MissingEquipment'
import SplitMergeControls from '../units/SplitMergeControls'
import type { GameStateShape } from '../../state/useGameState'

export default function UnitsTab({ state }: { state: GameStateShape }) {
  const {
    units, mergePick, computeReady,
    doSplit, togglePickForMerge, doMergeIfReady, toggleTraining
  } = state
  
  return (
    <Card title="Units">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span>Merge picks:</span>
        <span className="px-2 py-0.5 bg-gray-100 rounded">
          {mergePick.join(' , ') || 'none'}
        </span>
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          disabled={mergePick.length !== 2}
          onClick={doMergeIfReady}
        >
          Merge selected
        </button>
      </div>

      {(!units || units.length === 0) && (
        <div className="text-sm text-gray-500">No units yet. Add a test unit from Overview.</div>
      )}

      <div className="space-y-3">
        {units?.map((u: any) => {
          const size = u.buckets.reduce((a: number, b: any) => a + b.count, 0)
          return (
            <div key={u.id} className="border rounded p-3 bg-white">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{u.id}</div>
                <div className="text-sm">{u.type}</div>
                <div className="ml-auto text-sm">avgXP {u.avgXP}</div>
              </div>

              <div className="grid grid-cols-5 gap-2 mt-2 text-sm">
                {u.buckets.map((b: any) => (
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
  )
}
