import { useState } from 'react'
import { GOLD, fmtCopper, type Building } from '../logic/types'
import { BuildingCostCopper, BuildingOutputChoices, passiveIncomeAndProduction } from '../logic/economy'
import { WeaponTypes, ArmorTypes, HorseTypes } from '../logic/types'

export function useEconomy(initialWallet = 5 * GOLD, defaultBuildings: () => Building[]) {
  const [wallet, setWallet] = useState(initialWallet)
  const [inv, setInv] = useState({
    weapons: { HALBERD:0, SPEAR:0, SWORD:0, BOW:0 } as Record<string, number>,
    armors:  { SHIELD:0, HEAVY_ARMOR:0, LIGHT_ARMOR:0, HORSE_ARMOR:0 } as Record<string, number>,
    horses:  {
      LIGHT_HORSE: { active:0, inactive:0 },
      HEAVY_HORSE: { active:0, inactive:0 }
    } as Record<'LIGHT_HORSE'|'HEAVY_HORSE', {active:number; inactive:number}>
  })
  const [buildings, setBuildings] = useState<Building[]>(defaultBuildings())

  const hasStable = buildings.some(b => b.type === 'STABLE')

  function applyBuildingIncome(addNote: (s:string)=>void) {
    let walletDelta = 0
    const ninv = structuredClone(inv)
    const updated = buildings.map(b => {
      const row = { ...b }
      if (!['STABLE','MARKET','BARRACKS'].includes(row.type)) {
        const cost = BuildingCostCopper[row.type] || 0
        const { coinGain, items, newBuffer } = passiveIncomeAndProduction({
          costCopper: cost,
          focusCoinPct: row.focusCoinPct,
          outputItem: row.outputItem ?? BuildingOutputChoices[row.type].options[0],
          fractionalBuffer: row.fractionalBuffer ?? 0,
        })
        walletDelta += coinGain
        row.fractionalBuffer = newBuffer

        const item = row.outputItem ?? BuildingOutputChoices[row.type].options[0]
        if ((WeaponTypes as readonly string[]).includes(item as any)) {
          ninv.weapons[item] = (ninv.weapons[item] ?? 0) + items
        } else if ((ArmorTypes as readonly string[]).includes(item as any)) {
          ninv.armors[item] = (ninv.armors[item] ?? 0) + items
        }
        addNote(`${row.type} → +${items} ${item}, +${fmtCopper(coinGain)}`)
      }
      return row
    })

    // Stable: breeding + upkeep (once per day)
    if (hasStable) {
      const breedL = Math.floor(0.01 * (ninv.horses.LIGHT_HORSE.active || 0))
      const breedH = Math.floor(0.01 * (ninv.horses.HEAVY_HORSE.active || 0))
      ninv.horses.LIGHT_HORSE.active += breedL
      ninv.horses.HEAVY_HORSE.active += breedH
      const activeTotal = (ninv.horses.LIGHT_HORSE.active || 0) + (ninv.horses.HEAVY_HORSE.active || 0)
      const upkeep = Math.round(activeTotal * (0.005 * GOLD))
      walletDelta -= upkeep
      addNote(`Stable: +${breedL + breedH} foals; upkeep ${fmtCopper(upkeep)} for ${activeTotal} horses`)
    }

    setBuildings(updated)
    setInv(ninv)
    setWallet(w => w + walletDelta)
    return walletDelta
  }

  return {
    wallet, setWallet,
    inv, setInv,
    buildings, setBuildings,
    hasStable,
    applyBuildingIncome,
  }
}
