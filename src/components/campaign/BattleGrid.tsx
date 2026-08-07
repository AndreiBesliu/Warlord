import React from 'react'
import type { BattleState, Combatant, Side, TerrainType } from '../../logic/combat/types'
import { legalMoves, legalTargets, terrainAt, combatantAt } from '../../logic/combat/engine'
import GameIcon from '../common/GameIcon'
import { getIconForGameItem } from '../../logic/iconHelpers'

const TILE = 46

const TERRAIN_CLASS: Record<TerrainType, string> = {
  PLAINS: 'bg-wl-plains',
  FOREST: 'bg-wl-forest',
  HILL: 'bg-wl-hill',
  RIVER: 'bg-wl-river',
}

const TERRAIN_LABEL: Record<TerrainType, string> = {
  PLAINS: 'Plains', FOREST: 'Forest', HILL: 'Hill', RIVER: 'River',
}

function Token({ c, selected, dim }: { c: Combatant; selected: boolean; dim: boolean }) {
  const isPlayer = c.side === 'PLAYER'
  const pct = Math.max(0, Math.min(100, (c.hp / Math.max(1, c.hpStart)) * 100))
  return (
    <div
      className={`absolute inset-0.5 rounded-md border-2 flex flex-col items-center justify-center overflow-hidden
        ${isPlayer ? 'border-wl-info bg-wl-info/10' : 'border-wl-bad bg-wl-bad-surface'}
        ${selected ? 'ring-2 ring-wl-accent ring-offset-1' : ''}
        ${dim ? 'opacity-50' : ''}
        ${c.routed ? 'grayscale opacity-60' : ''}`}
      title={`${c.name} — ${c.hp}/${c.hpStart} soldiers, morale ${Math.round(c.morale)}${c.routed ? ' (routed)' : ''}`}
    >
      <GameIcon name={getIconForGameItem(c.type) || 'sword'} size={20} />
      <span className={`text-[10px] font-mono leading-none font-bold ${isPlayer ? 'text-wl-info' : 'text-wl-bad'}`}>{c.hp}</span>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-wl-ink/10">
        <div className={`h-full ${pct > 50 ? 'bg-wl-good' : pct > 25 ? 'bg-wl-warn' : 'bg-wl-bad'}`} style={{ width: `${pct}%` }} />
      </div>
      {c.routed && <span className="absolute bottom-0 right-0 text-[9px]">🏳</span>}
    </div>
  )
}

interface Props {
  battle: BattleState
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (x: number, y: number) => void
  onAttack: (targetId: string) => void
  // Which battle side this viewer commands. PvE is always 'PLAYER' (default);
  // in PvP the defender commands the 'ENEMY' side of the same shared state.
  controlSide?: Side
}

export default function BattleGrid({ battle, selectedId, onSelect, onMove, onAttack, controlSide = 'PLAYER' }: Props) {
  const canControl = battle.side === controlSide && battle.status === 'ONGOING'
  const moves = selectedId && canControl ? legalMoves(battle, selectedId) : []
  const targets = selectedId && canControl ? legalTargets(battle, selectedId) : []
  const moveSet = new Set(moves.map((m) => `${m.x},${m.y}`))
  const targetSet = new Set(targets)

  const cells: React.ReactNode[] = []
  for (let y = 0; y < battle.height; y++) {
    for (let x = 0; x < battle.width; x++) {
      const t: TerrainType = terrainAt(battle, x, y)
      const occ = combatantAt(battle, x, y)
      const isMove = moveSet.has(`${x},${y}`)
      const isTarget = !!occ && targetSet.has(occ.id)
      const selected = !!occ && occ.id === selectedId
      const dim = !!occ && occ.side === controlSide && canControl && occ.hasActed && occ.hasMoved

      const onClick = () => {
        if (occ) {
          if (occ.side === controlSide && canControl) onSelect(occ.id)
          else if (isTarget) onAttack(occ.id)
        } else if (isMove) {
          onMove(x, y)
        }
      }

      cells.push(
        <div
          key={`${x},${y}`}
          onClick={onClick}
          className={`relative ${TERRAIN_CLASS[t]} border border-wl-line
            ${isMove ? 'cursor-pointer' : occ ? 'cursor-pointer' : ''}
            ${isMove ? 'outline outline-2 outline-wl-good/70 -outline-offset-2' : ''}
            ${isTarget ? 'outline outline-2 outline-wl-bad -outline-offset-2' : ''}`}
          style={{ width: TILE, height: TILE }}
          title={TERRAIN_LABEL[t]}
        >
          {isMove && !occ && <div className="absolute inset-0 flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-wl-good/70" /></div>}
          {occ && <Token c={occ} selected={selected} dim={dim} />}
        </div>,
      )
    }
  }

  return (
    <div className="inline-block">
      <div
        className="grid select-none shadow-inner rounded-lg overflow-hidden border border-wl-line-strong"
        style={{ gridTemplateColumns: `repeat(${battle.width}, ${TILE}px)` }}
      >
        {cells}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-wl-muted">
        {(['PLAINS', 'FOREST', 'HILL', 'RIVER'] as TerrainType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded ${TERRAIN_CLASS[t]} border border-wl-line`} />
            {TERRAIN_LABEL[t]}
          </span>
        ))}
      </div>
    </div>
  )
}
