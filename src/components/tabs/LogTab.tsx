import { useMemo, useState } from 'react'
import Card from '../common/Card'
import type { GameStateShape } from '../../state/useGameState'
import GameIcon, { type IconName } from '../common/GameIcon'
import { BuildingIcon, BuildingImages } from './BuildingsTab'
import { getIconForGameItem, formatGameTooltip } from '../../logic/iconHelpers'
import { logKind, stripTimestamp, LOG_KINDS, type LogKind } from '../../logic/logKind'

function LogItem({ text }: { text: string }) {
  const parts = stripTimestamp(text).split(/([ \t,;]+)/).filter(Boolean)

  return (
    <div className="border-b border-wl-line py-1.5 flex flex-wrap items-center gap-1 text-sm bg-wl-panel/50 px-2 rounded mb-1 last:mb-0">
      {parts.map((part, i) => {
        const trimmed = part.trim().replace(/[;:,.]+$/, '')

        // 1. Currency
        const moneyMatch = trimmed.match(/^(\+)?(\d+)([gsc])$/)
        if (moneyMatch) {
          const [, plus, amt, type] = moneyMatch
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
        if (trimmed === 'Day') return <span key={i} className="font-bold text-wl-muted uppercase text-[11px]">Day</span>
        if (trimmed.match(/^\d+$/) && parts[i - 2]?.trim() === 'Day') {
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
        return <span key={i} className={part.match(/^\d+/) ? 'font-mono font-bold text-wl-info' : 'text-wl-ink'}>{part}</span>
      })}
    </div>
  )
}

export default function LogTab({ state }: { state: GameStateShape }) {
  const { log } = state
  const [muted, setMuted] = useState<Set<LogKind>>(new Set())
  const [q, setQ] = useState('')

  // Categorise once per render pass, not once per filter toggle.
  const entries = useMemo(
    () => (log ?? []).map((text: string) => ({ text, kind: logKind(text) })),
    [log],
  )

  const counts = useMemo(() => {
    const c = {} as Record<LogKind, number>
    for (const k of LOG_KINDS) c[k.kind] = 0
    for (const e of entries) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [entries])

  const needle = q.trim().toLowerCase()
  const shown = entries.filter(
    (e) => !muted.has(e.kind) && (needle === '' || e.text.toLowerCase().includes(needle)),
  )

  const toggle = (k: LogKind) =>
    setMuted((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  return (
    <Card title="Activity Log">
      {/* The log was one undifferentiated stream: to find out why the treasury moved you
          read past every training and battle line. Chips mute a whole category; the count
          stays visible so muting never hides that something happened. */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {LOG_KINDS.map(({ kind, label, icon }) => {
          const off = muted.has(kind)
          return (
            <button
              key={kind}
              onClick={() => toggle(kind)}
              aria-pressed={!off}
              title={off ? `Show ${label}` : `Hide ${label}`}
              className={`px-2 py-1 min-h-[32px] rounded-full border text-xs transition-colors ${
                off
                  ? 'bg-wl-panel text-wl-subtle border-wl-line line-through'
                  : 'bg-wl-accent-surface text-wl-accent border-wl-accent-line font-semibold'
              }`}
            >
              <span aria-hidden className="mr-1">{icon}</span>{label}
              <span className="ml-1 font-mono">{counts[kind] ?? 0}</span>
            </button>
          )
        })}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the log…"
          className="ml-auto px-2 py-1 min-h-[32px] rounded border border-wl-line bg-wl-panel text-wl-ink text-sm w-full sm:w-56"
        />
      </div>

      <div className="space-y-1">
        {entries.length === 0 && <div className="text-wl-muted italic p-4 text-center">No activity yet.</div>}
        {entries.length > 0 && shown.length === 0 && (
          <div className="text-wl-muted italic p-4 text-center">
            {needle ? `Nothing matches “${q}”.` : 'Every category is hidden.'}
          </div>
        )}
        {shown.map((e, i) => <LogItem key={i} text={e.text} />)}
      </div>

      {shown.length < entries.length && (
        <div className="mt-2 text-xs text-wl-subtle text-center">
          Showing {shown.length} of {entries.length} entries
        </div>
      )}
    </Card>
  )
}
