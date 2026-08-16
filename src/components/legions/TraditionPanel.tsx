import { useState } from 'react'
import type { Unit } from '../../logic/types'
import { fmtCopper } from '../../logic/types'
import type { Legion } from '../../logic/legion'
import {
  availablePoints, channelsOf, describeChannels, describeConstraint, describeNode, growBlocker,
  nodeDepth, outOfKeeping, proofLabel, spentPoints, type GrowCandidate,
} from '../../logic/tradition'
import {
  CONSTRAINT_OPTIONS, DESIGN_MAX_CONSTRAINTS, EFFECT_PRIMS, TIER_LEVEL, sameConstraint,
  type Constraint,
} from '../../logic/traditionPalette'
import { GameConfig } from '../../logic/config'
import { legionLevel } from '../../logic/practice'

// A tradition is founded as a PROMISE and grown one attribute at a time. This panel is
// therefore two screens sharing a card: before the oath it asks what the legion gives up,
// and after it, what the legion has earned the right to become.

interface Props {
  legion: Legion
  cohorts: Unit[]
  wallet: number
  onFound: (name: string, creed: string, constraints: Constraint[]) => void
  onGrow: (want: GrowCandidate) => void
}

export default function TraditionPanel({ legion, cohorts, wallet, onFound, onGrow }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [creed, setCreed] = useState('')
  const [picked, setPicked] = useState<Constraint[]>([])
  const [parentOf, setParentOf] = useState<string | null>(null)

  const design = legion.tradition ?? null
  const practice = legion.practice ?? {}
  const level = legionLevel(practice)
  const rules = GameConfig.traditionRules()

  if (!design) {
    const wins = practice.victories ?? 0
    const why = wins < rules.minHonours
      ? `Needs ${rules.minHonours} victories to its name, has ${wins}`
      : wallet < rules.adoptCostCopper
        ? `Costs ${fmtCopper(rules.adoptCostCopper)} — you have ${fmtCopper(Math.floor(wallet))}`
        : picked.length === 0
          ? 'A tradition must refuse something — pick at least one demand'
          : null

    return (
      <div>
        <button
          className="text-xs underline decoration-dotted text-wl-muted hover:text-wl-ink py-2 -my-1"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Never mind' : 'Found a tradition…'}
        </button>
        {open && (
          <div className="mt-2 space-y-2 rounded border border-wl-line bg-wl-panel-muted p-3">
            <p className="text-[11px] text-wl-muted leading-snug">
              A legion swears <strong>once</strong>, and the oath is permanent. You name it and say
              what it gives up; its attributes are not chosen now — they are earned one at a time,
              as the legion grows into them. Costs {fmtCopper(rules.adoptCostCopper)} and{' '}
              {rules.minHonours} victories. Traditions shape your own campaign; a challenge against
              another player is fought on plain terms.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] bg-wl-panel text-wl-ink grow max-w-xs"
                placeholder="Name of the tradition"
                aria-label="Name of the tradition"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] bg-wl-panel text-wl-ink grow"
                placeholder="Its creed — one line of why, not what"
                aria-label="Creed"
                value={creed}
                onChange={(e) => setCreed(e.target.value)}
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-wl-muted mb-1">
                What it gives up (at most {DESIGN_MAX_CONSTRAINTS})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CONSTRAINT_OPTIONS.map((opt) => {
                  const on = picked.some((c) => sameConstraint(c, opt.value))
                  // One of each KIND — two cohort caps would be one cap and a decoration.
                  const clash = !on && picked.some((c) => c.kind === opt.value.kind)
                  return (
                    <button
                      key={opt.label}
                      disabled={clash || (!on && picked.length >= DESIGN_MAX_CONSTRAINTS)}
                      title={clash ? 'It already demands something of that kind' : undefined}
                      onClick={() => setPicked((p) => on
                        ? p.filter((c) => !sameConstraint(c, opt.value))
                        : [...p, opt.value])}
                      className={`px-2 py-1.5 min-h-[32px] text-xs rounded border ${on
                        ? 'border-wl-accent-line bg-wl-accent-surface text-wl-ink font-semibold'
                        : 'border-wl-line bg-wl-panel text-wl-ink hover:bg-wl-panel-muted'} disabled:text-wl-muted disabled:cursor-not-allowed`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={!!why}
                className="px-3 py-2 min-h-[34px] text-xs rounded bg-wl-accent text-wl-accent-ink font-serif disabled:bg-wl-panel disabled:text-wl-muted disabled:cursor-not-allowed"
                onClick={() => {
                  if (confirm(
                    `Swear ${legion.name} to "${name || legion.name}"?\n\n`
                    + `This is permanent. The only way out is dissolving the legion, which loses every honour it has earned.\n\n`
                    + `${picked.map(describeConstraint).join('\n')}\n\nCost: ${fmtCopper(rules.adoptCostCopper)}`,
                  )) {
                    onFound(name, creed, picked)
                    setOpen(false); setName(''); setCreed(''); setPicked([])
                  }
                }}
              >
                Swear
              </button>
              {/* The refusal belongs next to the button that refused. */}
              {why && <span className="text-[11px] text-wl-bad leading-tight">{why}</span>}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Sworn: the tree it has grown, and what it may take next ──────────────────────────
  const lapsed = outOfKeeping(design, cohorts)
  const left = availablePoints(design, practice) - spentPoints(design)

  return (
    <div className="rounded border border-wl-accent-line bg-wl-accent-surface p-2.5 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-serif font-bold text-wl-ink">🚩 {design.name}</span>
        <span className="text-[11px] text-wl-subtle">sworn day {design.sworeDay || legion.foundedDay}</span>
        <span className="ml-auto text-[11px] text-wl-muted">{left} points to spend</span>
      </div>
      {design.creed && <p className="text-xs text-wl-muted italic leading-snug">{design.creed}</p>}
      <div className="text-[11px] text-wl-muted">
        Gives up {design.constraints.map(describeConstraint).join(' · ')}
      </div>
      {/* The folded total, because the nodes below say what they ADD and these channels
          accumulate — a reader must never have to sum them in their head. */}
      {describeChannels(channelsOf(design)).length > 0 && (
        <div className="text-[11px] text-wl-ink">
          Worth now: {describeChannels(channelsOf(design)).join(' · ')}
        </div>
      )}

      {design.invalid && (
        <div className="text-[11px] text-wl-bad leading-snug">
          This tradition was written by a version of the game that no longer exists, so it does
          nothing at present. It has been kept, not deleted.
        </div>
      )}

      {lapsed && !design.invalid && (
        <div className="text-[11px] text-wl-bad leading-snug">
          Out of keeping: {lapsed}. Everything it has earned sleeps until the legion is put back in shape.
        </div>
      )}

      {design.nodes.length > 0 ? (
        <div className="space-y-0.5">
          {design.nodes.map((n) => (
            <div key={n.id} className="text-[11px] text-wl-ink" style={{ paddingLeft: `${nodeDepth(design, n.id) * 14}px` }}>
              <span className="text-wl-subtle">{nodeDepth(design, n.id) > 0 ? '└ ' : '• '}</span>
              {describeNode(n)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-wl-subtle">Nothing earned yet — a promise and no history.</div>
      )}

      <div className="pt-1.5 border-t border-wl-accent-line">
        <div className="text-[11px] uppercase tracking-wide text-wl-muted mb-1">
          Take up an attribute
          {design.nodes.length > 0 && (
            <>
              {' '}·{' '}
              <button
                className={`underline decoration-dotted py-2 -my-1 ${parentOf === null ? 'text-wl-ink font-semibold' : ''}`}
                onClick={() => setParentOf(null)}
              >
                from the root
              </button>
              {design.nodes.map((n) => (
                <span key={n.id}>
                  {' · '}
                  <button
                    className={`underline decoration-dotted py-2 -my-1 ${parentOf === n.id ? 'text-wl-ink font-semibold' : ''}`}
                    onClick={() => setParentOf(n.id)}
                  >
                    under {n.prim.toLowerCase().replace(/_/g, ' ')}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EFFECT_PRIMS.map((p) => {
            const want: GrowCandidate = { prim: p.id, steps: 1, parent: parentOf }
            const why = growBlocker(design, practice, want)
            const depth = parentOf === null ? 0 : nodeDepth(design, parentOf) + 1
            return (
              <button
                key={p.id}
                disabled={!!why}
                title={why ?? `${p.blurb} Asks ${p.proofPerStep} ${proofLabel(p.proof)} and Level ${TIER_LEVEL[Math.min(depth, TIER_LEVEL.length - 1)]}.`}
                onClick={() => onGrow(want)}
                className="px-2 py-1.5 min-h-[32px] text-xs rounded border border-wl-line bg-wl-panel text-wl-ink hover:bg-wl-panel-muted disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
              >
                {p.name} <span className="text-wl-muted">· {p.points}pt</span>
              </button>
            )
          })}
        </div>
        {/* Every piece refused means the legion has nothing it can take yet — say why, once,
            rather than leaving a row of dead buttons and a tooltip nobody opens. */}
        {EFFECT_PRIMS.every((p) => growBlocker(design, practice, { prim: p.id, steps: 1, parent: parentOf })) && (
          <div className="mt-1 text-[11px] text-wl-bad leading-tight">
            Nothing can be taken here yet. This legion is Level {level}; attributes hang off what it
            has actually done, so fight, garrison, drill or patrol and come back.
          </div>
        )}
      </div>
    </div>
  )
}
