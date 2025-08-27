import React from 'react'
import Card from '../common/Card'
import InvSummary from '../common/InvSummary'

export default function OverviewTab({ state }: { state: any }) {
  const { buildings, fmtCopper, wallet, inv, addTestUnit } = state
  const buildingsArr = buildings ?? []

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card title="Buildings">
        <ul className="text-sm list-disc ml-4">
          {buildingsArr.map((b: any) => (
            <li key={b.id}>
              {b.type} — focus {b.focusCoinPct}%{b.outputItem ? ` → ${b.outputItem}` : ''}
            </li>
          ))}
        </ul>
        <div className="text-xs text-gray-500 mt-2">
          Passive coin/day = 10% of cost. Foregone coin → items at 70% value.
        </div>
      </Card>

      <Card title="Inventories">
        <div className="mb-2 text-sm">Wallet: <span className="font-mono">{fmtCopper(wallet)}</span></div>
        <InvSummary inv={inv} />
      </Card>

      <Card title="Quick Actions">
        <button className="px-3 py-2 border rounded" onClick={addTestUnit}>
          + Add test unit
        </button>
      </Card>
    </div>
  )
}
