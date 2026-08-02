import type { LastBattleResult } from '../../state/useCampaign'
import MoneyDisplay from '../common/MoneyDisplay'
import GameIcon from '../common/GameIcon'
import { getIconForGameItem } from '../../logic/iconHelpers'

interface Props {
  result: LastBattleResult
  record: { wins: number; losses: number }
  onDismiss: () => void
}

export default function ResultScreen({ result, record, onDismiss }: Props) {
  const won = result.won
  return (
    <div className="max-w-md mx-auto text-center space-y-4 py-6">
      <div className={`text-4xl font-serif font-bold ${won ? 'text-wl-good' : 'text-wl-bad'}`}>
        {won ? '🏆 Victory' : '💀 Defeat'}
      </div>
      <div className="text-wl-muted">{won ? 'The field is yours.' : 'Your host is broken.'}</div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="border border-wl-line rounded-lg p-3 bg-wl-panel">
          <div className="font-mono text-xl font-bold text-wl-bad">{result.totalLosses}</div>
          <div className="text-xs text-wl-muted">soldiers lost</div>
        </div>
        <div className="border border-wl-line rounded-lg p-3 bg-wl-panel">
          <div className="font-mono text-xl font-bold text-wl-good">{result.totalKills}</div>
          <div className="text-xs text-wl-muted">enemies slain</div>
        </div>
        <div className="border border-wl-line rounded-lg p-3 bg-wl-panel">
          <div className="font-mono text-xl font-bold">{result.destroyed}</div>
          <div className="text-xs text-wl-muted">units wiped</div>
        </div>
      </div>

      {won && result.reward && (
        <div className="border border-wl-line rounded-lg p-3 bg-wl-accent-surface inline-flex flex-col items-center gap-2">
          <div className="text-xs uppercase tracking-wide text-wl-accent">Loot</div>
          <MoneyDisplay amount={result.reward.copper} />
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.entries(result.reward.resources).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-sm">
                <GameIcon name={getIconForGameItem(k) || 'wood'} size={18} />
                <span className="font-mono">{v}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {result.report && result.report.length > 0 && (
        <div className="border border-wl-line rounded-lg bg-wl-panel text-left overflow-hidden">
          <div className="text-xs uppercase tracking-wide text-wl-muted px-3 pt-2">Battle report</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-wl-subtle">
                <th className="text-left px-3 py-1 font-normal">Unit</th>
                <th className="text-right px-2 py-1 font-normal">Fielded</th>
                <th className="text-right px-2 py-1 font-normal">Lost</th>
                <th className="text-right px-2 py-1 font-normal">XP</th>
              </tr>
            </thead>
            <tbody>
              {result.report.map((r) => (
                <tr key={r.unitId} className={`border-t border-wl-line ${r.destroyed ? 'text-wl-bad' : ''}`}>
                  <td className="px-3 py-1">
                    <span className="inline-flex items-center gap-1">
                      <GameIcon name={getIconForGameItem(r.type) || 'sword'} size={14} />
                      {r.name}
                      {r.destroyed && <span title="Unit wiped out">💀</span>}
                      {r.promotions.map((p, i) => (
                        <span key={i} className="text-[10px] px-1 rounded bg-wl-accent-surface text-wl-accent border border-wl-accent-line" title={`${p.count} promoted ${p.from} → ${p.to}`}>
                          ⬆ {p.to}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="text-right px-2 py-1 font-mono">{r.fielded}</td>
                  <td className="text-right px-2 py-1 font-mono">{r.lost > 0 ? `-${r.lost}` : '—'}</td>
                  <td className="text-right px-2 py-1 font-mono">{r.xpGain > 0 ? `+${r.xpGain}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-wl-muted">Record: {record.wins}W / {record.losses}L</div>
      <button onClick={onDismiss} className="px-5 py-2 bg-wl-accent text-wl-accent-ink rounded hover:opacity-90">
        Return to camp
      </button>
    </div>
  )
}
