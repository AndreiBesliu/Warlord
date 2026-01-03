import React from 'react'
import Card from '../common/Card'
import type { GameStateShape } from '../../state/useGameState'
import GameIcon from '../common/GameIcon'

export default function LogTab({ state }: { state: GameStateShape }) {
  const { log } = state

  return (
    <Card title="Activity Log">
      <div className="space-y-1 text-sm">
        {(!log || log.length === 0) && <div className="text-gray-500">No activity yet.</div>}
        {log?.map((l: string, i: number) => {
          // Naive parse: replace "Ng", "Ns", "Nc" with icons
          const parts = l.split(/(\d+[gsc])/)
          return (
            <div key={i} className="border-b py-1 flex flex-wrap items-center gap-1">
              {parts.map((p, j) => {
                if (p.match(/^\d+g$/)) {
                  return <span key={j} className="flex items-center"><GameIcon name="gold" size={14} /><span className="font-mono">{p.replace('g', '')}</span></span>
                }
                if (p.match(/^\d+s$/)) {
                  return <span key={j} className="flex items-center"><GameIcon name="silver" size={14} /><span className="font-mono">{p.replace('s', '')}</span></span>
                }
                if (p.match(/^\d+c$/)) {
                  return <span key={j} className="flex items-center"><GameIcon name="copper" size={14} /><span className="font-mono">{p.replace('c', '')}</span></span>
                }
                // Also handle trailing space if split leaves it or empty
                if (!p) return null
                return <span key={j}>{p}</span>
              })}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
