import type { Difficulty, MissionPreset } from '../../logic/combat/types'
import { escalationMult, streakLootMult } from '../../logic/combat/enemies'

interface Props {
  presets: Record<Difficulty, MissionPreset>
  difficulties: Difficulty[]
  record: { wins: number; losses: number }
  streak: number
  clears: Partial<Record<Difficulty, number>>
  canFightToday: boolean
  onPick: (d: Difficulty) => void
}

const BADGE: Record<Difficulty, string> = {
  BANDIT_RAID: 'bg-wl-good-surface text-wl-good border-wl-good',
  RIVAL_BARON: 'bg-wl-warn-surface text-wl-warn border-wl-warn',
  INVASION: 'bg-wl-bad-surface text-wl-bad border-wl-bad',
}

const FLAVOR: Record<Difficulty, string> = {
  BANDIT_RAID: 'A ragged warband harasses your lands. A gentle first blooding.',
  RIVAL_BARON: 'A neighbouring lord tests your borders with a balanced host.',
  INVASION: 'A disciplined army marches on your seat. Bring your best.',
}

export default function MissionList({ presets, difficulties, record, streak, clears, canFightToday, onPick }: Props) {
  const lootMult = streakLootMult(streak)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold">Campaign record:</span>
        <span className="text-wl-good font-mono">{record.wins} W</span>
        <span className="text-wl-bad font-mono">{record.losses} L</span>
        {streak > 1 && (
          <span className="px-2 py-0.5 rounded-full bg-wl-accent-surface border border-wl-accent-line text-wl-accent text-xs font-semibold">
            🔥 {streak}-win streak — loot ×{lootMult.toFixed(2)}
          </span>
        )}
        {!canFightToday && (
          <span className="px-2 py-0.5 rounded-full bg-wl-panel-muted border border-wl-line text-wl-muted text-xs">
            🏕 Your host has fought today — march again tomorrow (Run Day ▶)
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {difficulties.map((d) => {
          const p = presets[d]
          const c = clears[d] ?? 0
          const esc = escalationMult(c)
          return (
            <div key={d} className="border border-wl-line rounded-xl p-4 bg-wl-panel flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">{p.name}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${BADGE[d]}`}>
                  {d === 'BANDIT_RAID' ? 'Easy' : d === 'RIVAL_BARON' ? 'Medium' : 'Hard'}
                </span>
              </div>
              <p className="text-xs text-wl-muted min-h-[48px]">{FLAVOR[d]}</p>
              <div className="text-xs text-wl-muted">
                Enemy strength ≈ <span className="font-mono">{Math.round(p.ratio * esc * 100)}%</span> of your host
                {c > 0 && <span className="text-wl-warn"> (escalated ×{esc.toFixed(2)} after {c} {c === 1 ? 'victory' : 'victories'})</span>}
              </div>
              <button
                onClick={() => onPick(d)}
                disabled={!canFightToday}
                className={`mt-1 px-3 py-2 rounded transition-colors ${canFightToday ? 'bg-wl-accent text-wl-accent-ink hover:opacity-90' : 'bg-wl-panel-muted text-wl-subtle cursor-not-allowed'}`}
              >
                {canFightToday ? 'Prepare ⚔' : 'Resting 🏕'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
