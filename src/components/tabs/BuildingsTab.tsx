import React from 'react'
import Card from '../common/Card'
import { type Building } from '../../logic/types'
import type { GameStateShape } from '../../state/useGameState'
import GameIcon from '../common/GameIcon'
import { getIconForGameItem } from '../../logic/iconHelpers'
import MoneyDisplay from '../common/MoneyDisplay'
type Props = { state: GameStateShape }

export default function BuildingsTab({ state }: Props) {
  const {
    buildings,
    fmtCopper,
    BuildingCostCopper,
    BuildingOutputChoices,
    FocusOptions,          // note: if this is readonly, it's fine
    buyBuilding,
    setBuildingFocus,
    setBuildingOutput,
  } = state

  const buildingsArr = buildings ?? []
  const owns = (t: Building['type']) => buildingsArr.some(b => b.type === t)

  return (
    <Card title="Manage Buildings">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Owned */}
        <div>
          <h3 className="font-semibold mb-2">Owned</h3>
          <div className="space-y-2">
            {buildingsArr.length === 0 && (
              <div className="text-sm text-gray-500">No buildings yet.</div>
            )}
            {buildingsArr.map((b) => (
              <div key={b.id} className="border rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{b.type}</span>
                  <span className="ml-auto text-xs text-gray-500">id: {b.id}</span>
                </div>

                {/* Output chooser (skip for STABLE, MARKET, BARRACKS) */}
                {(BuildingOutputChoices[b.type]?.options?.length ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm">Output</label>
                    {b.outputItem && <GameIcon name={getIconForGameItem(b.outputItem)} size={20} />}
                    <select
                      className="border rounded px-2 py-1"
                      value={b.outputItem}
                      onChange={(e) => setBuildingOutput(b.id, e.target.value)}
                    >
                      {BuildingOutputChoices[b.type].options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Focus chooser (skip for STABLE, MARKET, BARRACKS) */}
                {!['STABLE', 'MARKET', 'BARRACKS'].includes(b.type) && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm">Focus Coin</label>
                    <select
                      className="border rounded px-2 py-1"
                      value={b.focusCoinPct}
                      onChange={(e) => setBuildingFocus(b.id, parseInt(e.target.value))}
                    >
                      {FocusOptions.map((f) => (
                        <option key={f} value={f}>
                          {f}%
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Buy New */}
        <div>
          <h3 className="font-semibold mb-2">Buy New</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['BLACKSMITH', 'ARMORY', 'WOODWORKER', 'TAILOR', 'STABLE'] as const).map((t) => (
              <button
                key={t}
                onClick={() => buyBuilding(t)}
                className="border rounded p-2 text-left hover:bg-gray-50 disabled:opacity-50"
                disabled={owns(t)}
              >
                <div className="font-semibold">{t}</div>
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  Cost: <MoneyDisplay amount={BuildingCostCopper[t]} size={12} />
                </div>
                {owns(t) && (
                  <div className="text-[11px] text-green-700 mt-1">Owned</div>
                )}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Passive coin/day = 10% of cost. Foregone coin converts to items at 70% of their market value.
          </div>
        </div>
      </div>
    </Card>
  )
}
