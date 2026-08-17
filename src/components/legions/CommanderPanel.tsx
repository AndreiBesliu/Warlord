import { useState } from 'react'
import { fmtCopper } from '../../logic/types'
import type { Legion } from '../../logic/legion'
import {
  COMMANDER_NAME_MAX, appointBlocker, commanderRank, describeTrait, suggestCommanderName,
  traitById, traitFor, transferBlocker,
} from '../../logic/commander'
import { GameConfig } from '../../logic/config'

// The commander is the one part of a legion that can be MOVED. Everything on this card is
// arranged around that: who he is, what the legion made him, and where else he could go.

interface Props {
  legion: Legion
  cohortCount: number
  wallet: number
  /** Every other legion, for the one decision this feature exists to create. */
  others: { legion: Legion; cohortCount: number }[]
  onAppoint: (name: string) => void
  onTransfer: (toId: string) => void
}

export default function CommanderPanel({
  legion, cohortCount, wallet, others, onAppoint, onTransfer,
}: Props) {
  const [name, setName] = useState<string | null>(null)
  const cfg = GameConfig.commander()
  const man = legion.commander ?? null

  if (!man) {
    const why = appointBlocker(legion, cohortCount, wallet)
    // Shown BEFORE the appointment, because the trait is derived and a player should not
    // discover what their own record raised only after paying for it.
    const would = traitFor(legion.practice ?? {})
    const value = name ?? suggestCommanderName(legion.name)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-wl-muted">Commander</span>
        <input
          className="border border-wl-line rounded px-2 py-1.5 min-h-[32px] bg-wl-panel-muted text-wl-ink text-xs grow max-w-[220px]"
          aria-label={`Name a commander for ${legion.name}`}
          maxLength={COMMANDER_NAME_MAX}
          value={value}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          disabled={!!why}
          className="px-2 py-1.5 min-h-[32px] text-xs rounded border border-wl-line bg-wl-panel-muted text-wl-ink hover:bg-wl-panel disabled:text-wl-muted disabled:cursor-not-allowed"
          onClick={() => { onAppoint(value); setName(null) }}
        >
          Raise one · {fmtCopper(cfg.appointCostCopper)}
        </button>
        {why
          ? <span className="text-[11px] text-wl-bad leading-tight">{why}</span>
          : (
            <span className="text-[11px] text-wl-muted leading-tight">
              This legion’s record would raise <strong>{would.name}</strong> — {would.blurb}
            </span>
          )}
      </div>
    )
  }

  const trait = traitById(man.trait)
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] uppercase tracking-wide text-wl-muted">Commander</span>
        <span className="text-sm font-serif font-bold text-wl-ink">{man.name}</span>
        <span className="text-xs text-wl-muted">{trait?.name}</span>
        <span className="px-1.5 py-0.5 rounded bg-wl-panel-muted text-wl-ink font-mono text-[11px]">
          rank {commanderRank(man)}
        </span>
        <span className="text-[11px] text-wl-subtle">
          {man.battles} {man.battles === 1 ? 'battle' : 'battles'} commanded · since day {man.appointedDay}
        </span>
      </div>
      <p className="text-[11px] text-wl-muted italic leading-snug">{trait?.blurb}</p>
      <div className="text-[11px] text-wl-ink">Worth {describeTrait(man)}</div>
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* The decision the whole feature exists for. A tradition cannot move; he can. */}
          <span className="text-[11px] text-wl-muted">Send him to</span>
          {others.map(({ legion: other, cohortCount: n }) => {
            const why = transferBlocker(legion, other, n)
            return (
              <button
                key={other.id}
                disabled={!!why}
                title={why ?? `${other.name} — he keeps his rank and every battle behind him`}
                onClick={() => onTransfer(other.id)}
                className="px-2 py-1.5 min-h-[30px] text-[11px] rounded border border-wl-line bg-wl-panel-muted text-wl-ink hover:bg-wl-panel disabled:text-wl-muted disabled:cursor-not-allowed"
              >
                {other.name}
              </button>
            )
          })}
          {others.every(({ legion: o, cohortCount: n }) => transferBlocker(legion, o, n)) && (
            <span className="text-[11px] text-wl-bad leading-tight">
              {transferBlocker(legion, others[0].legion, others[0].cohortCount)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
