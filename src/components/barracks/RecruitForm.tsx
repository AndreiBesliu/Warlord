import { useState } from 'react'
import type { ActionCheck } from '../../logic/barracks'

export default function RecruitForm({
  onRecruit,
  check,
}: {
  onRecruit: (qty: number) => void
  // Recruiting was the last refusal in the game that happened only in the Log tab: the
  // cost was added a slice ago, `checkRecruit` was written, and this form was never wired
  // to it. Same treatment as everything else now — dead button, reason beside it.
  check?: (qty: number) => ActionCheck
}) {
  const [q, setQ] = useState<number>(50)

  const qty = Math.max(1, Math.floor(Number.isFinite(q) ? q : 1))
  const report = check?.(qty)

  return (
    <div>
      <div className="flex gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-sm">Qty</label>
          <input
            className="border border-wl-line rounded px-2 py-1 w-24"
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
          className="px-3 py-2 bg-wl-accent text-wl-accent-ink rounded disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
          disabled={!!report && !report.ok}
          onClick={() => onRecruit(qty)}
        >
          Recruit
        </button>
      </div>
      {report && !report.ok && (
        <div className="mt-1 text-[11px] text-wl-bad leading-tight">
          {report.reasons.filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}
