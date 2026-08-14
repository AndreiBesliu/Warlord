import { useState } from 'react'
import Card from '../common/Card'
import RecruitForm from '../barracks/RecruitForm'
import MoneyDisplay from '../common/MoneyDisplay'
import { type Rank, type SoldierType, } from '../../logic/types'
import type { GameStateShape } from '../../state/useGameState'
import { Registry } from '../../logic/registry'
import GameIcon from '../common/GameIcon'
import { getIconForGameItem } from '../../logic/iconHelpers'
import barracksScene from '../../assets/barracks_scene.png'
import { checkLightTraining, checkConversion } from '../../logic/barracks'
import { batchDaysAt, survivorsOf, trainingXpFor, drillPayFor, type Intensity } from '../../logic/batches'
import { promoteBuckets } from '../../logic/units'
import type { ActionCheck } from '../../logic/barracks'

// Every refusal in this tab used to exist only as a line in the Log tab: the button stayed
// enabled, nothing moved on screen, and pressing Train Batch with an empty armoury was
// indistinguishable from a broken game. Same treatment as Research and Buildings now —
// the button goes dead and says what is missing, in place.
function Blocked({ check }: { check: ActionCheck }) {
  if (check.ok) return null
  return (
    <div className="mt-1 text-[11px] text-wl-bad leading-tight">{check.reasons.filter(Boolean).join(' · ')}</div>
  )
}

type ViewMode = 'SCENE' | 'RECRUIT' | 'TRAINING' | 'MANAGEMENT'

export default function BarracksTab({ state }: { state: GameStateShape }) {
  const [view, setView] = useState<ViewMode>('SCENE')

  // -- Scene View --
  if (view === 'SCENE') {
    return (
      <Card title="Barracks Hub" className="relative p-0 overflow-hidden select-none">

        {/* Main Scene Container */}
        <div className="relative w-full aspect-[2/1] bg-wl-panel-contrast overflow-hidden">
          <img src={barracksScene} className="wl-scene w-full h-full object-cover" alt="Barracks Scene" draggable={false} />

          {/* CLICK ZONES */}
          {/* 1. Training Yard (Left) */}
          <div
            className="absolute top-[20%] left-[5%] w-[35%] h-[60%] cursor-pointer group hover:bg-white/10 rounded-xl transition-all border-2 border-transparent hover:border-wl-accent/50"
            onClick={() => setView('TRAINING')}
            title="Training Yard"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Training Grounds ⚔️
            </div>
          </div>

          {/* 2. Recruitment Tent (Right) */}
          <div
            className="absolute top-[30%] right-[5%] w-[30%] h-[50%] cursor-pointer group hover:bg-white/10 rounded-xl transition-all border-2 border-transparent hover:border-wl-info/50"
            onClick={() => setView('RECRUIT')}
            title="Recruitment"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Recruitment Office 📜
            </div>
          </div>

          {/* 3. Headquarters (Top Center) */}
          <div
            className="absolute top-[5%] left-[40%] w-[20%] h-[40%] cursor-pointer group hover:bg-white/10 rounded-xl transition-all border-2 border-transparent hover:border-wl-bad/50"
            onClick={() => setView('MANAGEMENT')}
            title="Management"
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Headquarters 🏰
            </div>
          </div>

          {/* HUD Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 flex justify-between text-xs px-4">
            <span>Level {state.barracksLevel} Barracks</span>
            <span>Active Batches: {state.batches.length}</span>
            <span>Recruits: {state.recruits.count}</span>
          </div>
        </div>

        <div className="p-4 text-sm text-wl-muted text-center">
          Click on an area to enter. Hover for details.
        </div>
      </Card>
    )
  }

  // Wrapper for sub-views
  const BackBtn = () => (
    <button
      onClick={() => setView('SCENE')}
      className="mb-4 text-sm text-wl-info hover:underline flex items-center gap-1"
    >
      ← Back to Barracks Scene
    </button>
  )

  // -- Sub Views --
  if (view === 'RECRUIT') {
    return (
      <Card title="Recruitment Office">
        <BackBtn />
        <div className="p-2">
          <RecruitForm onRecruit={(qty) => state.recruit(qty)} />
          <div className="mt-4 text-sm text-wl-muted">
            Current Untyped Recruits: <span className="font-bold">{state.recruits.count}</span>
          </div>
        </div>
      </Card>
    )
  }

  if (view === 'MANAGEMENT') {
    const { barracksLevel, barracksUpgradeCost, upgradeBarracks, batches, batchSlots, batchDurationDays, barracks } = state
    // Trained soldiers land in this pool and used to be invisible from here — the middle
    // step of the whole loop existed only inside a form on another tab, so a finished batch
    // looked like it had gone nowhere.
    const trained = (Object.entries(barracks) as [SoldierType, Record<Rank, { count: number; avgXP: number }>][])
      .map(([type, ranks]) => ({
        type,
        ranks: (Object.entries(ranks) as [Rank, { count: number; avgXP: number }][]).filter(([, v]) => v.count > 0),
      }))
      .filter((r) => r.ranks.length > 0)
    const hasCostFn = typeof barracksUpgradeCost === 'function'
    const nextCost = hasCostFn ? barracksUpgradeCost(barracksLevel) : 0

    return (
      <Card title="Headquarters">
        <BackBtn />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-wl-line rounded p-4">
            <h3 className="font-semibold mb-2">Facility Status</h3>
            <div className="text-sm space-y-2">
              <div>Level: <span className="font-bold">{barracksLevel}</span></div>
              <div>Batch Slots: {batchSlots(barracksLevel)}</div>
              <div>Batch Duration: {batchDurationDays(barracksLevel)} days</div>
            </div>
            <div className="mt-4 border-t border-wl-line pt-3">
              <h4 className="text-xs uppercase tracking-wide text-wl-muted mb-2">Trained soldiers, waiting to be formed</h4>
              {trained.length === 0 ? (
                <p className="text-xs text-wl-muted">
                  None yet. Finished training batches gather here; form them into units at the
                  Commander's Tent in the Units tab.
                </p>
              ) : (
                <div className="space-y-1">
                  {trained.map((row) => (
                    <div key={row.type} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold text-wl-ink">{row.type.replace(/_/g, ' ')}</span>
                      {row.ranks.map(([r, v]) => (
                        <span key={r} className="text-xs text-wl-muted">
                          <span className="font-mono text-wl-ink">{v.count}</span> {r.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                className="px-4 py-2 bg-wl-info text-wl-inverse rounded disabled:opacity-50 disabled:bg-wl-subtle flex items-center gap-2 shadow hover:bg-wl-info/90 transition"
                disabled={barracksLevel >= 5 || !hasCostFn}
                onClick={upgradeBarracks}
              >
                Upgrade Barracks
                {barracksLevel < 5 && hasCostFn && <span className="text-wl-inverse/80 text-xs">(<MoneyDisplay amount={nextCost} size={12} className="inline-flex text-wl-inverse" />)</span>}
                {barracksLevel >= 5 && <span className="text-wl-inverse/80 text-xs">(Max)</span>}
              </button>
            </div>
          </div>

          <div className="border border-wl-line rounded p-4">
            <h3 className="font-semibold mb-2">Active Batches ({batches.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {batches.length === 0 && <div className="text-sm text-wl-muted">No active training batches.</div>}
              {batches.map((b: any) => (
                <div key={b.id} className="border border-wl-line rounded p-2 text-sm bg-wl-panel-muted">
                  <div className="flex justify-between font-bold">
                    <span>{b.kind}</span>
                    <span className="text-xs font-mono text-wl-subtle">{b.id.slice(0, 4)}</span>
                  </div>
                  <div>Target: {b.target}{b.fromType ? ` (from ${b.fromType})` : ''}</div>
                  <div>Qty: {b.qty}</div>
                  <div className="text-wl-info font-semibold">Days remaining: {b.daysRemaining}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (view === 'TRAINING') {
    return <TrainingView state={state} onBack={() => setView('SCENE')} />
  }

  return null
}

// Extracted Training View for cleanliness
function TrainingView({ state, onBack }: { state: GameStateShape, onBack: () => void }) {
  const {
    queueLightTraining, queueHeavyConversion, queueLightCavConversion, queueHorseArcherConversion,
    recruits, barracks, batches, batchSlots, barracksLevel, wallet, resources, inv, mods,
  } = state

  const have = { wallet, resources, inv }
  const slotFree = batches.length < batchSlots(barracksLevel)
  const poolOf = (t: SoldierType, ranks: Rank[]) =>
    ranks.reduce((a, r) => a + (barracks[t]?.[r]?.count ?? 0), 0)

  const [lightType, setLightType] = useState<SoldierType>('LIGHT_INF_SPEAR')
  const [lightQty, setLightQty] = useState(20)
  const [lightIntensity, setLightIntensity] = useState<Intensity>('STANDARD')
  const [heavySrc, setHeavySrc] = useState<SoldierType>('LIGHT_CAV')
  const [heavyQty, setHeavyQty] = useState(10)
  const [lcSrc, setLcSrc] = useState<SoldierType>('LIGHT_INF_SPEAR')
  const [lcQty, setLcQty] = useState(10)
  const [haQty, setHaQty] = useState(10)

  const trainCheck = checkLightTraining({ target: lightType, qty: lightQty, recruits: recruits.count, slotFree, have, intensity: lightIntensity })
  const lcCheck = checkConversion({
    target: 'LIGHT_CAV', qty: lcQty, slotFree, have,
    availableFromPool: poolOf(lcSrc, ['NOVICE', 'TRAINED', 'ADVANCED', 'VETERAN', 'ELITE']),
    sourceLabel: `${lcSrc.replace(/_/g, ' ').toLowerCase()} (novice or better)`,
  })
  const haCheck = checkConversion({
    target: 'HORSE_ARCHER', qty: haQty, slotFree, have,
    availableFromPool: poolOf('LIGHT_ARCHER', ['ADVANCED', 'VETERAN', 'ELITE']),
    sourceLabel: 'advanced light archers',
  })
  const heavyCheck = checkConversion({
    target: 'HEAVY_CAV', qty: heavyQty, slotFree, have,
    availableFromPool: poolOf(heavySrc, ['ADVANCED', 'VETERAN', 'ELITE']),
    sourceLabel: `advanced ${heavySrc.replace(/_/g, ' ').toLowerCase()}`,
  })

  // Reused Requirement Helper
  const renderReqs = (qty: number, type?: string | undefined, unitId?: string, _isHeavy?: boolean, heavySrcVal?: string) => {
    // Custom logic for conversions OR Registry logic for training
    // If unitId is passed, use Registry
    if (unitId) {
      const def = Registry.getUnit(unitId);
      if (!def || !def.req) return null;
      const { weapons, armors, horses } = def.req;

      const list: { id: string; count: number; name: string }[] = [];
      const add = (rec?: Record<string, number>) => {
        if (rec) Object.entries(rec).forEach(([k, v]) => {
          list.push({ id: k, count: v * qty, name: Registry.getItem(k)?.name || k });
        });
      };
      add(weapons); add(armors); add(horses);

      if (list.length === 0) return <div className="text-xs text-wl-good mt-2">No gear required.</div>;

      return (
        <div className="flex flex-wrap gap-4 mt-2">
          <span className="text-xs text-wl-muted flex items-center">Requires:</span>
          {list.map(item => (
            <div key={item.id} className="flex items-center gap-1 text-xs text-wl-ink">
              <GameIcon name={getIconForGameItem(item.id) || 'sword'} size={24} />
              <span className="font-mono">{item.count}</span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      );
    }

    // Hardcoded conversions logic from previous step
    if (type === 'LIGHT_CAV') {
      // Light Cav: 1 Light Horse
      return (
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center gap-1 text-xs text-wl-ink">
            <span className="text-wl-muted mr-1">Requires:</span>
            <GameIcon name="light_horse" size={24} />
            <span className="font-mono">{qty}</span>
            <span>Light Horse</span>
          </div>
        </div>
      )
    }
    if (type === 'HORSE_ARCHER') {
      return (
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center gap-1 text-xs text-wl-ink">
            <span className="text-wl-muted mr-1">Requires:</span>
            <GameIcon name="light_horse" size={24} />
            <span className="font-mono">{qty}</span>
            <span>Light Horse</span>
          </div>
        </div>
      )
    }
    if (type === 'HEAVY_CAV') {
      return (
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center gap-1 text-xs text-wl-ink">
            <span className="text-wl-muted mr-1">Requires:</span>
            <div className="flex items-center gap-1">
              <GameIcon name="heavy_horse" size={24} />
              <span className="font-mono">{qty}</span>
              <span>Heavy Horse</span>
            </div>
            <div className="flex items-center gap-1">
              <GameIcon name="horse_armor" size={24} />
              <span className="font-mono">{qty}</span>
              <span>Horse Armor</span>
            </div>
            {heavySrcVal === 'LIGHT_CAV' && (
              <div className="flex items-center gap-1">
                <GameIcon name="heavy_armor" size={24} />
                <span className="font-mono">{qty}</span>
                <span>Heavy Armor</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card title="Training Grounds">
      <button
        onClick={onBack}
        className="mb-4 text-sm text-wl-info hover:underline flex items-center gap-1"
      >
        ← Back to Barracks Scene
      </button>

      <div className="space-y-6">

        {/* Basic Training */}
        <div className="border border-wl-line rounded p-4 bg-wl-panel shadow-sm">
          <div className="font-semibold mb-2 text-lg border-b border-wl-line pb-1">Basic Training</div>
          <div className="text-sm text-wl-muted mb-2">Train untyped recruits into specialized light infantry.</div>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex flex-col">
              <label className="text-sm font-medium">Target Unit</label>
              <select className="border border-wl-line rounded px-2 py-1 bg-wl-panel-muted" value={lightType} onChange={e => setLightType(e.target.value as SoldierType)}>
                {Registry.getAllUnits()
                  .filter(u => u.id.startsWith('LIGHT_INF') || u.id === 'LIGHT_ARCHER')
                  .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">Quantity</label>
              <input className="border border-wl-line rounded px-2 py-1 w-24 bg-wl-panel-muted" type="number" min={1} max={50}
                value={lightQty} onChange={e => setLightQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">Intensity</label>
              <select
                className="border border-wl-line rounded px-2 py-1 bg-wl-panel-muted"
                value={lightIntensity}
                onChange={e => setLightIntensity(e.target.value as Intensity)}
              >
                <option value="RUSHED">Rushed — fast, some wash out</option>
                <option value="STANDARD">Standard</option>
                <option value="DRILLED">Drilled — slower, costs pay, better troops</option>
              </select>
            </div>
            <button className="px-4 py-1 bg-wl-good text-wl-inverse rounded hover:bg-wl-good/90 disabled:opacity-60 disabled:cursor-not-allowed" disabled={!trainCheck.ok} onClick={() => queueLightTraining(lightType, lightQty, lightIntensity)}>
              Train Batch
            </button>
          </div>
          {renderReqs(lightQty, undefined, lightType)}
          <div className="mt-2 text-xs text-wl-muted">
            {(() => {
              const days = batchDaysAt(barracksLevel, lightIntensity, mods.trainDaysDelta)
              const out = survivorsOf(lightQty, lightIntensity)
              const xp = trainingXpFor(lightIntensity, mods.trainXpMult)
              const { buckets } = promoteBuckets([{ r: 'NOVICE', count: out, avgXP: xp }])
              const ranks = buckets.map(b => `${b.count} ${b.r}`).join(', ')
              const pay = drillPayFor(lightQty, lightIntensity)
              return (
                <>
                  <span className="font-mono text-wl-ink">{days}</span> day{days === 1 ? '' : 's'} →{' '}
                  <span className="font-mono text-wl-ink">{ranks}</span>
                  {out < lightQty && <span className="text-wl-bad"> ({lightQty - out} wash out)</span>}
                  {pay > 0 && <span> · drill pay <MoneyDisplay amount={pay} size={12} className="inline-flex" /></span>}
                </>
              )
            })()}
          </div>
          <Blocked check={trainCheck} />
        </div>

        {/* Conversions Grid */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Light Cav */}
          <div className="border border-wl-line rounded p-4 bg-wl-panel shadow-sm">
            <div className="font-semibold mb-2 border-b border-wl-line pb-1">Light Cavalry Conversion</div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col grow">
                <label className="text-xs">From (Novice+)</label>
                <select className="border border-wl-line rounded px-2 py-1 text-sm w-full" value={lcSrc} onChange={e => setLcSrc(e.target.value as SoldierType)}>
                  {(['LIGHT_INF_SWORD', 'LIGHT_INF_SPEAR', 'LIGHT_INF_HALBERD'] as SoldierType[])
                    .map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs">Qty</label>
                <input className="border border-wl-line rounded px-2 py-1 w-16 text-sm" type="number" min={1} max={50}
                  value={lcQty} onChange={e => setLcQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
              </div>
              <button className="px-3 py-1 border border-wl-line rounded hover:bg-wl-panel-muted text-sm disabled:opacity-60 disabled:cursor-not-allowed" disabled={!lcCheck.ok} onClick={() => queueLightCavConversion(lcSrc, lcQty)}>
                Queue
              </button>
            </div>
            {renderReqs(lcQty, 'LIGHT_CAV')}
            <Blocked check={lcCheck} />
          </div>

          {/* Horse Archer */}
          <div className="border border-wl-line rounded p-4 bg-wl-panel shadow-sm">
            <div className="font-semibold mb-2 border-b border-wl-line pb-1">Horse Archer Conversion</div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col grow">
                <div className="text-sm py-1 text-wl-muted">From LIGHT_ARCHER (Adv+)</div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs">Qty</label>
                <input className="border border-wl-line rounded px-2 py-1 w-16 text-sm" type="number" min={1} max={50}
                  value={haQty} onChange={e => setHaQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
              </div>
              <button className="px-3 py-1 border border-wl-line rounded hover:bg-wl-panel-muted text-sm disabled:opacity-60 disabled:cursor-not-allowed" disabled={!haCheck.ok} onClick={() => queueHorseArcherConversion(haQty)}>
                Queue
              </button>
            </div>
            {renderReqs(haQty, 'HORSE_ARCHER')}
            <Blocked check={haCheck} />
          </div>
        </div>

        {/* Heavy Cav (Full Width) */}
        <div className="border border-wl-line rounded p-4 bg-wl-panel shadow-sm">
          <div className="font-semibold mb-2 border-b border-wl-line pb-1">Heavy Cavalry Conversion</div>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex flex-col">
              <label className="text-sm">From (Advanced+)</label>
              <select className="border border-wl-line rounded px-2 py-1 text-sm bg-wl-panel-muted" value={heavySrc} onChange={e => setHeavySrc(e.target.value as SoldierType)}>
                {(['LIGHT_CAV', 'HEAVY_INF_SWORD', 'HEAVY_INF_SPEAR', 'HEAVY_INF_HALBERD'] as SoldierType[])
                  .map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Quantity</label>
              <input className="border border-wl-line rounded px-2 py-1 w-20 text-sm bg-wl-panel-muted" type="number" min={1} max={50}
                value={heavyQty} onChange={e => setHeavyQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1'))))} />
            </div>
            <button className="px-4 py-1 bg-wl-accent text-wl-accent-ink rounded hover:bg-wl-accent/90 text-sm disabled:opacity-60 disabled:cursor-not-allowed" disabled={!heavyCheck.ok} onClick={() => queueHeavyConversion(heavySrc, heavyQty)}>
              Initialize Conversion
            </button>
          </div>
          {renderReqs(heavyQty, 'HEAVY_CAV', undefined, true, heavySrc)}
          <Blocked check={heavyCheck} />
        </div>

      </div>
    </Card>
  )
}
