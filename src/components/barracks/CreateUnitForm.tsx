import React, { useState } from 'react'
import { SoldierTypes, type SoldierType, Ranks, type Rank, type BarracksPool } from '../../logic/types'

export default function CreateUnitForm({
  barracks, onCreate
}: {
  barracks: BarracksPool
  onCreate: (t: SoldierType, take: Partial<Record<Rank, number>>) => void
}) {
  const [t, setT] = useState<SoldierType>('LIGHT_INF')
  const [draft, setDraft] = useState<Partial<Record<Rank, number>>>({ NOVICE: 50 })
  const available = (r: Rank) => barracks[t][r].count

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-sm">Type</label>
          <select className="border rounded px-2 py-1" value={t} onChange={e=>setT(e.target.value as SoldierType)}>
            {SoldierTypes.map(x=> <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {Ranks.map(r=>(
          <div key={r} className="flex flex-col">
            <label className="text-xs text-gray-500">{r} (avail {available(r)})</label>
            <input className="border rounded px-2 py-1" type="number" min={0} value={draft[r]||0}
                   onChange={e=>setDraft({...draft, [r]: Math.max(0, parseInt(e.target.value||'0'))})}/>
          </div>
        ))}
      </div>

      <button className="px-3 py-2 bg-black text-white rounded" onClick={()=>onCreate(t, draft)}>
        Create Unit
      </button>
    </div>
  )
}
