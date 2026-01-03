// src/components/tabs/MarketTab.tsx
import React from 'react'
import Card from '../common/Card'
import MarketPanel from '../common/MarketPanel'
import { Registry } from '../../logic/registry'

export default function MarketTab({ state }: { state: any }) {
  const { inv, buy, sell, buildings } = state
  const hasStable = buildings?.some((b: any) => b.type === 'STABLE')

  const items = Registry.getAllItems();
  const weapons = items.filter(i => i.type === 'WEAPON');
  const armors = items.filter(i => i.type === 'ARMOR');
  const horses = items.filter(i => i.type === 'HORSE');

  return (
    <Card title={`Market ${hasStable ? '' : '(buying horses requires STABLE)'}`}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MarketPanel
          title="Weapons"
          kind="WEAPON"
          options={weapons.map(i => ({ k: i.subtype, price: i.price }))}
          have={(k) => inv.weapons[k] ?? 0}
          onBuy={buy}
          onSell={sell}
        />
        <MarketPanel
          title="Armor"
          kind="ARMOR"
          options={armors.map(i => ({ k: i.subtype, price: i.price }))}
          have={(k) => inv.armors[k] ?? 0}
          onBuy={buy}
          onSell={sell}
        />
        <MarketPanel
          title="Horses"
          kind="HORSE"
          options={horses.map(i => ({ k: i.subtype, price: i.price }))}
          have={(k) => inv.horses[k]?.active ?? 0}
          onBuy={buy}
          onSell={sell}
        />
      </div>
    </Card>
  )
}
