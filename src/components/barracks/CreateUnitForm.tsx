import { useMemo, useState } from 'react'
import { SoldierTypes, Ranks, type SoldierType, type Rank, type BarracksPool, type ResourceMap, type Inventories } from '../../logic/types'
import { checkCreateUnit } from '../../logic/barracks'
import { unitName, rankName } from '../../logic/names'
import Blocked from '../common/Blocked'
import CostList from '../common/CostList'
import { evaluateCost } from '../../logic/costs'
import { gearCost } from '../../logic/barracks'

export default function CreateUnitForm({
  barracks,
  onCreate,
  inv,
  wallet,
  resources,
}: {
  barracks: BarracksPool
  inv: Inventories
  wallet: number
  resources: ResourceMap
  onCreate: (type: SoldierType, take: Partial<Record<Rank, number>>, opts?: { autoBuy?: boolean }) => void
}) {
  const [type, setType] = useState<SoldierType>('LIGHT_INF_SPEAR')
  const [plan, setPlan] = useState<Partial<Record<Rank, number>>>({})
  const [autoBuy, setAutoBuy] = useState(true)

  const total = useMemo(() => Object.values(plan).reduce((a, b) => a + (b || 0), 0), [plan])

  // Only the ranks that have somebody in them. Five spinners reading "(avail 0)" is a form
  // that cannot be used, rendered in full, with no hint of why.
  const pool = useMemo(
    () => Object.fromEntries(Ranks.map((r) => [r, barracks[type]?.[r]?.count ?? 0])) as Record<Rank, number>,
    [barracks, type],
  )
  const stocked = Ranks.filter((r) => pool[r] > 0)

  // `checkCreateUnit` was written for this and then imported by nothing, which is why the
  // button sat dead with no explanation anywhere on screen.
  const have = useMemo(() => ({ wallet, resources, inv }), [wallet, resources, inv])
  const check = useMemo(
    () => checkCreateUnit({ type, plan, pool, autoBuy, have }),
    [type, plan, pool, autoBuy, have],
  )
  // What the unit needs is shown whichever way it is paid for; `check.cost` is about
  // affording it, and with auto-buy on that is a copper figure, not a list of gear.
  const needLines = useMemo(() => evaluateCost(gearCost(type, total), have).lines, [type, total, have])

  const setRank = (r: Rank, raw: string) => {
    const n = parseInt(raw || '0', 10)
    // Clamped to what the pool holds. Unclamped, you could ask for 999 out of 3, the button
    // stayed enabled, and the refusal appeared in the Log tab.
    setPlan({ ...plan, [r]: Math.max(0, Math.min(pool[r], Number.isFinite(n) ? n : 0)) })
  }

  return (
    <div className="rounded-lg border border-wl-line bg-wl-panel p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm font-serif">Type</label>
        <select
          className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] bg-wl-panel-muted text-wl-ink"
          value={type}
          onChange={(e) => { setType(e.target.value as SoldierType); setPlan({}) }}
        >
          {SoldierTypes.map((t) => <option key={t} value={t}>{unitName(t)}</option>)}
        </select>
        <label className="ml-auto text-sm flex items-center gap-2">
          <input type="checkbox" checked={autoBuy} onChange={(e) => setAutoBuy(e.target.checked)} />
          Buy missing gear
        </label>
      </div>

      {stocked.length === 0 ? (
        <p className="text-sm text-wl-muted">
          No {unitName(type)} are waiting in the barracks. Train some first — a finished batch
          gathers here, ready to be formed.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {stocked.map((r) => (
            <div key={r} className="flex flex-col">
              <label className="text-xs text-wl-muted">{rankName(r)} · {pool[r]} available</label>
              <input
                className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] w-28 bg-wl-panel-muted text-wl-ink"
                type="number"
                min={0}
                max={pool[r]}
                value={plan[r] || 0}
                onChange={(e) => setRank(r, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="rounded-lg bg-wl-panel-muted border border-wl-line p-3">
          <div className="text-xs uppercase tracking-wide text-wl-muted mb-1">
            {total} {unitName(type)} will need
          </div>
          <CostList lines={needLines} />
          {autoBuy && check.cost.missing.length > 0 && (
            <div className="mt-1 text-xs text-wl-muted">
              What you are short of will be bought at market price.
            </div>
          )}
        </div>
      )}

      <div>
        <button
          className="px-4 py-2 min-h-[38px] rounded bg-wl-accent text-wl-accent-ink font-serif disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
          disabled={!check.ok}
          onClick={() => onCreate(type, plan, { autoBuy })}
        >
          Form unit
        </button>
        <Blocked check={check} />
      </div>
    </div>
  )
}
