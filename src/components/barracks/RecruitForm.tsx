import { useState } from 'react'
import type { ActionCheck } from '../../logic/barracks'
import type { RecruitPool } from '../../logic/types'
import { fmtCopper } from '../../logic/types'
import { labelOf } from '../../logic/names'
import MoneyDisplay from '../common/MoneyDisplay'
import Blocked from '../common/Blocked'
import {
  RECRUIT_SOURCES,
  avgAfterRecruiting,
  avgXpOf,
  sourceCostCopper,
  startingXpOf,
  type RecruitSourceId,
} from '../../logic/recruitSources'

export default function RecruitForm({
  pool,
  onRecruit,
  check,
}: {
  pool: RecruitPool
  onRecruit: (qty: number, source: RecruitSourceId) => void
  // Recruiting was the last refusal in the game that happened only in the Log tab: the
  // cost was added a slice ago, `checkRecruit` was written, and this form was never wired
  // to it. Same treatment as everything else now — dead button, reason beside it.
  check?: (qty: number, source: RecruitSourceId) => ActionCheck
}) {
  const [q, setQ] = useState<number>(50)
  const [source, setSource] = useState<RecruitSourceId>('LEVY')

  const qty = Math.max(1, Math.floor(Number.isFinite(q) ? q : 1))
  const report = check?.(qty, source)

  const cost = sourceCostCopper(qty, source)
  const perMan = sourceCostCopper(1, source)
  const headStart = startingXpOf(source)

  // Every man in the pool is worth the same average, so buying cheap men drags down what
  // the ones already there will hand to their training batch. That is the real cost of the
  // cheap tier, and it is invisible unless the screen says it before the press. Computed
  // by the SAME function that performs the blend — a preview with its own copy of the
  // formula is how a screen starts lying.
  const avgNow = avgXpOf(pool)
  const avgNext = avgAfterRecruiting(pool, qty, source)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-sm font-medium" htmlFor="recruit-source">Where from</label>
          <select
            id="recruit-source"
            className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] bg-wl-panel-muted text-wl-ink"
            value={source}
            onChange={(e) => setSource(e.target.value as RecruitSourceId)}
          >
            {RECRUIT_SOURCES.map((s) => {
              const xp = startingXpOf(s)
              return (
                <option key={s} value={s}>
                  {labelOf(s)} — {fmtCopper(sourceCostCopper(1, s))} each
                  {xp > 0 ? ` · ${xp} XP head start` : ' · no training'}
                </option>
              )
            })}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium" htmlFor="recruit-qty">Qty</label>
          <input
            id="recruit-qty"
            className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] w-24 bg-wl-panel-muted text-wl-ink"
            type="number"
            min={1}
            value={Number.isFinite(q) ? q : 1}
            onChange={(e) => {
              const n = parseInt(e.target.value || '0', 10)
              setQ(Number.isFinite(n) ? n : 0)
            }}
          />
        </div>
        <button
          className="px-4 py-2 min-h-[38px] bg-wl-accent text-wl-accent-ink rounded font-serif disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
          disabled={!!report && !report.ok}
          onClick={() => onRecruit(qty, source)}
        >
          Recruit
        </button>
      </div>

      <div className="rounded-lg bg-wl-panel-muted border border-wl-line p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-wl-ink">
            {qty} {labelOf(source)} at {fmtCopper(perMan)} each
          </span>
          <span className="text-wl-muted">·</span>
          <MoneyDisplay amount={cost} size={14} className="inline-flex" />
        </div>
        <div className="mt-1 text-xs text-wl-muted">
          Recruit pool average:{' '}
          <span className="font-mono text-wl-ink">{avgNow} XP</span>
          {avgNext !== avgNow && (
            <>
              {' → '}
              <span className={`font-mono ${avgNext < avgNow ? 'text-wl-bad' : 'text-wl-good'}`}>
                {avgNext} XP
              </span>
            </>
          )}
          {headStart > 0
            ? ` — these men have already been trained ${headStart} XP worth.`
            : ' — untrained men, so they pull the average down.'}
        </div>
      </div>

      <Blocked check={report} />
    </div>
  )
}
