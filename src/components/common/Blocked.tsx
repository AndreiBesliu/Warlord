import type { ActionCheck } from '../../logic/barracks'

/**
 * Why a button is dead, said next to the button.
 *
 * This lived inside BarracksTab and was not exported, so UnitsTab could not reuse it —
 * which is exactly how "Create Unit" ended up disabled with no reason anywhere on screen
 * while the training buttons two tabs away explained themselves properly.
 */
export default function Blocked({ check }: { check: ActionCheck | undefined }) {
  if (!check || check.ok) return null
  const reasons = check.reasons.filter(Boolean)
  if (reasons.length === 0) return null
  return (
    <div className="mt-1 text-[11px] text-wl-bad leading-tight">{reasons.join(' · ')}</div>
  )
}
