import React from 'react'
import Card from '../common/Card'

export default function LogTab({ state }: { state: any }) {
  const { log } = state
  return (
    <Card title="Activity Log">
      <div className="space-y-1 text-sm">
        {(!log || log.length === 0) && <div className="text-gray-500">No activity yet.</div>}
        {log?.map((l: string, i: number) => (
          <div key={i} className="border-b py-1">{l}</div>
        ))}
      </div>
    </Card>
  )
}
