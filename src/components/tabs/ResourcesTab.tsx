import Card from '../common/Card'
import type { ResourceMap } from '../../logic/types'
import { formatGameTooltip, getIconForGameItem } from '../../logic/iconHelpers'
import GameIcon from '../common/GameIcon'

type Props = {
    resources: ResourceMap
}

export default function ResourcesTab({ resources }: Props) {
    // Group resources
    // FOOD belongs here too: it is the one resource the army eats every single day,
    // and this tab used to omit it entirely.
    const raw = ['FOOD', 'WOOD', 'STONE', 'COAL', 'IRON_ORE', 'COPPER_ORE', 'SILVER_ORE']
    const ingots = ['IRON_INGOT', 'COPPER_INGOT', 'SILVER_INGOT'] // and maybe STEEL later

    return (
        <div className="space-y-4">
            <Card title="Raw Resources" className="bg-wl-panel-contrast text-wl-contrast-ink" titleClassName="text-wl-contrast-ink">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {raw.map(r => {
                        const val = resources[r as keyof ResourceMap] || 0
                        const icon = getIconForGameItem(r) || 'sword'
                        return (
                            <div key={r} className="bg-wl-panel-contrast p-3 rounded flex justify-between items-center border border-wl-line-strong">
                                <div className="flex items-center gap-3">
                                    <GameIcon name={icon} size={32} className="drop-shadow-md" />
                                    <span className="font-semibold text-wl-contrast-ink/80">{formatGameTooltip(r)}</span>
                                </div>
                                <span className="font-mono text-xl text-wl-contrast-ink">{val}</span>
                            </div>
                        )
                    })}
                </div>
            </Card>

            <Card title="Refined Materials" className="bg-wl-panel-contrast text-wl-contrast-ink" titleClassName="text-wl-contrast-ink">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {ingots.map(r => {
                        const val = resources[r as keyof ResourceMap] || 0
                        const icon = getIconForGameItem(r) || 'sword'
                        return (
                            <div key={r} className="bg-wl-panel-contrast p-3 rounded flex justify-between items-center border border-wl-line-strong">
                                <div className="flex items-center gap-3">
                                    <GameIcon name={icon} size={32} className="drop-shadow-md" />
                                    <span className="font-semibold text-wl-contrast-ink/80">{formatGameTooltip(r)}</span>
                                </div>
                                <span className="font-mono text-xl text-wl-contrast-ink">{val}</span>
                            </div>
                        )
                    })}
                </div>
            </Card>

            <div className="text-center text-xs text-wl-muted italic mt-4">
                Resources are gathered by Mines, Lumber Mills, and Quarries.
                <br />
                Refined materials are produced in Smelters.
            </div>
        </div>
    )
}
