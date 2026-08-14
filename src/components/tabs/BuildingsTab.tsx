import { useState } from 'react'
import Card from '../common/Card'
import { fmtCopper, type Building } from '../../logic/types'
import type { GameStateShape } from '../../state/useGameState'
import { buildingUpgradeCostCopper, buildingLevelMult, BUILDING_MAX_LEVEL } from '../../logic/economy'
import { formatGameTooltip } from '../../logic/iconHelpers'
import CostList from '../common/CostList'
import { evaluateCost } from '../../logic/costs'
import parchmentBg from '../../assets/parchment_bg.png'
import ProductionModal from '../buildings/ProductionModal'

import bBarracks from '../../assets/building_barracks.png'
import bWoodworker from '../../assets/building_woodworker.png'
import bMarket from '../../assets/building_market.png'
import bBlacksmith from '../../assets/building_blacksmith.png'
import bArmory from '../../assets/building_armory.png'
import bTailor from '../../assets/building_tailor.png'
import bStable from '../../assets/building_stable.png'

import bQuarry from '../../assets/building_quarry.png'
import bIronMine from '../../assets/building_iron_mine.png'
import bCoalMine from '../../assets/building_coal_mine.png'
import bCopperMine from '../../assets/building_copper_mine.png'
import bSilverMine from '../../assets/building_silver_mine.png'

type Props = {
  state: GameStateShape
  setTab: (tab: 'overview' | 'buildings' | 'barracks' | 'units' | 'market' | 'research' | 'log') => void
}

export const BuildingImages: Record<string, string> = {
  'BARRACKS': bBarracks,
  'WOODWORKER': bWoodworker,
  'MARKET': bMarket,
  'BLACKSMITH': bBlacksmith,
  'ARMORY': bArmory,
  'TAILOR': bTailor,
  'STABLE': bStable,

  // Resources
  'LUMBER_MILL': bWoodworker, // Fallback/reuse if lumber mill specific doesn't exist yet as building icon (different from interior)
  'QUARRY': bQuarry,
  'IRON_MINE': bIronMine,
  'COAL_MINE': bCoalMine,
  'COPPER_MINE': bCopperMine,
  'SILVER_MINE': bSilverMine,

  'SMELTER': bBlacksmith,
  'MINTER': bMarket,
}

export function BuildingIcon({ type, size = 24 }: { type: string, size?: number }) {
  const imgSrc = BuildingImages[type]
  return (
    <div
      className="wl-art inline-block shrink-0 relative overflow-hidden rounded shadow-sm border border-wl-accent-line"
      style={{ width: size, height: size }}
    >
      {imgSrc ? <img src={imgSrc} className="w-full h-full object-cover mix-blend-multiply" alt={type} /> : <div className="w-full h-full bg-wl-panel-muted"></div>}
    </div>
  )
}

function BuildingImg({ type }: { type: string }) {
  const imgSrc = BuildingImages[type]
  return (
    <div className="wl-art w-full aspect-[4/3] relative overflow-hidden rounded border border-wl-accent-line shadow-inner flex items-center justify-center">
      {imgSrc ? (
        <img
          src={imgSrc}
          className="w-full h-full object-cover mix-blend-multiply opacity-90 hover:scale-105 transition-transform duration-700"
          alt={type}
        />
      ) : (
        <span className="text-wl-subtle font-bold text-lg">{type[0]}</span>
      )}
    </div>
  )
}

function PriceTag({ lines }: { lines: import('../../logic/costs').CostLine[] }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <CostList lines={lines} size={12} />
    </div>
  )
}

export default function BuildingsTab({ state, setTab }: Props) {
  const {
    buildings,
    buildingPrice,
    buildingResCost,
    buyBuilding,
    setBuildingFocus,
    setBuildingOutput,
    barracksLevel,
    upgradeBarracks,
    upgradeBuilding,
    mods,
    wallet,
    resources,
  } = state

  // Evaluated once per shop entry and reused for the tile, its tooltip and its enabled
  // state — the shop can't advertise a price the button then refuses for another reason.
  const priceOf = (t: Building['type']) =>
    evaluateCost({ copper: buildingPrice(t), resources: buildingResCost(t) }, { wallet, resources })

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null)

  const buildingsArr = buildings ?? []
  const owns = (t: Building['type']) => buildingsArr.some(b => b.type === t)

  const prodTypes = ['BLACKSMITH', 'ARMORY', 'WOODWORKER', 'TAILOR', 'STABLE', 'MARKET', 'SCRIPTORIUM'] as const
  const resTypes = ['LUMBER_MILL', 'QUARRY', 'IRON_MINE', 'COAL_MINE', 'COPPER_MINE', 'SILVER_MINE', 'SMELTER', 'MINTER', 'FARM'] as const

  const prodConstruction = prodTypes.filter(t => !owns(t))
  const resConstruction = resTypes.filter(t => !owns(t))

  const handleBuildingClick = (b: Building) => {
    if (b.type === 'SCRIPTORIUM') {
      setTab('research')
      return
    }
    if (b.type === 'BARRACKS') {
      setTab('barracks')
    } else if (['MARKET', 'STABLE'].includes(b.type)) {
      setTab('market')
    } else if (prodTypes.includes(b.type as any)) {
      setSelectedBuildingId(b.id)
    } else {
      // Resource buildings might have simple focus controls?
      // For now, open same modal or skip if no options
      // They usually have no output choices, but might have focus?
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
          prodMult={mods?.prodMult ?? 1}
          craftEfficiency={mods?.craftEfficiency ?? 1}
        />
      )}

      <Card title="Town Infrastructure" className="relative p-0 overflow-hidden bg-wl-panel">
        {/* The parchment is a fixed light asset, so it cannot follow the theme on its own —
            multiplied against the card's own surface it does: white in light leaves it
            untouched, the dark panel in dark drives it down to a dark parchment. Without
            this, every heading on this card is ink-on-cream and vanishes in dark. */}
        <div
          className="absolute inset-0 opacity-100 z-0 pointer-events-none mix-blend-multiply"
          style={{ backgroundImage: `url(${parchmentBg})`, backgroundSize: 'cover' }}
        />

        <div className="relative z-10 p-6 space-y-8">

          {/* Established Buildings */}
          <div>
            <h3 className="font-serif text-2xl font-bold text-wl-ink mb-4 border-b border-wl-accent-line pb-2">Established Buildings</h3>
            {buildingsArr.length === 0 && <div className="text-wl-muted italic">Empty. Build below.</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {buildingsArr.map((b) => (
                <div
                  key={b.id}
                  className="bg-wl-accent-surface/80 p-3 rounded-lg shadow-md border border-wl-accent-line flex flex-col gap-3 relative group hover:-translate-y-1 transition-transform duration-300 cursor-pointer"
                  onClick={() => handleBuildingClick(b)}
                >
                  <div className="flex justify-between items-center border-b border-wl-accent-line pb-2">
                    <span className="font-bold text-wl-ink text-sm">{b.type.replace('_', ' ')}</span>
                    {b.type === 'BARRACKS' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] bg-wl-accent-surface/50 px-1 rounded text-wl-accent font-mono">L{barracksLevel}</span>
                        {barracksLevel < 5 && (
                          <button onClick={(e) => { e.stopPropagation(); upgradeBarracks() }} className="text-[11px] font-bold bg-wl-bad text-wl-inverse px-2 rounded shadow hover:bg-wl-bad/90 min-w-[34px] min-h-[34px] inline-flex items-center justify-center">
                            UP
                          </button>
                        )}
                      </div>
                    ) : ['MARKET', 'STABLE'].includes(b.type) ? (
                      <span className="text-[11px] bg-wl-accent-surface/50 px-1 rounded text-wl-accent font-mono">L{b.level ?? 1}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] bg-wl-accent-surface/50 px-1 rounded text-wl-accent font-mono">L{b.level ?? 1}</span>
                        {(b.level ?? 1) < BUILDING_MAX_LEVEL && (
                          <button
                            onClick={(e) => { e.stopPropagation(); upgradeBuilding(b.id) }}
                            title={`Upgrade to L${(b.level ?? 1) + 1} — ${fmtCopper(buildingUpgradeCostCopper(b.type, b.level ?? 1, mods?.buildCostMult ?? 1))} (output ×${buildingLevelMult((b.level ?? 1) + 1).toFixed(1)})`}
                            className="text-[11px] font-bold bg-wl-bad text-wl-inverse px-2 rounded shadow hover:bg-wl-bad/90 min-w-[34px] min-h-[34px] inline-flex items-center justify-center"
                          >
                            UP
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <BuildingImg type={b.type} />

                  <div className="space-y-2 mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
                    {!['STABLE', 'MARKET', 'BARRACKS'].includes(b.type) && (
                      <div className="text-[11px] text-wl-muted px-1 bg-wl-accent-surface/30 rounded py-1 border border-wl-accent-line">
                        <div className="flex justify-between">
                          <span>{b.focusCoinPct}% Tax</span>
                          {b.outputItem && (
                            <span className="font-mono text-wl-ink">
                              Creating {formatGameTooltip(b.outputItem)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Construction Plans */}
          {(prodConstruction.length > 0 || resConstruction.length > 0) && (
            <div className="space-y-6">
              <h3 className="font-serif text-2xl font-bold text-wl-ink border-b border-wl-accent-line pb-2">Construction Plans</h3>

              {/* Production */}
              {prodConstruction.length > 0 && (
                <div>
                  <h4 className="font-bold text-wl-ink mb-2 uppercase text-xs tracking-wider">Production & Military</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {prodConstruction.map(t => {
                      const price = priceOf(t)
                      return (
                      <button
                        key={t}
                        onClick={() => buyBuilding(t)}
                        disabled={!price.ok}
                        title={price.ok ? `Build ${t.replace(/_/g, ' ')}` : price.shortfallLabel}
                        className={`flex flex-col items-center p-3 rounded border transition-colors ${price.ok ? 'border-wl-accent-line bg-wl-accent-surface/40 hover:bg-wl-accent-surface' : 'border-dashed border-wl-line bg-wl-panel-muted cursor-not-allowed'}`}
                      >
                        <div className="wl-art w-24 h-24 mb-3 rounded flex items-center justify-center">
                          {BuildingImages[t]
                            ? <img src={BuildingImages[t]} className="w-full h-full object-contain mix-blend-multiply" alt={t} />
                            : <span className="text-3xl text-wl-subtle font-bold">{t[0]}</span>}
                        </div>
                        <span className="font-bold text-sm text-wl-ink mb-2">{t.replace(/_/g, ' ')}</span>
                        <PriceTag lines={price.lines} />
                        {!price.ok && <span className="mt-1 text-[11px] text-wl-bad text-center leading-tight">{price.shortfallLabel}</span>}
                      </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Resources */}
              {resConstruction.length > 0 && (
                <div>
                  <h4 className="font-bold text-wl-ink mb-2 uppercase text-xs tracking-wider">Resource Management</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {resConstruction.map(t => {
                      const price = priceOf(t)
                      return (
                      <button
                        key={t}
                        onClick={() => buyBuilding(t)}
                        disabled={!price.ok}
                        title={price.ok ? `Build ${t.replace(/_/g, ' ')}` : price.shortfallLabel}
                        className={`flex flex-col items-center p-3 rounded border transition-colors ${price.ok ? 'border-wl-accent-line bg-wl-panel-muted/40 hover:bg-wl-panel-muted' : 'border-dashed border-wl-line bg-wl-panel-muted cursor-not-allowed'}`}
                      >
                        <div className="wl-art w-24 h-24 mb-3 rounded flex items-center justify-center">
                          {BuildingImages[t] ?
                            <img src={BuildingImages[t]} className="w-full h-full object-contain mix-blend-multiply" alt={t} />
                            : <span className="text-4xl text-wl-subtle font-bold">{t[0]}</span>
                          }
                        </div>
                        <span className="font-bold text-sm text-wl-ink mb-2">{t.replace(/_/g, ' ')}</span>
                        <PriceTag lines={price.lines} />
                        {!price.ok && <span className="mt-1 text-[11px] text-wl-bad text-center leading-tight">{price.shortfallLabel}</span>}
                      </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center text-xs text-wl-subtle pt-8 font-serif italic">
            "A prosperous town fuels a mighty army."
          </div>

        </div>
      </Card>
    </>
  )
}
