import MissingEquipment from '../units/MissingEquipment'
import SplitMergeControls from '../units/SplitMergeControls'
import ReplenishForm from '../units/ReplenishForm'
import type { GameStateShape } from '../../state/useGameState'
import CreateUnitForm from '../barracks/CreateUnitForm'
import { RankNumber, type Unit } from '../../logic/types'
import { unitName, rankName } from '../../logic/names'
import { PROMOTE_AT, nextRank } from '../../logic/units'


// Same story as the barracks: the army-camp scene gated these two screens behind two
// invisible rectangles that OVERLAPPED — the inspection hotspot sat on top of the
// commander's tent and stole its clicks. ArmyTab drives the view now.
export type UnitsView = 'FORMATION' | 'INSPECTION'

export default function UnitsTab({ state, view }: { state: GameStateShape; view: UnitsView }) {

  // Destructured off the REAL shape, not `state as any`. The cast is how the army came to
  // be un-startable on live: this file asked for `createUnit`, the state exports
  // `createUnitFromBarracks`, and the button threw `onCreate is not a function` on every
  // press — silently, past a green typecheck. The `safe*` no-op fallbacks that used to sit
  // here made the same class of mistake degrade to "nothing happens" by design; they are
  // gone too, so a missing handler is a compile error instead of a shrug.
  const {
    units,
    mergePick,
    computeReady,
    doSplit,
    togglePickForMerge,
    doMergeIfReady,
    toggleTraining,
    createUnitFromBarracks,
    replenishUnit,
    disbandUnit,
    inv,
    barracks,
  } = state

  if (view === 'FORMATION') {
    return (
      <div>
        <div className="p-2">
          <div className="mb-4 text-sm text-wl-muted">
            Assign unassigned soldiers from the Barracks pool to form new combat units.
          </div>
          <CreateUnitForm
            barracks={barracks}
            inv={inv}
            wallet={state.wallet}
            resources={state.resources}
            onCreate={createUnitFromBarracks}
          />
        </div>
      </div>
    )
  }

  if (view === 'INSPECTION') {
    return (
      <div>

        <div className="mb-4 flex items-center gap-2 text-sm bg-wl-panel-muted p-2 rounded border border-wl-line">
          <span className="font-semibold text-wl-ink">Merge Operations:</span>
          <span className="px-2 py-0.5 bg-wl-panel border border-wl-line rounded text-xs font-mono">
            {Array.isArray(mergePick) && mergePick.length
              ? mergePick.map((id) => unitName(units.find((x: Unit) => x.id === id)?.type ?? '')).join(' + ')
              : 'None selected'}
          </span>
          <button
            className="ml-auto px-3 py-1 bg-wl-accent text-wl-accent-ink rounded disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed text-xs shadow-sm hover:bg-wl-accent/90 transition"
            disabled={!Array.isArray(mergePick) || mergePick.length !== 2}
            onClick={doMergeIfReady}
          >
            Merge Selected
          </button>
        </div>

        {(!Array.isArray(units) || units.length === 0) && (
          <div className="text-center p-8 text-wl-subtle bg-wl-panel-muted rounded italic border border-dashed border-wl-line">
            No units yet. Form one under <b>Form</b> — trained soldiers waiting in the barracks become a unit there.
          </div>
        )}

        <div className="space-y-4">
          {Array.isArray(units) && units.map((u: Unit) => {
            const size = u.buckets.reduce((a, b) => a + b.count, 0)
            const isTraining = !!u.training
            return (
              <div key={u.id} className={`border border-wl-line rounded p-3 bg-wl-panel shadow-sm transition-all ${isTraining ? 'ring-2 ring-wl-warn/50' : ''}`}>
                {/* A unit sheet, not a row of raw fields. The name leads; the internal id
                    (`U_k3f9a`) is a database key and has no business being the headline. */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-wl-line pb-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${isTraining ? 'bg-wl-warn animate-pulse' : 'bg-wl-good'}`} title={isTraining ? 'In training' : 'Ready'} />
                  <h3 className="font-serif font-bold text-lg text-wl-ink">{unitName(u.type)}</h3>
                  <span className="text-sm text-wl-muted">{size} strong</span>
                  <span className="ml-auto text-xs text-wl-subtle font-mono">{u.id}</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-2 text-sm">
                  {u.buckets.map((b) => {
                    // Chevrons say the rank at a glance; the word says it exactly. Rank is
                    // worth +10% attack and +8% defence a step, and the green die first —
                    // it deserves more than a shouted enum in 10px grey.
                    const step = RankNumber[b.r] ?? 0
                    const toNext = PROMOTE_AT[b.r]
                    const pct = toNext ? Math.min(100, Math.round((b.avgXP / toNext) * 100)) : 100
                    return (
                      <div key={b.r} className="px-3 py-2 bg-wl-panel-muted rounded-lg border border-wl-line min-w-[104px]">
                        <div className="flex items-center gap-1 text-wl-accent text-xs" aria-hidden>
                          {step > 0 ? '▲'.repeat(step) : '·'}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-wl-muted">{rankName(b.r)}</div>
                        <div className="font-mono text-lg font-bold text-wl-ink leading-tight">{b.count}</div>
                        <div className="mt-1 h-1 rounded bg-wl-panel overflow-hidden" title={toNext ? `${b.avgXP} of ${toNext} XP to ${rankName(nextRank(b.r) ?? '')}` : 'Highest rank'}>
                          <div className="h-full bg-wl-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between bg-wl-panel-muted p-2 rounded text-xs text-wl-muted">
                  <div>Ready: <span className="font-bold text-wl-ink">{computeReady(u)}</span> / {size}</div>
                  <MissingEquipment unit={u} />
                </div>

                <div className="mt-3 flex items-center gap-4 border-t border-wl-line pt-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${isTraining ? 'bg-wl-warn border-wl-warn' : 'bg-wl-panel border-wl-line group-hover:border-wl-line-strong'}`}>
                      {isTraining && <span className="text-wl-accent-ink text-xs">✓</span>}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isTraining}
                      onChange={() => toggleTraining(u.id)}
                    />
                    <span className={`text-sm font-medium ${isTraining ? 'text-wl-warn' : 'text-wl-muted'}`}>Training Mode (XP++)</span>
                  </label>

                  <div className="ml-auto w-full max-w-[50%]">
                    <SplitMergeControls
                      size={size}
                      onSplit={(n) => doSplit(u.id, n)}
                      selectedForMerge={Array.isArray(mergePick) && mergePick.includes(u.id)}
                      onToggleMergeSelect={() => togglePickForMerge(u.id)}
                    />
                  </div>
                </div>

                {/* Replenish has existed as a finished form and an exported function since
                    a UI refactor dropped it — unreachable code on both sides. With gear now
                    held by the unit, topping up losses is the natural thing to reach for. */}
                <div className="mt-3 border-t border-wl-line pt-3">
                  <ReplenishForm
                    unitId={u.id}
                    unitType={u.type}
                    pool={barracks}
                    inv={inv}
                    wallet={state.wallet}
                    resources={state.resources}
                    onReplenish={(plan, opts) => replenishUnit(u.id, plan, opts)}
                  />
                  <button
                    className="mt-2 px-3 py-1.5 text-xs rounded border border-wl-bad/50 text-wl-bad hover:bg-wl-bad-surface"
                    title="Send these soldiers back to the barracks and their gear back to the stores"
                    onClick={() => {
                      if (confirm(`Disband ${u.id}? The ${size} soldiers return to the barracks and their gear goes back to the stores.`)) {
                        disbandUnit(u.id)
                      }
                    }}
                  >
                    Disband
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}