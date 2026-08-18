import { useMemo, useState } from 'react'
import {
  CRAFT_CREED_MAX, CRAFT_NAME_MAX, availableCraftPoints, channelsOf, contextFor, craftAt,
  craftFaults, describeChannels, describeDemand, describeNode, outOfKeeping, sharesOf,
  spentPoints, standingOf, swornAt, validateDesign, type CraftDesign,
} from '../../logic/craft'
import {
  CRAFT_PCT_OPTIONS, CRAFT_PRIMS, primNumbers, rebateOf, type CraftDemand,
} from '../../logic/craftPalette'
import { crewSizeOf, emptyRecord, recordAt, type PopulationState } from '../../logic/population'
import { hasNoItemToMake } from '../../logic/economy'
import type { Building } from '../../logic/types'

// The one permanent act in the domain. Everything on this panel is arranged so the player
// can see what they are giving up BEFORE it stops being undoable — the budget is the sum of
// the demands, live, so "every point comes from a freedom" is a thing you watch happen
// rather than a rule you are told.

interface Props {
  building: Building
  population: PopulationState
  buildings: Building[]
  onSwear: (design: CraftDesign) => void
}

const DEMAND_KINDS: { kind: CraftDemand['kind']; label: string; unit: 'pct' | 'hands' }[] = [
  { kind: 'CAP_COIN', label: 'Cap coin at', unit: 'pct' },
  { kind: 'CAP_STUDY', label: 'Cap study at', unit: 'pct' },
  { kind: 'MIN_GOODS', label: 'Always leave for goods', unit: 'pct' },
  { kind: 'MIN_HANDS', label: 'Always work with at least', unit: 'hands' },
  { kind: 'MAX_HANDS', label: 'Never work with more than', unit: 'hands' },
]

export default function CraftPanel({ building, population, buildings, onSwear }: Props) {
  const crew = crewSizeOf(building.type)
  const noItem = hasNoItemToMake(building.type)
  const sworn = craftAt(population, building)

  const [name, setName] = useState('')
  const [creed, setCreed] = useState('')
  const [demands, setDemands] = useState<CraftDemand[]>([])
  const [nodes, setNodes] = useState<{ prim: string; steps: number }[]>([])

  const ctx = useMemo(
    () => contextFor(building, noItem),
    [building, noItem],
  )

  if (crew <= 0) return null

  // ── Already sworn ───────────────────────────────────────────────────────────────────
  if (sworn) {
    const fault = craftFaults(sworn)
    const asleep = fault ? null : outOfKeeping(sworn, building, population, buildings, noItem)
    const since = recordAt(population, building)
    const at = swornAt(population, building) ?? emptyRecord()
    const delta = {
      ...emptyRecord(),
      days: since.days - at.days,
      coinVal: since.coinVal - at.coinVal,
      goodsVal: since.goodsVal - at.goodsVal,
      studyVal: since.studyVal - at.studyVal,
      daysFull: since.daysFull - at.daysFull,
      daysLean: since.daysLean - at.daysLean,
    }
    const sh = sharesOf(delta)
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[11px] uppercase tracking-wide text-wl-contrast-ink/60">Sworn</span>
          <span className="text-sm font-serif font-bold text-wl-contrast-ink">{sworn.name}</span>
          <span className="px-1.5 py-0.5 rounded bg-black/30 text-wl-contrast-ink font-mono text-[11px]">
            {standingOf(population, building)} kept
          </span>
        </div>
        {sworn.creed && <p className="text-[11px] text-wl-contrast-ink/60 italic">{sworn.creed}</p>}
        <div className="text-[11px] text-wl-contrast-ink">
          Gives {describeChannels(channelsOf(sworn))} · Takes {sworn.demands.map(describeDemand).join(' · ')}
        </div>
        {fault
          ? <div className="text-[11px] text-red-300">{fault}</div>
          : asleep
            ? <div className="text-[11px] text-red-300">Asleep — {asleep}</div>
            : (
              <div className="text-[11px] text-wl-contrast-ink/60">
                Since the oath: {sh.days} {sh.days === 1 ? 'day' : 'days'} · {sh.coinShare}% coin
                {' '}· {sh.fullShare}% fully crewed · {sh.leanShare}% lean
              </div>
            )}
      </div>
    )
  }

  // ── Not yet sworn ───────────────────────────────────────────────────────────────────
  const design: CraftDesign = {
    v: 1, name, creed, sworeDay: 0, demands,
    nodes: nodes.map((n, i) => ({ id: `n${i}`, parent: null, prim: n.prim, steps: n.steps })),
  }
  const budget = availableCraftPoints(design, ctx)
  const spent = spentPoints(design)
  const check = validateDesign(design, ctx)

  const toggleDemand = (kind: CraftDemand['kind'], value: number) => {
    setDemands((ds) => {
      const without = ds.filter((d) => d.kind !== kind)
      if (value < 0) return without
      return [...without, (kind === 'MIN_HANDS' || kind === 'MAX_HANDS'
        ? { kind, hands: value }
        : { kind, pct: value }) as CraftDemand]
    })
  }

  const stepNode = (prim: string, delta: number) => {
    setNodes((ns) => {
      const found = ns.find((n) => n.prim === prim)
      const max = CRAFT_PRIMS.find((p) => p.id === prim)?.maxSteps ?? 1
      if (!found) return delta > 0 ? [...ns, { prim, steps: 1 }] : ns
      const steps = found.steps + delta
      if (steps <= 0) return ns.filter((n) => n.prim !== prim)
      return ns.map((n) => (n.prim === prim ? { ...n, steps: Math.min(max, steps) } : n))
    })
  }

  return (
    <div className="space-y-2 pt-3 mt-1 border-t border-wl-contrast-ink/15">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] uppercase tracking-wide text-wl-contrast-ink/60">Swear a craft</span>
        <span className={`font-mono text-[11px] ${spent > budget ? 'text-red-300' : 'text-wl-contrast-ink'}`}>
          {spent}/{budget} points
        </span>
        <span className="text-[11px] text-wl-contrast-ink/60">
          — every point comes from something given up, for good
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="border border-wl-contrast-ink/25 rounded px-2 py-1 min-h-[30px] bg-black/25 text-wl-contrast-ink text-xs grow max-w-[200px]"
          aria-label="Name this craft" placeholder="Name this craft"
          maxLength={CRAFT_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border border-wl-contrast-ink/25 rounded px-2 py-1 min-h-[30px] bg-black/25 text-wl-contrast-ink text-xs grow"
          aria-label="Its creed" placeholder="Its creed"
          maxLength={CRAFT_CREED_MAX} value={creed} onChange={(e) => setCreed(e.target.value)}
        />
      </div>

      {/* What it gives up. The rebate is shown per demand, so the trade is legible. */}
      {DEMAND_KINDS.filter((d) => !(d.kind === 'CAP_COIN' && noItem)).map(({ kind, label, unit }) => {
        const cur = demands.find((d) => d.kind === kind)
        const options = unit === 'pct'
          ? CRAFT_PCT_OPTIONS as readonly number[]
          : Array.from({ length: crew }, (_, i) => i + 1)
        const value = cur ? ('pct' in cur ? cur.pct : cur.hands) : -1
        return (
          <div key={kind} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-wl-contrast-ink/60 min-w-[150px]">{label}</span>
            <button
              type="button" onClick={() => toggleDemand(kind, -1)}
              className={`px-2 min-h-[26px] text-[11px] rounded border ${value < 0 ? 'border-wl-contrast-ink/50 bg-black/40 text-wl-contrast-ink' : 'border-wl-contrast-ink/15 text-wl-contrast-ink/60'}`}
            >—</button>
            {options.map((o) => (
              <button
                key={o} type="button" onClick={() => toggleDemand(kind, o)}
                className={`px-2 min-h-[26px] text-[11px] rounded border font-mono ${value === o ? 'border-wl-contrast-ink/50 bg-black/40 text-wl-contrast-ink' : 'border-wl-contrast-ink/15 text-wl-contrast-ink/60'}`}
              >{o}{unit === 'pct' ? '%' : ''}</button>
            ))}
            {cur && (
              <span className="text-[11px] text-wl-good font-mono">+{rebateOf(cur, ctx)}</span>
            )}
          </div>
        )
      })}

      {/* What it buys. */}
      <div className="space-y-1 pt-1">
        {CRAFT_PRIMS.map((p) => {
          const taken = nodes.find((n) => n.prim === p.id)
          const { step, points } = primNumbers(p)
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-1.5">
              <button
                type="button" onClick={() => stepNode(p.id, -1)} disabled={!taken}
                className="px-2 min-w-[26px] min-h-[26px] text-[11px] rounded border border-wl-contrast-ink/25 bg-black/30 text-wl-contrast-ink disabled:opacity-100 disabled:text-wl-contrast-ink/30 disabled:cursor-not-allowed font-mono"
              >−</button>
              <span className="font-mono text-[11px] text-wl-contrast-ink min-w-[24px] text-center">{taken?.steps ?? 0}</span>
              <button
                type="button" onClick={() => stepNode(p.id, 1)} disabled={(taken?.steps ?? 0) >= p.maxSteps}
                className="px-2 min-w-[26px] min-h-[26px] text-[11px] rounded border border-wl-contrast-ink/25 bg-black/30 text-wl-contrast-ink disabled:opacity-100 disabled:text-wl-contrast-ink/30 disabled:cursor-not-allowed font-mono"
              >+</button>
              <span className="text-[11px] text-wl-contrast-ink">{p.name}</span>
              <span className="text-[11px] text-wl-contrast-ink/60">
                +{Math.round(step * 100)}% coin a step · {points} points · {p.blurb}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button" disabled={!check.ok}
          onClick={() => { onSwear(design); setName(''); setCreed(''); setDemands([]); setNodes([]) }}
          className="px-2 py-1.5 min-h-[30px] text-xs rounded border border-wl-contrast-ink/30 bg-black/35 text-wl-contrast-ink hover:bg-black/55 disabled:text-wl-contrast-ink/40 disabled:cursor-not-allowed"
        >
          Swear it — for good
        </button>
        {nodes.length > 0 && (
          <span className="text-[11px] text-wl-contrast-ink/60">
            {design.nodes.map(describeNode).join(' · ')} → {describeChannels(channelsOf(design))}
          </span>
        )}
      </div>
      {/* Every reason, at the control that refused — never only in the Log. */}
      {!check.ok && (
        <ul className="text-[11px] text-red-300 leading-tight space-y-0.5">
          {check.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
    </div>
  )
}
