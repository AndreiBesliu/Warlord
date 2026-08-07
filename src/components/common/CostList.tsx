import MoneyDisplay from './MoneyDisplay'
import GameIcon from './GameIcon'
import { getIconForGameItem, formatGameTooltip } from '../../logic/iconHelpers'
import type { CostLine } from '../../logic/costs'

// A price, shown so it can be READ and LEARNED: every entry carries its name, not just
// an icon, and anything you are short of says how short. The old rows were bare
// icon+number strings ("🪙1 ⚙50 ▪40 ◪4"), which are unlearnable — you cannot tell which
// pictogram is coal and which is copper ore, and nothing told you what was missing.
export default function CostList({
  lines,
  size = 14,
  showLabels = true,
}: {
  lines: CostLine[]
  size?: number
  /** Off in very tight rows; the name still reaches assistive tech via the title. */
  showLabels?: boolean
}) {
  if (lines.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {lines.map((l) => {
        const label = l.kind === 'copper' ? 'Coin' : formatGameTooltip(l.key)
        const title = l.short > 0
          ? `${label}: need ${l.need}, you have ${l.have} — short ${l.short}`
          : `${label}: need ${l.need}, you have ${l.have}`
        return (
          <span
            key={`${l.kind}:${l.key}`}
            title={title}
            className={`inline-flex items-center gap-1 ${l.short > 0 ? 'text-wl-bad font-semibold' : 'text-wl-muted'}`}
          >
            {l.kind === 'copper'
              ? <MoneyDisplay amount={l.need} size={size} />
              : <>
                  <GameIcon name={getIconForGameItem(l.key) || 'wood'} size={size} />
                  <span className="font-mono">{l.need}</span>
                </>}
            {showLabels && l.kind !== 'copper' && <span className="hidden sm:inline">{label}</span>}
            {l.short > 0 && <span className="font-mono">(have {l.have})</span>}
          </span>
        )
      })}
    </div>
  )
}
