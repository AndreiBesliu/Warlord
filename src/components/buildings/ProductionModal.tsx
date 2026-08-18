import { createPortal, } from 'react-dom'
import { useState } from 'react'
import { type Building } from '../../logic/types'
import { craftChannelsFor, type CraftDesign } from '../../logic/craft'
import CraftPanel from './CraftPanel'
import { buildingCostCopper, BuildingOutputChoices, hasNoItemToMake, passiveIncomeAndProduction } from '../../logic/economy'
import { staffMultOf, type PopulationState } from '../../logic/population'
import { branchOfBuilding, studyFromValue } from '../../logic/research/study'
import CrewRow from './CrewRow'
import { BRANCH_LABEL } from '../../logic/research/catalog'
import { getIconForGameItem } from '../../logic/iconHelpers'
import MoneyDisplay from '../common/MoneyDisplay'
import GameIcon from '../common/GameIcon'
// Import backgrounds
import bgWoodworker from '../../assets/interiors/woodworker.png'
import bgBlacksmith from '../../assets/interiors/blacksmith.png'
import bgArmory from '../../assets/interiors/armory.png'
import bgTailor from '../../assets/interiors/tailor.png'

import bgLumberMill from '../../assets/interiors/lumber_mill_interior.png'

type Props = {
    building: Building
    onClose: () => void
    onSetOutput: (item: string) => void
    onSetFocus: (pct: number) => void
    onSetResearchFocus: (pct: number) => void
    prodMult?: number      // research/momentum production bonus (1 = unchanged)
    craftEfficiency?: number
    population: PopulationState
    idleHands: number
    whyNotAssign: (delta: number) => string | null
    onAssign: (delta: number) => void
    buildings: Building[]
    onSwearCraft: (design: CraftDesign) => void
    /** Why a sworn oath refuses this setting. Asked BEFORE the control fires. */
    whyNotSetFocus: (next: { coinPct?: number; studyPct?: number }) => string | null
}

const InteriorMap: Record<string, string> = {
    WOODWORKER: bgWoodworker,
    BLACKSMITH: bgBlacksmith,
    ARMORY: bgArmory,
    TAILOR: bgTailor,
    LUMBER_MILL: bgLumberMill, // New image
    QUARRY: bgBlacksmith,
    SMELTER: bgBlacksmith,
    MINTER: bgTailor,
    // ... others
    IRON_MINE: bgBlacksmith,
    COAL_MINE: bgBlacksmith,
    COPPER_MINE: bgBlacksmith,
    SILVER_MINE: bgBlacksmith,
    STABLE: bgTailor,
    MARKET: bgTailor,
}

export default function ProductionModal({
    building, onClose, onSetOutput, onSetFocus, onSetResearchFocus, prodMult = 1, craftEfficiency = 1,
    population, idleHands, whyNotAssign, onAssign, buildings, onSwearCraft, whyNotSetFocus,
}: Props) {
    // A slider cannot be `disabled` for only part of its range, so the refusal is caught
    // here and SAID here. Without this the state refuses, the knob springs back, and the
    // only explanation is in another tab — which reads as a broken control.
    const [refused, setRefused] = useState<string | null>(null)
    const guard = (why: string | null, run: () => void) => {
        if (why) { setRefused(why); return }
        setRefused(null)
        run()
    }
    const bg = InteriorMap[building.type] || bgBlacksmith
    const options = BuildingOutputChoices[building.type]?.options || []
    // Nothing to make means nothing for a coin/goods split to split: the whole output is
    // coin. Showing the slider anyway offered a choice that could only make it worse.
    const onlyCoin = hasNoItemToMake(building.type)

    // Preview MUST come from the same function the daily tick runs, otherwise the
    // modal advertises numbers the game never pays (it used to hardcode 0.10*cost / 0.7*mv,
    // ignoring building level, resource base values and research bonuses).
    let coinGain = 0
    let items = '0'
    let studyPerDay = 0
    const branch = branchOfBuilding(building.type)

    {
        const out = passiveIncomeAndProduction({
            type: building.type,
            costCopper: buildingCostCopper(building.type),
            focusCoinPct: building.focusCoinPct,
            outputItem: building.outputItem || options[0] || '',
            fractionalBuffer: 0,
            level: building.level ?? 1,
            outputMult: prodMult,
            craftEfficiency: craftEfficiency,
            focusResearchPct: building.focusResearchPct,
            // The fourth reader of the day, and the one that does NOT go through
            // simulateEconomyDay — so the crew multiplier has to be handed to it by the
            // same helper the day uses, or this slab advertises a number the tick won't pay.
            staffMult: staffMultOf(building, population),
        })
        // This slab is the ONE reader of the day that does not go through
        // `simulateEconomyDay`, so the craft has to be applied here by the same helper the
        // day uses, or the preview advertises a number the tick will never pay.
        coinGain = Math.round(out.coinGain * craftChannelsFor(
            building, population, buildings, onlyCoin,
        ).coinMult)
        studyPerDay = Math.round(studyFromValue(out.researchValue) * 10) / 10
        // Whole items only land once the buffer fills; show the daily rate, not the floor.
        const perDay = out.items + out.newBuffer
        items = perDay > 0 ? perDay.toFixed(1) : '0'
    }

    // The portal has to land INSIDE the `.warlord` root, not on <body>: that element is
    // where the colour tokens are declared, so on <body> every wl- utility in this modal
    // resolves against an undefined custom property and the declaration is dropped — the
    // control slab rendered with NO background at all. `.warlord` is not a containing
    // block for `fixed` (no transform/filter), so the overlay still covers the viewport.
    const host = document.querySelector<HTMLElement>('.warlord') ?? document.body

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-wl-line-strong">

                {/* Background Image */}
                <div
                    className="wl-scene absolute inset-0 bg-cover bg-center transition-all duration-700"
                    style={{ backgroundImage: `url(${bg})` }}
                />

                {/* Overlay Gradient for readability */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-red-900/80 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center border border-white/20 transition-colors"
                >
                    ✕
                </button>

                {/* Title */}
                <div className="absolute top-6 left-6 text-white drop-shadow-md">
                    <h2 className="text-4xl font-serif font-bold tracking-wide text-amber-100">{building.type.replace('_', ' ')}</h2>
                    <div className="text-amber-200/60 text-sm tracking-widest uppercase">Production Management</div>
                </div>

                {/* Interactive Item Showcase (Middle-ish) */}
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="flex gap-8 pointer-events-auto transform translate-y-[-10%]">
                        {options.map((opt) => {
                            const isSelected = building.outputItem === opt
                            return (
                                <button
                                    key={opt}
                                    onClick={() => onSetOutput(opt)}
                                    className={`
                    group relative flex flex-col items-center gap-3 transition-all duration-300
                    ${isSelected ? 'scale-125 z-10' : 'scale-100 opacity-70 hover:opacity-100 hover:scale-110'}
                  `}
                                >
                                    {/* Glowing backing for selected */}
                                    {isSelected && <div className="absolute inset-0 bg-yellow-400/30 blur-xl rounded-full" />}

                                    <div className={`
                    w-20 h-20 flex items-center justify-center rounded-xl border-2 shadow-xl bg-black/60
                    ${isSelected ? 'border-yellow-400 shadow-yellow-500/20' : 'border-white/10 border-dashed'}
                  `}>
                                        <GameIcon name={getIconForGameItem(opt) || 'sword'} size={48} />
                                    </div>

                                    <span className={`
                     px-3 py-1 rounded bg-black/80 text-xs font-bold font-mono tracking-wider border
                     ${isSelected ? 'text-yellow-400 border-yellow-400/30' : 'text-gray-400 border-transparent'}
                  `}>
                                        {opt.replace(/_/g, ' ')}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Bottom Manager Controls */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-wl-panel-contrast/90 border border-wl-line-strong p-6 rounded-xl shadow-2xl w-[600px] backdrop-blur-md flex flex-col gap-4">

                    {/* Stats Header */}
                    <div className="flex justify-between items-end border-b border-wl-contrast-ink/10 pb-2">
                        <div className="flex flex-col">
                            <span className="text-xs text-wl-contrast-ink/70 uppercase tracking-widest">Daily Output Preview</span>
                            <div className="flex items-baseline gap-4 mt-1">
                                {/* Deliberately NOT wl-accent: this slab is dark in both themes, and the
                                    light-theme accent (40% L gold) sits at ~2:1 on it. */}
                                <span className="text-yellow-400 font-bold text-xl drop-shadow-sm">
                                    <MoneyDisplay amount={coinGain} />
                                </span>
                                {!onlyCoin && (
                                    <>
                                        <span className="text-wl-contrast-ink/60 font-serif italic text-sm">and</span>
                                        <span className="text-wl-contrast-ink font-bold text-xl drop-shadow-sm">
                                            {items} {building.outputItem?.replace(/_/g, ' ') || 'Items'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-wl-contrast-ink/60 block">Current Focus</span>
                            <span className="text-2xl font-mono text-amber-500">
                                {onlyCoin ? 'Coin' : `${building.focusCoinPct}% Coin`}
                            </span>
                        </div>
                    </div>

                    {/* Who is working it. Above the focus slider because it multiplies the
                        whole day — coin, goods and study alike — rather than splitting it. */}
                    <CrewRow
                        building={building}
                        population={population}
                        idle={idleHands}
                        whyNot={whyNotAssign}
                        onAssign={onAssign}
                        contrast
                    />

                    {refused && (
                        <p className="text-[11px] text-red-300 leading-tight" role="status">{refused}</p>
                    )}

                    <CraftPanel
                        building={building}
                        population={population}
                        buildings={buildings}
                        onSwear={onSwearCraft}
                    />

                    {/* Slider Control. Absent where there is nothing to make — and SAID, because
                        a control that silently disappears reads as a bug. */}
                    {onlyCoin ? (
                        <p className="pt-2 text-[11px] text-wl-contrast-ink/60">
                            This building makes no goods — its product is money. Everything it turns
                            out is paid in coin; the only choice here is how much of it goes to study.
                        </p>
                    ) : (
                        <div className="pt-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="20"
                                value={building.focusCoinPct}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value)
                                    guard(whyNotSetFocus({ coinPct: v }), () => onSetFocus(v))
                                }}
                                className="w-full h-2 bg-wl-contrast-ink/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <div className="flex justify-between text-[10px] text-wl-contrast-ink/60 uppercase mt-2 font-bold tracking-widest">
                                <span>100% Goods</span>
                                <span>100% Coin</span>
                            </div>
                        </div>
                    )}

                    {/* Study. A separate slider rather than a third pole on the one above:
                        research is taken off the top and the coin/goods split then applies
                        to what is left, so the two are genuinely independent choices. */}
                    <div className="pt-4 mt-2 border-t border-wl-contrast-ink/15">
                        {branch ? (
                            <>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-xs text-wl-contrast-ink/60 uppercase tracking-widest">
                                        Dedicated to study · {BRANCH_LABEL[branch]}
                                    </span>
                                    <span className="text-lg font-mono text-wl-contrast-ink">
                                        {building.focusResearchPct ?? 0}% → <span className="text-wl-good">{studyPerDay} study/day</span>
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="20"
                                    value={building.focusResearchPct ?? 0}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value)
                                        guard(whyNotSetFocus({ studyPct: v }), () => onSetResearchFocus(v))
                                    }}
                                    className="mt-2 w-full h-2 bg-wl-contrast-ink/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                                <p className="mt-2 text-[11px] text-wl-contrast-ink/60">
                                    {onlyCoin
                                        ? 'Taken off the top — whatever you dedicate here stops becoming coin entirely.'
                                        : 'Taken before the split above — whatever you dedicate here stops becoming coin and goods entirely.'}
                                </p>
                            </>
                        ) : (
                            // Said rather than hidden: an absent control reads as a bug.
                            <p className="text-[11px] text-wl-contrast-ink/60">
                                This building cannot study. Workshops and mines advance Economy, the
                                barracks and forges advance Army, the stable advances Campaign — and the
                                Scriptorium studies for every branch on its own.
                            </p>
                        )}
                    </div>

                </div>

            </div>
        </div>,
        host
    )
}
