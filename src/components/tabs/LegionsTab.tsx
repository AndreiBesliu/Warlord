import { useState } from 'react'
import type { GameStateShape } from '../../state/useGameState'
import {
  LEGION_MAX_UNITS, cohortLabel, joinBlocker, legionOfUnit, suggestLegionName, unitsOfLegion,
} from '../../logic/legion'
import {
  TRADITIONS, adoptBlocker, describeTradition, outOfKeeping, traditionById, victoryCount,
} from '../../logic/tradition'
import { GameConfig } from '../../logic/config'
import { deedLabel, legionLevel, nextLevelAt, type DeedKey, type DeedLedger } from '../../logic/practice'
import { DUTIES, dutyBlocker, dutyById, dutyCostCopper } from '../../logic/duty'
import { unitName } from '../../logic/names'
import { fmtCopper } from '../../logic/types'
import { armyStrength } from '../../logic/combat/army'

// A legion is a FORMATION that holds units. It is what carries the name, the record, and
// (later) the traditions — the cohorts inside it come and go, the legion does not.

// The record, written the way a herald would read it: only what happened, in a fixed order
// so a legion's line does not reshuffle between battles.
const DEED_ORDER: DeedKey[] = [
  'battles', 'victories', 'defeats', 'flawless', 'heldTheLine', 'hardWon',
  'slain', 'slainMounted', 'slainArcher', 'slainHeavyFoot', 'promotions', 'retreats',
  'daysGarrisoned', 'daysDrilled', 'daysPatrolled',
]
function deedLines(d: DeedLedger): string[] {
  return DEED_ORDER.filter((k) => (d[k] ?? 0) > 0).map((k) => `${d[k]} ${deedLabel(k, d[k] as number)}`)
}

export default function LegionsTab({ state }: { state: GameStateShape }) {
  const {
    legions, units, wallet,
    formLegion, renameLegion, assignToLegion, removeFromLegion, disbandLegion, adoptTradition,
    setLegionDuty,
  } = state
  // Which legion has its oath list open. One id, not a set: swearing is a decision you make
  // for one legion at a time, and four traditions unfolded under every legion at once is a
  // page nobody can read.
  const [swearingFor, setSwearingFor] = useState<string | null>(null)

  // `null` means "show the live suggestion". It has to be nullable rather than a plain
  // string: every Army section stays MOUNTED so typed input survives navigation, so a
  // field seeded once with a suggestion would still hold the old name after raising a
  // legion — and the next press would raise a second one with the same name.
  const [draftName, setDraftName] = useState<string | null>(null)
  const suggestion = suggestLegionName(legions.map((l) => l.name))
  const nameValue = draftName ?? suggestion

  const unattached = units.filter((u) => !legionOfUnit(legions, u.id))
  const rules = GameConfig.traditionRules()

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
          const sworn = traditionById(l.tradition)
          const lapsed = outOfKeeping(sworn, cohorts)
          const onDuty = dutyById(l.duty)
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

              {/* Level and record. A legion that has done nothing says so plainly rather
                  than showing an empty row — "no record yet" is information. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="px-2 py-0.5 rounded bg-wl-panel-muted text-wl-ink font-mono text-sm font-bold">
                  Level {legionLevel(l.practice ?? {})}
                </span>
                {nextLevelAt(l.practice ?? {}) ? (
                  <span className="text-[11px] text-wl-muted">
                    {nextLevelAt(l.practice ?? {})!.need} renown to Level {nextLevelAt(l.practice ?? {})!.level}
                  </span>
                ) : (
                  <span className="text-[11px] text-wl-muted">at the height of its renown</span>
                )}
                {deedLines(l.practice ?? {}).length > 0 ? (
                  <span className="text-[11px] text-wl-muted">· {deedLines(l.practice ?? {}).join(' · ')}</span>
                ) : (
                  <span className="text-[11px] text-wl-subtle">· no record yet — it has not taken the field</span>
                )}
              </div>

              {/* Duty. Battles buy depth, duties buy direction — and the occupation is the
                  price, so it is said on the control rather than discovered at the muster. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-wl-muted">Duty</span>
                {[null, ...DUTIES].map((d) => {
                  const active = (l.duty ?? null) === (d?.id ?? null)
                  const men = cohorts.reduce((a, u) => a + u.buckets.reduce((x, b) => x + b.count, 0), 0)
                  const why = d ? dutyBlocker(cohorts.length) : null
                  const bill = d ? dutyCostCopper(d, men) : 0
                  return (
                    <button
                      key={d?.id ?? 'READY'}
                      disabled={!!why}
                      title={why ?? (d ? `${d.blurb} ${d.effect}` : 'Free to march')}
                      onClick={() => setLegionDuty(l.id, d?.id ?? null)}
                      className={`px-2 py-1.5 min-h-[32px] text-xs rounded border ${
                        active
                          ? 'border-wl-accent-line bg-wl-accent-surface text-wl-ink font-semibold'
                          : 'border-wl-line bg-wl-panel-muted text-wl-ink hover:bg-wl-panel'
                      } disabled:text-wl-muted disabled:cursor-not-allowed`}
                    >
                      {d ? d.name : 'Ready'}
                      {d && men > 0 && (
                        <span className="text-wl-muted"> · {bill >= 0 ? `${fmtCopper(bill)}/day` : `+${fmtCopper(-bill)}/day`}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {onDuty && (
                <div className="text-[11px] text-wl-muted leading-snug">
                  {onDuty.effect} <span className="text-wl-bad">It cannot march while on duty.</span>
                </div>
              )}
              {cohorts.length === 0 && (
                <div className="text-[11px] text-wl-subtle">A legion with no cohorts has nobody to send.</div>
              )}

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

              {sworn ? (
                <div className="rounded border border-wl-accent-line bg-wl-accent-surface p-2.5 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-serif font-bold text-wl-ink">🚩 {sworn.name}</span>
                    {/* `||`, not `??`: an unsworn legion carries 0 here, not undefined. */}
                    <span className="text-[11px] text-wl-subtle">sworn day {l.traditionDay || l.foundedDay}</span>
                  </div>
                  <p className="text-xs text-wl-muted italic leading-snug">{sworn.creed}</p>
                  <div className="text-[11px] text-wl-muted">
                    Takes {describeTradition(sworn).refuses} · Gives {describeTradition(sworn).gives}
                  </div>
                  {lapsed && (
                    // Not a punishment and not a revocation — the oath holds, the bonus
                    // sleeps. Says the real numbers, because "out of keeping" on its own is
                    // a riddle rather than an instruction.
                    <div className="text-[11px] text-wl-bad leading-snug pt-0.5">
                      Out of keeping: {lapsed}. Its bonus sleeps until the legion is put back in shape.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <button
                    className="text-xs underline decoration-dotted text-wl-muted hover:text-wl-ink py-2 -my-1"
                    onClick={() => setSwearingFor(swearingFor === l.id ? null : l.id)}
                  >
                    {swearingFor === l.id ? 'Never mind' : 'Swear a tradition…'}
                  </button>
                  {swearingFor === l.id && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] text-wl-muted leading-snug">
                        A legion swears <strong>once</strong>, and the oath is permanent — only
                        dissolving the legion ends it, and that loses its whole record. Costs{' '}
                        {fmtCopper(rules.adoptCostCopper)} and {rules.minHonours} victories
                        (this one has {victoryCount(l.honours)}).
                        {' '}Traditions shape campaign battles; a challenge against another player is fought on plain terms.
                      </p>
                      {TRADITIONS.map((def) => {
                        const why = adoptBlocker(l, def, cohorts, wallet)
                        const d = describeTradition(def)
                        return (
                          <div key={def.id} className="rounded border border-wl-line bg-wl-panel-muted p-2.5">
                            <div className="font-serif font-bold text-sm text-wl-ink">{def.name}</div>
                            <p className="text-xs text-wl-muted italic leading-snug mt-0.5">{def.creed}</p>
                            {/* The label/value split is carried by letter-spacing and case,
                                not by a dimmer colour — the same treatment as "ASSIGN A
                                COHORT" below. A third grey here measured 3.95:1 in dark. */}
                            <div className="text-[11px] text-wl-muted mt-1 space-y-0.5">
                              <div><span className="uppercase tracking-wide">Takes</span> {d.refuses}</div>
                              {/* Hidden rather than shown as a dash: a tradition with no
                                  standing requirement has nothing to say here, and an empty
                                  row reads as a missing value. */}
                              {d.keeps !== '—' && <div><span className="uppercase tracking-wide">Keeps</span> {d.keeps}</div>}
                              <div><span className="uppercase tracking-wide">Gives</span> {d.gives}</div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                disabled={!!why}
                                className="px-3 py-1.5 min-h-[32px] text-xs rounded bg-wl-accent text-wl-accent-ink font-serif disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
                                onClick={() => {
                                  const short = outOfKeeping(def, cohorts)
                                  if (confirm(
                                    `Swear ${l.name} to ${def.name}?\n\n`
                                    + `This is permanent. The only way out is dissolving the legion, which loses every honour it has earned.\n\n`
                                    + `Takes: ${d.refuses}\nKeeps: ${d.keeps}\nGives: ${d.gives}\nCost: ${fmtCopper(rules.adoptCostCopper)}`
                                    + (short ? `\n\nIt will start OUT OF KEEPING (${short}), so the bonus sleeps until you fix that.` : ''),
                                  )) {
                                    adoptTradition(l.id, def.id)
                                    setSwearingFor(null)
                                  }
                                }}
                              >
                                Swear
                              </button>
                              {/* The refusal belongs next to the button that refused, not in the Log. */}
                              {why && <span className="text-[11px] text-wl-bad leading-tight">{why}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
