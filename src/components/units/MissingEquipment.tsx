import { missingEquipmentList } from '../../logic/units'
import type { Unit } from '../../logic/types'

export default function MissingEquipment({ unit }: { unit: Unit }) {
  const missing = missingEquipmentList(unit)
  return (
    <div className="mt-1 text-xs">
      {missing.length
        ? <span className="text-wl-bad">Missing: {missing.join(', ')}</span>
        : <span className="text-wl-good">Fully equipped</span>}
    </div>
  )
}
