import React, { useState } from 'react'
import Card from '../common/Card'
import { type Building, type BuildingType } from '../../logic/types'
import type { GameStateShape } from '../../state/useGameState'
import GameIcon from '../common/GameIcon'
import { getIconForGameItem } from '../../logic/iconHelpers'
import MoneyDisplay from '../common/MoneyDisplay'
import parchmentBg from '../../assets/parchment_bg.png'
import { itemValueCopper } from '../../logic/items'
import ProductionModal from '../buildings/ProductionModal'

import bBarracks from '../../assets/building_barracks.png'
import bWoodworker from '../../assets/building_woodworker.png'
import bMarket from '../../assets/building_market.png'
import bBlacksmith from '../../assets/building_blacksmith.png'
import bArmory from '../../assets/building_armory.png'
import bTailor from '../../assets/building_tailor.png'
import bStable from '../../assets/building_stable.png'

type Props = {
  state: GameStateShape
  setTab: (tab: 'overview' | 'buildings' | 'barracks' | 'units' | 'market' | 'log') => void
}

export const BuildingImages: Record<string, string> = {
  'BARRACKS': bBarracks,
  'WOODWORKER': bWoodworker,
  'MARKET': bMarket,
  'BLACKSMITH': bBlacksmith,
  'ARMORY': bArmory,
  'TAILOR': bTailor,
  'STABLE': bStable,
}

export function BuildingIcon({ type, size = 24 }: { type: string, size?: number }) {
  const imgSrc = BuildingImages[type]
  return (
    <div
      className="inline-block shrink-0 relative overflow-hidden rounded shadow-sm border border-amber-900/40 bg-white"
      style={{ width: size, height: size }}
    >
      {imgSrc && <img src={imgSrc} className="w-full h-full object-cover mix-blend-multiply" alt={type} />}
    </div>
  )
}

function BuildingImg({ type }: { type: string }) {
  const imgSrc = BuildingImages[type]
  return (
    <div className="w-full aspect-[4/3] relative overflow-hidden rounded border border-yellow-900/30 shadow-inner bg-[#fffbf0]">
      {imgSrc && (
        <img
          src={imgSrc}
          className="w-full h-full object-cover mix-blend-multiply opacity-90 hover:scale-105 transition-transform duration-700"
          alt={type}
        />
      )}
    </div>
  )
}

export default function BuildingsTab({ state, setTab }: Props) {
  const {
    buildings,
    fmtCopper,
    BuildingCostCopper,
    BuildingOutputChoices,
    FocusOptions,
    buyBuilding,
    setBuildingFocus,
    setBuildingOutput,
    barracksLevel,
    upgradeBarracks,
    barracksUpgradeCost,
  } = state

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null)

  const buildingsArr = buildings ?? []
  const owns = (t: Building['type']) => buildingsArr.some(b => b.type === t)
  const constructionList = (['BLACKSMITH', 'ARMORY', 'WOODWORKER', 'TAILOR', 'STABLE', 'MARKET'] as const)
    .filter(t => !owns(t))

  const handleBuildingClick = (b: Building) => {
    if (b.type === 'BARRACKS') {
      setTab('barracks')
    } else if (['MARKET', 'STABLE'].includes(b.type)) {
      // Market & Stable navigate to Market tab
      setTab('market')
    } else {
      // Production buildings -> Open Modal
      setSelectedBuildingId(b.id)
    }
  }

  const selectedBuilding = selectedBuildingId ? buildingsArr.find(b => b.id === selectedBuildingId) : null

  return (
    <>
      {selectedBuilding && (
        <ProductionModal
          building={selectedBuilding}
          onClose={() => setSelectedBuildingId(null)}
          onSetOutput={(item) => setBuildingOutput(selectedBuilding.id, item)}
          onSetFocus={(pct) => setBuildingFocus(selectedBuilding.id, pct)}
        />
      )}

      <Card title="Town Construction" className="relative p-0 overflow-hidden bg-stone-800">
        {/* Parchment Background */}
        <div
          className="absolute inset-0 opacity-100 z-0 pointer-events-none"
          style={{ backgroundImage: `url(${parchmentBg})`, backgroundSize: 'cover' }}
        />

        <div className="relative z-10 p-6 space-y-8">

          {/* Main Buildings Grid */}
          <div>
            <h3 className="font-serif text-2xl text-amber-900 mb-4 border-b border-amber-900/30 pb-2">Established Buildings</h3>
            {buildingsArr.length === 0 && <div className="text-amber-800/60 italic">Your town is empty. Build infrastructure below.</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {buildingsArr.map((b) => (
                <div
                  key={b.id}
                  className="bg-amber-50/80 p-3 rounded-lg shadow-md border border-amber-900/20 flex flex-col gap-3 relative group hover:-translate-y-1 transition-transform duration-300 cursor-pointer"
                  onClick={() => handleBuildingClick(b)}
                >
                  <div className="flex justify-between items-center border-b border-amber-900/10 pb-2">
                    <span className="font-bold text-amber-900">{b.type}</span>
                    {b.type === 'BARRACKS' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-amber-200/50 px-1 rounded text-amber-800 font-mono">LVL {barracksLevel}</span>
                        {barracksLevel < 5 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              upgradeBarracks()
                            }}
                            className="text-[10px] bg-red-800 text-white px-2 py-0.5 rounded shadow hover:bg-red-700 active:translate-y-0.5"
                          >
                            UPGRADE (<MoneyDisplay amount={barracksUpgradeCost(barracksLevel)} size={10} className="inline-flex" />)
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] bg-amber-200/50 px-1 rounded text-amber-800 font-mono">LVL 1</span>
                    )}
                  </div>

                  <BuildingImg type={b.type} />

                  {/* Controls - stopPropagation to prevent navigation when clicking controls */}
                  <div
                    className="space-y-2 mt-auto pt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!['STABLE', 'MARKET', 'BARRACKS'].includes(b.type) && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-amber-800/70 px-1 bg-amber-100/30 rounded py-1 border border-amber-900/5">
                          {(() => {
                            const cost = BuildingCostCopper[b.type] || 0
                            const basePerDay = 0.10 * cost
                            const coinGain = Math.round(basePerDay * (b.focusCoinPct / 100))

                            const remainderValue = basePerDay - coinGain
                            const outItem = b.outputItem || BuildingOutputChoices[b.type]?.options[0] || ''
                            const mv = itemValueCopper(outItem) || 0
                            const items = (remainderValue > 0 && mv > 0)
                              ? (remainderValue / (0.7 * mv)).toFixed(1)
                              : '0'

                            return (
                              <div className="flex justify-between">
                                <span>Daily: <MoneyDisplay amount={coinGain} size={10} className="inline-flex" /></span>
                                {b.outputItem && (
                                  <span className="flex items-center gap-1 text-amber-900/80 font-mono">
                                    | +{items} <GameIcon name={getIconForGameItem(b.outputItem) || 'sword'} size={14} />
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                          <div className="text-[9px] text-center text-amber-900/40 mt-1 uppercase tracking-wider font-bold">Click to Manage</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Construction */}
          {constructionList.length > 0 && (
            <div>
              <h3 className="font-serif text-2xl text-amber-900 mb-4 border-b border-amber-900/30 pb-2">Purchase Construction Plans</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {constructionList.map((t) => (
                  <button
                    key={t}
                    onClick={() => buyBuilding(t)}
                    className="flex flex-col items-center p-3 rounded border-2 border-dashed border-amber-900/30 hover:border-amber-900 hover:bg-amber-100/50 transition-all opacity-80 hover:opacity-100"
                  >
                    <div className="w-32 h-32 opacity-80 mb-2">
                      <img
                        src={BuildingImages[t]}
                        className="w-full h-full object-contain mix-blend-multiply grayscale hover:grayscale-0 transition-all duration-300"
                        alt={t}
                      />
                    </div>
                    <span className="font-bold text-xs text-amber-900">{t}</span>
                    <div className="mt-1 text-xs px-2 py-0.5 bg-yellow-200 text-yellow-900 rounded-full font-bold shadow-sm">
                      <MoneyDisplay amount={BuildingCostCopper[t]} size={10} className="inline-flex" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-xs text-amber-800/50 pt-8 font-serif italic">
            "A prosperous town fuels a mighty army."
          </div>

        </div>
      </Card>
    </>
  )
}
