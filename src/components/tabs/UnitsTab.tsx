import React from 'react'
import Card from '../common/Card'
import MissingEquipment from '../units/MissingEquipment'
import SplitMergeControls from '../units/SplitMergeControls'
import type { GameStateShape } from '../../state/useGameState'
import CreateUnitForm from '../barracks/CreateUnitForm'
import { Ranks, SoldierTypes } from '../../logic/types'
import ReplenishForm from '../units/ReplenishForm'

export default function UnitsTab({ state }: { state: GameStateShape }) {
  const {
    units, mergePick, computeReady,
    doSplit, togglePickForMerge, doMergeIfReady, toggleTraining,
    barracks, inv, createUnitFromBarracks, replenishUnit
  } = state

  function availableTypesFromPools(pools: any) {
    // returns array like [{ type:'LIGHT_INF_SPEAR', ranks:[{r:'NOVICE',count,avgXP}, ...]}]
    return (SoldierTypes as string[])
      .map(t => {
        const rows = Ranks
          .map(r => ({ r, ...pools?.[t]?.[r] }))
          .filter(x => (x?.count ?? 0) > 0)
        return rows.length ? { type: t, ranks: rows } : null
      })
      .filter(Boolean) as { type:string; ranks:{r:string; count:number; avgXP:number}[] }[]
  }
 
  return (
    
    <Card title="Units">
       <div className="border rounded p-3 bg-white">
          <div className="space-y-3">
            <h3 className="font-semibold">Available Pools</h3>
            {availableTypesFromPools(barracks).length === 0 && (
              <div className="text-sm text-gray-500">No trained soldiers available. Train batches in Barracks.</div>
            )}
            {availableTypesFromPools(barracks).map(row => (
              <div key={row.type} className="border rounded p-2">
                <div className="font-semibold mb-1">{row.type}</div>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  {row.ranks.map(r => (
                    <div key={r.r} className="flex flex-col">
                      <span className="text-xs text-gray-500">{r.r}</span>
                      <span className="font-mono">{r.count}</span>
                      <span className="text-[10px] text-gray-400">avgXP {r.avgXP}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Create Unit from Pools</h3>
            <CreateUnitForm
              barracks={barracks}
              inv={inv}
              onCreate={(type, plan, opts) => createUnitFromBarracks(type, plan, opts)}
            />
            <div className="text-xs text-gray-500">
              Tip: Enable <b>Auto-buy</b> to automatically purchase missing gear at market value.
            </div>
          </div>
        </div>

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

              <div className="mt-2">
                <ReplenishForm
                  unitId={u.id}
                  unitType={u.type}
                  pool={barracks}
                  inv={inv}
                  onReplenish={(plan, opts) => replenishUnit(u.id, plan, opts)}
                />
              </div>

            </div>
          )
        })}
      </div>
    </Card>
    
  )
}
