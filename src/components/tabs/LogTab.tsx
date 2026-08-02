import Card from '../common/Card'
import type { GameStateShape } from '../../state/useGameState'
import GameIcon, { type IconName } from '../common/GameIcon'
import { BuildingIcon, BuildingImages } from './BuildingsTab'
import { getIconForGameItem, formatGameTooltip } from '../../logic/iconHelpers'

function LogItem({ text }: { text: string }) {
  // Split by spaces but keep some structure?
  // We want to detect:
  // 1. Buildings (keys of BuildingImages)
  // 2. Items (known item names)
  // 3. Currency (10g, 5s, 10c)
  // 4. Arrows (→)

  // We'll split by regex to capture delimiters that matter, or just space.
  // Using space is safest for now, but handle punctuation attached to words?
  // e.g. "SPEAR," -> "SPEAR" + ","

  const parts = text.split(/([ \t,;]+)/).filter(Boolean)

  return (
    <div className="border-b border-wl-line py-1.5 flex flex-wrap items-center gap-1 text-sm bg-wl-panel/50 px-2 rounded mb-1 last:mb-0">
      {parts.map((part, i) => {
        const trimmed = part.trim().replace(/[;:,.]+$/, '')

        // 1. Currency
        const moneyMatch = trimmed.match(/^(\+)?(\d+)([gsc])$/)
        if (moneyMatch) {
          const [_, plus, amt, type] = moneyMatch
          const icon: IconName = type === 'g' ? 'gold' : type === 's' ? 'silver' : 'copper'
          return (
            <span key={i} className="flex items-center bg-wl-panel-muted rounded px-1 border border-wl-line">
              {plus && <span className="text-wl-muted mr-0.5">+</span>}
              <span className="font-mono font-bold text-wl-ink">{amt}</span>
              <GameIcon name={icon} size={14} className="ml-0.5" />
            </span>
          )
        }

        // 2. Building
        const buildingKey = trimmed.toUpperCase()
        if (BuildingImages[buildingKey]) {
          return <BuildingIcon key={i} type={buildingKey} size={28} />
        }

        // 3. Arrow
        if (trimmed === '→' || trimmed === '->') {
          return <span key={i} className="text-wl-subtle">➜</span>
        }

        // 4. Special Keywords
        if (trimmed === 'Day') return <span key={i} className="font-bold text-wl-muted uppercase text-[10px]">Day</span>
        if (trimmed.match(/^\d+$/) && parts[i - 2]?.trim() === 'Day') {
          // Day number
          return <span key={i} className="font-mono font-bold bg-wl-panel-muted px-1 rounded text-wl-muted">{trimmed}</span>
        }

        // 5. Items (General Icon Lookup)
        const itemIcon = getIconForGameItem(trimmed)
        if (itemIcon) {
          return (
            <div key={i} className="flex items-center gap-0.5 bg-wl-panel-muted border border-wl-line px-1 rounded" title={formatGameTooltip(trimmed)}>
              <GameIcon name={itemIcon} size={20} />
            </div>
          )
        }

        // Default text
        return <span key={i} className={part.match(/^\d+/) ? "font-mono font-bold text-wl-info" : "text-wl-ink"}>{part}</span>
      })}
    </div>
  )
}

export default function LogTab({ state }: { state: GameStateShape }) {
  const { log } = state

  return (
    <Card title="Activity Log">
      <div className="space-y-1">
        {(!log || log.length === 0) && <div className="text-wl-muted italic p-4 text-center">No activity yet.</div>}
        {log?.map((l: string, i: number) => <LogItem key={i} text={l} />)}
      </div>
    </Card>
  )
}
