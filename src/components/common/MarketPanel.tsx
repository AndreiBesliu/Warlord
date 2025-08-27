import React, { useState } from 'react'

export default function MarketPanel({
  title,
  options,
  kind,
  have,
  onBuy,
  onSell,
}: {
  title: string
  options: { k: string; price: number }[]
  kind: 'WEAPON' | 'ARMOR' | 'HORSE'
  have: (k: string) => number
  onBuy: (kind: 'WEAPON'|'ARMOR'|'HORSE', subtype: string, qty: number) => void
  onSell: (kind: 'WEAPON'|'ARMOR'|'HORSE', subtype: string, qty: number) => void
}) {
  const [qty, setQty] = useState(10)
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-2">
        {options.map(({ k, price }) => (
          <div key={k} className="border rounded p-2 flex items-center gap-2">
            <div className="flex-1">
              <div className="font-medium">{k}</div>
              <div className="text-xs text-gray-600">
                Price: {price}c • Have: <span className="font-mono">{have(k)}</span>
              </div>
            </div>
            <input
              className="border rounded px-2 py-1 w-20"
              type="number"
              min={1}
              value={qty}
              onChange={(e)=>setQty(Math.max(1, parseInt(e.target.value || '1')))}
            />
            <button className="px-3 py-1 border rounded" onClick={()=>onSell(kind, k, qty)}>Sell</button>
            <button className="px-3 py-1 bg-black text-white rounded" onClick={()=>onBuy(kind, k, qty)}>Buy</button>
          </div>
        ))}
      </div>
    </div>
  )
}
