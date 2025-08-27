import React, { useState } from 'react'
import { SoldierTypes, type SoldierType } from '../../logic/types'

export default function RecruitForm({ onRecruit }: { onRecruit: (t: SoldierType, qty: number) => void }) {
  const [t, setT] = useState<SoldierType>('LIGHT_INF')
  const [q, setQ] = useState(50)
  return (
    <div className="flex gap-2 items-end">
      <div className="flex flex-col">
        <label className="text-sm">Type</label>
        <select className="border rounded px-2 py-1" value={t} onChange={e=>setT(e.target.value as SoldierType)}>
          {SoldierTypes.map(x=> <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-sm">Qty</label>
        <input className="border rounded px-2 py-1 w-24" type="number" min={1} value={q}
               onChange={e=>setQ(Math.max(1, parseInt(e.target.value||'1')))} />
      </div>
      <button className="px-3 py-2 bg-black text-white rounded" onClick={()=>onRecruit(t,q)}>Recruit</button>
    </div>
  )
}
