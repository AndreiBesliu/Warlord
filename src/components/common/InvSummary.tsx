import React from 'react'
import { WeaponTypes, ArmorTypes, HorseTypes } from '../../logic/types'

export default function InvSummary({
  inv
}: {
  inv: {
    weapons: Record<string, number>
    armors: Record<string, number>
    horses: Record<string, { active: number; inactive: number }>
  }
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <h4 className="font-semibold">Weapons</h4>
        {WeaponTypes.map(w => (
          <div key={w} className="border rounded m-1 p-2 bg-white flex justify-between">
            <span>{w}</span>
            <span className="font-mono">{inv.weapons[w] ?? 0}</span>
          </div>
        ))}
      </div>
      <div>
        <h4 className="font-semibold">Armor</h4>
        {ArmorTypes.map(a => (
          <div key={a} className="border rounded m-1 p-2 bg-white flex justify-between">
            <span>{a}</span>
            <span className="font-mono">{inv.armors[a] ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm">
        <h4 className="font-semibold mt-2">Horses</h4>
        {HorseTypes.map(h => (
          <div key={h} className="border rounded p-2 bg-white flex justify-between">
            <span>{h}</span>
            <span className="font-mono">
              {(inv.horses[h]?.active ?? 0)} active / {(inv.horses[h]?.inactive ?? 0)} inactive
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
