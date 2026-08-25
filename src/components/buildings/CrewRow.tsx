import { crewLine, describeRecord, fillPlan, staffMultWith, type PopulationState } from '../../logic/population'
import type { Building } from '../../logic/types'

// The one control that posts hands, rendered in both places a building is looked at (the
// card in Buildings and the slab in the production modal). One component so the two cannot
// come to disagree about when it appears or what it refuses.

interface Props {
  building: Building
  population: PopulationState
  /** The reason this move is refused, from the state. `null` = allowed. */
  whyNot: (delta: number) => string | null
  onAssign: (delta: number) => void
  /** The modal's slab is dark in both themes and needs its own ink. */
  contrast?: boolean
  idle: number
}

export default function CrewRow({ building, population, whyNot, onAssign, contrast, idle }: Props) {
  const { crew, hands, mult, has, level, days, nextAt, record } = crewLine(building, population)
  // Rendered only where there IS a crew. Inside the `hasNoItemToMake` guard the Minter — a
  // crew of 16 and the second largest in the game — would have no control at all; without
  // any guard the barracks, market, stable and scriptorium each get a row that can only
  // ever refuse.
  if (!has) return null

  const ink = contrast ? 'text-wl-contrast-ink' : 'text-wl-ink'
  const dim = contrast ? 'text-wl-contrast-ink/60' : 'text-wl-muted'
  const btn = contrast
    ? 'border-wl-contrast-ink/30 bg-black/30 text-wl-contrast-ink hover:bg-black/50'
    : 'border-wl-line bg-wl-panel-muted text-wl-ink hover:bg-wl-panel'

  const step = (delta: number) => {
    const why = whyNot(delta)
    return (
      <button
        type="button"
        disabled={!!why}
        title={why ?? (delta > 0 ? 'Post a hand here' : 'Take a hand off')}
        aria-label={`${delta > 0 ? 'Post' : 'Take off'} a hand at the ${building.type.replace(/_/g, ' ').toLowerCase()}`}
        onClick={() => onAssign(delta)}
        className={`px-2 min-w-[28px] min-h-[28px] text-xs rounded border font-mono disabled:opacity-100 disabled:cursor-not-allowed ${
          why ? `${dim} ${contrast ? 'border-wl-contrast-ink/15 bg-black/10' : 'border-wl-line bg-wl-panel'}` : btn
        }`}
      >
        {delta > 0 ? '+' : '−'}
      </button>
    )
  }

  const full = hands >= crew
  // The largest press this house will accept right now, decided by the SAME oracle the single
  // steps use — never by a rule of its own. `why` is set only when it must stop short.
  const plan = fillPlan(crew - hands, idle, whyNot)
  // Priced by the function the day itself runs, so the card cannot promise what the tick will
  // not pay. This is the whole point of the row: an empty house says 1.00 and looks harmless.
  const after = plan.n > 0 ? staffMultWith(building, population, hands + plan.n) : mult
  // A crew's level is its own, not the building's — a mine knows its seams even after the
  // hands come off, which is why the badge stays when `hands` is 0.
  const skill = level > 1
    ? `Crew L${level}`
    : null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`text-[11px] uppercase tracking-wide ${dim}`}>Crew</span>
      {step(-1)}
      <span className={`font-mono text-xs ${ink}`}>{hands}/{crew}</span>
      {step(1)}
      {!full && (
        <button
          type="button"
          disabled={!plan.n}
          title={plan.why ?? `Post ${plan.n} here`}
          aria-label={`Post ${plan.n} hands at the ${building.type.replace(/_/g, ' ').toLowerCase()}`}
          onClick={() => onAssign(plan.n)}
          className={`px-2 min-h-[28px] text-[11px] rounded border font-mono disabled:cursor-not-allowed ${
            plan.n ? btn : `${dim} ${contrast ? 'border-wl-contrast-ink/15 bg-black/10' : 'border-wl-line bg-wl-panel'}`
          }`}
        >
          {/* The COUNT is on the button. Posting six when nine are free has to be a stated act,
              not a silent clamp discovered afterwards. */}
          Post {plan.n || Math.max(0, Math.min(crew - hands, idle))}
        </button>
      )}
      {skill && (
        <span
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
            contrast ? 'bg-black/30 text-wl-contrast-ink' : 'bg-wl-panel-muted text-wl-ink'
          }`}
          title={`${days} days worked here${nextAt !== null ? ` · next level at ${nextAt}` : ' · nothing left to learn'}`}
        >
          {skill}
        </span>
      )}
      <span className={`text-[11px] ${dim}`}>
        {mult > 1 ? `×${mult.toFixed(2)} the day` : 'nobody working — ×1.00'}
        {plan.n > 0 && after > mult ? ` → ×${after.toFixed(2)} with ${plan.n} more` : ''}
        {full ? ' · fully crewed' : ` · ${idle} free`}
        {level === 1 && nextAt !== null && days > 0 ? ` · ${days}/${nextAt} days to L2` : ''}
      </span>
      {/* A partial fill has to SAY so, here rather than in a `title`: the game ships inside a
          Capacitor app, where a tooltip never fires at all. */}
      {plan.why && plan.n > 0 && (
        <span role="status" className="basis-full text-[11px] text-wl-bad-ink">{plan.why}</span>
      )}
      {/* The house's account of itself. Shares, not totals: a total only says how long you
          have been playing, and shares of one day are rival with each other. */}
      <span className={`basis-full text-[11px] ${dim}`}>
        {record.days > 0 ? describeRecord(record) : 'this house keeps no account yet — its books open the first day a crew works it'}
      </span>
    </div>
  )
}
