import { useState } from 'react'
import type { Unit } from '../../logic/types'
import type { Difficulty, MissionPreset } from '../../logic/combat/types'
import { fieldedStrength } from '../../logic/combat/army'
import { unitName } from '../../logic/names'
import { escalationMult } from '../../logic/combat/enemies'
import GameIcon from '../common/GameIcon'
import { getIconForGameItem } from '../../logic/iconHelpers'
import { cohortLabel, legionOfUnit, unitsOfLegion, type Legion } from '../../logic/legion'
import { marchBlocker } from '../../logic/duty'

interface Props {
  units: Unit[]
  legions: Legion[]
  difficulty: Difficulty
  preset: MissionPreset
  clears: number
  onConfirm: (ids: string[]) => void
  onBack: () => void
}

export default function DeployPanel({ units, legions, preset, clears, onConfirm, onBack }: Props) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const deployStrength = units.filter((u) => picked.includes(u.id)).reduce((a, u) => a + fieldedStrength(u), 0)
  // Same escalation the actual army generator applies — the estimate must not undersell.
  const estEnemy = Math.round(deployStrength * preset.ratio * escalationMult(clears))

  // A legion exists so it can march as one. Picking its cohorts one by one would make the
  // formation a label rather than a thing you command.
  const marchable = legions
    .map((l) => ({ legion: l, ids: unitsOfLegion(l, units).map((u) => u.id) }))
    .filter((x) => x.ids.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold">Deploy for {preset.name}</h3>
        <button onClick={onBack} className="px-3 py-1 border border-wl-line rounded text-sm">← Missions</button>
      </div>

      {marchable.length > 0 && (
        <div className="rounded-lg border border-wl-line bg-wl-panel-muted p-3">
          <div className="text-xs uppercase tracking-wide text-wl-muted mb-2">Call up a legion</div>
          <div className="flex flex-wrap gap-2">
            {marchable.map(({ legion, ids }) => {
              const all = ids.every((id) => picked.includes(id))
              const busy = marchBlocker(legion.duty, legion.name)
              return (
                <button
                  key={legion.id}
                  disabled={!!busy}
                  title={busy ? `${busy} — stand it down in the Legions section first` : undefined}
                  onClick={() => setPicked((p) => all
                    ? p.filter((id) => !ids.includes(id))
                    : [...p, ...ids.filter((id) => !p.includes(id))])}
                  className={`px-3 py-2 min-h-[34px] text-sm rounded border font-serif ${all
                    ? 'bg-wl-accent text-wl-accent-ink border-wl-accent'
                    : 'bg-wl-panel border-wl-line text-wl-ink hover:bg-wl-panel-muted'} disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed`}
                >
                  {legion.name} <span className="text-xs opacity-80">({ids.length})</span>
                </button>
              )
            })}
          </div>
          {/* The refusal belongs where you press, not in the Log you have to go and find. */}
          <div className="mt-1.5 space-y-0.5">
            {marchable
              .map(({ legion }) => marchBlocker(legion.duty, legion.name))
              .filter((x): x is string => !!x)
              .map((why) => (
                <div key={why} className="text-[11px] text-wl-bad leading-tight">{why} — stand it down to march.</div>
              ))}
          </div>
        </div>
      )}

      {units.length === 0 ? (
        <p className="text-sm text-wl-muted">You have no formed units. Create units in the Units tab before marching to battle.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {units.map((u) => {
            const size = u.buckets.reduce((a, b) => a + b.count, 0)
            const on = picked.includes(u.id)
            // Disabling the legion button alone would leave the cohorts pickable one by
            // one — `startBattle` refuses that, but only into the Log, which is the one
            // place a refusal must never live.
            const ownLegion = legionOfUnit(legions, u.id)
            const busy = ownLegion ? marchBlocker(ownLegion.duty, ownLegion.name) : null
            return (
              <button
                key={u.id}
                disabled={!!busy}
                title={busy ?? undefined}
                onClick={() => toggle(u.id)}
                // NOT `disabled:opacity-60`: opacity composites the text down with the
                // card, and it took "· on duty" — the one word that explains the refusal —
                // to 3.09:1 in light. Disabled is carried by the surface and the cursor;
                // the words keep their own contrast.
                className={`flex items-center gap-3 border border-wl-line rounded-lg p-2 text-left transition-all ${on ? 'ring-2 ring-wl-accent bg-wl-accent-surface' : 'bg-wl-panel hover:bg-wl-panel-muted'} disabled:bg-wl-panel-muted disabled:cursor-not-allowed disabled:hover:bg-wl-panel-muted`}
              >
                <GameIcon name={getIconForGameItem(u.type) || 'sword'} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{unitName(u.type)}</div>
                  {ownLegion && (
                    <div className="text-[11px] truncate">
                      <span className="text-wl-subtle">{cohortLabel(ownLegion, units, u.id)} · {ownLegion.name}</span>
                      {busy && <span className="text-wl-bad"> · on duty</span>}
                    </div>
                  )}
                  <div className="text-xs text-wl-muted font-mono">{size} soldiers · morale {Math.round(u.morale ?? 100)} · fielded {fieldedStrength(u)}</div>
                </div>
                <span className={`w-4 h-4 rounded border border-wl-line flex items-center justify-center text-[10px] ${on ? 'bg-wl-accent text-wl-accent-ink' : 'bg-wl-panel'}`}>{on ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-wl-line pt-3">
        <div className="text-sm text-wl-muted">
          Deploying <span className="font-mono font-bold">{picked.length}</span> units ·
          strength <span className="font-mono font-bold">{deployStrength}</span> ·
          est. enemy <span className="font-mono font-bold text-wl-bad">≈{estEnemy}</span>
        </div>
        <button
          disabled={picked.length === 0}
          onClick={() => onConfirm(picked)}
          className={`px-4 py-2 rounded ${picked.length ? 'bg-wl-bad text-wl-inverse hover:opacity-90' : 'bg-wl-panel-muted text-wl-subtle cursor-not-allowed'}`}
        >
          March to battle ⚔
        </button>
      </div>
    </div>
  )
}
