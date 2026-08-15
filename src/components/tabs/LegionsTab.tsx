import { useState } from 'react'
import type { GameStateShape } from '../../state/useGameState'
import {
  LEGION_MAX_UNITS, cohortLabel, joinBlocker, legionOfUnit, suggestLegionName, unitsOfLegion,
} from '../../logic/legion'
import { unitName } from '../../logic/names'
import { armyStrength } from '../../logic/combat/army'

// A legion is a FORMATION that holds units. It is what carries the name, the record, and
// (later) the traditions — the cohorts inside it come and go, the legion does not.

export default function LegionsTab({ state }: { state: GameStateShape }) {
  const { legions, units, formLegion, renameLegion, assignToLegion, removeFromLegion, disbandLegion } = state

  // `null` means "show the live suggestion". It has to be nullable rather than a plain
  // string: every Army section stays MOUNTED so typed input survives navigation, so a
  // field seeded once with a suggestion would still hold the old name after raising a
  // legion — and the next press would raise a second one with the same name.
  const [draftName, setDraftName] = useState<string | null>(null)
  const suggestion = suggestLegionName(legions.map((l) => l.name))
  const nameValue = draftName ?? suggestion

  const unattached = units.filter((u) => !legionOfUnit(legions, u.id))

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-wl-line bg-wl-panel p-4 space-y-3">
        <div>
          <div className="font-serif font-bold text-lg text-wl-ink">Raise a legion</div>
          <p className="text-xs text-wl-muted mt-0.5">
            A legion holds up to {LEGION_MAX_UNITS} cohorts and marches as one. Its cohorts
            will be replaced many times; the legion is what remembers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col grow max-w-sm">
            <label className="text-sm font-medium" htmlFor="legion-name">Name</label>
            <input
              id="legion-name"
              className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] bg-wl-panel-muted text-wl-ink"
              value={nameValue}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>
          <button
            className="px-4 py-2 min-h-[38px] rounded bg-wl-accent text-wl-accent-ink font-serif"
            onClick={() => { formLegion(nameValue); setDraftName(null) }}
          >
            Raise
          </button>
        </div>
      </div>

      {legions.length === 0 ? (
        <p className="text-sm text-wl-muted">
          No legions yet. Raise one above, then assign the units you have formed to it.
        </p>
      ) : (
        legions.map((l) => {
          const cohorts = unitsOfLegion(l, units)
          const strength = armyStrength(units, l.unitIds)
          return (
            <div key={l.id} className="rounded-lg border border-wl-line bg-wl-panel p-4 space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-wl-line pb-2">
                <input
                  // Padded to a real tap target: it renders as a title, but it IS the
                  // rename field, and a 29px-high input is not something a thumb can hit.
                  className="font-serif font-bold text-lg text-wl-ink bg-transparent border-b border-dashed border-wl-line focus:border-wl-accent outline-none min-w-0 grow max-w-xs py-1 min-h-[34px]"
                  value={l.name}
                  aria-label={`Name of ${l.name}`}
                  onChange={(e) => renameLegion(l.id, e.target.value)}
                />
                <span className="text-sm text-wl-muted">
                  {cohorts.length} / {LEGION_MAX_UNITS} cohorts · fields {strength}
                </span>
                <span className="ml-auto text-xs text-wl-subtle">Raised day {l.foundedDay}</span>
              </div>

              {l.honours.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {l.honours.map((h) => (
                    <span
                      key={h.key}
                      title={`First earned on day ${h.firstDay}`}
                      className="text-xs px-2 py-0.5 rounded-full border border-wl-accent-line bg-wl-accent-surface text-wl-ink"
                    >
                      {h.label}{h.count > 1 ? ` ×${h.count}` : ''}
                    </span>
                  ))}
                </div>
              )}

              {cohorts.length === 0 ? (
                <p className="text-xs text-wl-muted">
                  No cohorts yet — this legion exists on paper only.
                </p>
              ) : (
                <div className="space-y-1">
                  {cohorts.map((u) => (
                    <div key={u.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-mono text-xs text-wl-subtle w-20 shrink-0">
                        {cohortLabel(l, units, u.id)}
                      </span>
                      <span className="text-wl-ink">{unitName(u.type)}</span>
                      <span className="text-xs text-wl-muted">
                        {u.buckets.reduce((a, b) => a + b.count, 0)} men
                      </span>
                      <button
                        className="ml-auto text-xs underline decoration-dotted text-wl-muted hover:text-wl-ink py-2 -my-2"
                        onClick={() => removeFromLegion(l.id, u.id)}
                      >
                        detach
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unattached.length > 0 && (
                <div className="pt-2 border-t border-wl-line">
                  <div className="text-xs uppercase tracking-wide text-wl-muted mb-1">Assign a cohort</div>
                  <div className="flex flex-wrap gap-2">
                    {unattached.map((u) => {
                      const why = joinBlocker(l, u.id, units, legions)
                      return (
                        <button
                          key={u.id}
                          disabled={!!why}
                          title={why ?? `Assign to ${l.name}`}
                          onClick={() => assignToLegion(l.id, u.id)}
                          className="px-2 py-1.5 min-h-[32px] text-xs rounded border border-wl-line bg-wl-panel-muted text-wl-ink hover:bg-wl-panel disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
                        >
                          + {unitName(u.type)}
                        </button>
                      )
                    })}
                  </div>
                  {/* The refusal has to be here, not in the Log — the cap is the only thing
                      that stops a legion being unfieldable, so it must say so where you press. */}
                  {unattached.every((u) => joinBlocker(l, u.id, units, legions)) && (
                    <div className="mt-1 text-[11px] text-wl-bad leading-tight">
                      {joinBlocker(l, unattached[0].id, units, legions)}
                    </div>
                  )}
                </div>
              )}

              <div>
                <button
                  className="px-3 py-2 min-h-[34px] text-xs rounded border border-wl-bad/50 text-wl-bad hover:bg-wl-bad-surface"
                  onClick={() => {
                    const n = unitsOfLegion(l, units).length
                    if (confirm(`Dissolve ${l.name}? Its ${n} cohort${n === 1 ? '' : 's'} survive and stand unattached, but the legion's record is lost.`)) {
                      disbandLegion(l.id)
                    }
                  }}
                >
                  Dissolve legion
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
