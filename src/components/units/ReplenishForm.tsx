import { useMemo, useState } from 'react'
import { Ranks, type BarracksPool, type Rank, type SoldierType, type Inventories, type ResourceMap } from '../../logic/types'
import { checkCreateUnit } from '../../logic/barracks'
import { rankName, unitName } from '../../logic/names'
import Blocked from '../common/Blocked'

export default function ReplenishForm({
  unitType,
  pool,
  inv,
  wallet,
  resources,
  onReplenish,
}: {
  unitId: string
  unitType: SoldierType
  pool: BarracksPool
  inv: Inventories
  wallet: number
  resources: ResourceMap
  onReplenish: (plan: Partial<Record<Rank, number>>, opts?: { autoBuy?: boolean }) => void
}) {
  const [plan, setPlan] = useState<Partial<Record<Rank, number>>>({})
  const [autoBuy, setAutoBuy] = useState(true)

  const avail = useMemo(
    () => Object.fromEntries(Ranks.map((r) => [r, pool[unitType]?.[r]?.count ?? 0])) as Record<Rank, number>,
    [pool, unitType],
  )
  const stocked = Ranks.filter((r) => avail[r] > 0)

  const check = useMemo(
    () => checkCreateUnit({ type: unitType, plan, pool: avail, autoBuy, have: { wallet, resources, inv } }),
    [unitType, plan, avail, autoBuy, wallet, resources, inv],
  )

  // Rendered once per unit. When every pool is empty this used to be five zero spinners
  // and a line reading `Need: BOW:0 | LIGHT_ARMOR:0 | —` — a machine talking, multiplied by
  // the size of your army.
  if (stocked.length === 0) {
    return (
      <p className="text-xs text-wl-muted">
        No {unitName(unitType)} in the barracks to reinforce this unit with. Train more, or
        disband a unit to send its soldiers back.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-wl-muted">Reinforce from the barracks</div>
      <div className="flex flex-wrap gap-3">
        {stocked.map((r) => (
          <div key={r} className="flex flex-col">
            <label className="text-xs text-wl-muted">{rankName(r)} · {avail[r]} available</label>
            <input
              className="border border-wl-line rounded px-2 py-1.5 min-h-[34px] w-24 bg-wl-panel-muted text-wl-ink"
              type="number"
              min={0}
              max={avail[r]}
              value={plan[r] || 0}
              onChange={(e) => {
                const n = parseInt(e.target.value || '0', 10)
                setPlan({ ...plan, [r]: Math.max(0, Math.min(avail[r], Number.isFinite(n) ? n : 0)) })
              }}
            />
          </div>
        ))}
      </div>
      <label className="text-xs flex items-center gap-2">
        <input type="checkbox" checked={autoBuy} onChange={(e) => setAutoBuy(e.target.checked)} />
        Buy missing gear
      </label>
      <div>
        <button
          className="px-3 py-1.5 min-h-[34px] text-sm rounded border border-wl-line bg-wl-panel hover:bg-wl-panel-muted disabled:bg-wl-panel-muted disabled:text-wl-muted disabled:cursor-not-allowed"
          disabled={!check.ok}
          onClick={() => onReplenish(plan, { autoBuy })}
        >
          Reinforce
        </button>
        <Blocked check={check} />
      </div>
    </div>
  )
}
