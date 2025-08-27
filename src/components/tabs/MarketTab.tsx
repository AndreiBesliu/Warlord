import React from 'react'
import Card from '../common/Card'
import MarketPanel from '../common/MarketPanel'
import { WeaponPriceCopper, ArmorPriceCopper, HorsePriceCopper } from '../../logic/items'

export default function MarketTab({ state }: { state: any }) {
  const { inv, hasStable, buy, sell } = state

  return (
    <Card title={`Market ${hasStable ? '' : '(buying horses requires STABLE)'}`}>
      <div className="grid md:grid-cols-3 gap-4">
        <MarketPanel
          title="Weapons"
          kind="WEAPON"
          options={Object.keys(WeaponPriceCopper).map(k=>({k, price:(WeaponPriceCopper as any)[k]}))}
          have={(k)=>inv.weapons[k] ?? 0}
          onBuy={buy}
          onSell={sell}
        />
        <MarketPanel
          title="Armor"
          kind="ARMOR"
          options={Object.keys(ArmorPriceCopper).map(k=>({k, price:(ArmorPriceCopper as any)[k]}))}
          have={(k)=>inv.armors[k] ?? 0}
          onBuy={buy}
          onSell={sell}
        />
        <MarketPanel
          title="Horses"
          kind="HORSE"
          options={Object.keys(HorsePriceCopper).map(k=>({k, price:(HorsePriceCopper as any)[k]}))}
          have={(k)=>inv.horses[k]?.active ?? 0}
          onBuy={buy}
          onSell={sell}
        />
      </div>
    </Card>
  )
}
