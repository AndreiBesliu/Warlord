// src/components/barracks/RecruitForm.tsx
import React, { useState } from 'react'

export default function RecruitForm({ onRecruit }: { onRecruit: (qty: number) => void }) {
  const [q, setQ] = useState(50)
  return (
    <div className="flex gap-2 items-end">
      <div className="flex flex-col">
        <label className="text-sm">Qty</label>
        <input
          className="border rounded px-2 py-1 w-24"
          type="number"
          min={1}
          value={q}
          onChange={e => setQ(Math.max(1, parseInt(e.target.value || '1')))}
        />
      </div>
      <button className="px-3 py-2 bg-black text-white rounded" onClick={() => onRecruit(q)}>
        Recruit
      </button>
    </div>
  )
}
