import { IconName } from '../components/common/GameIcon'

export function getIconForGameItem(item: string): IconName {
    if (item.includes('SWORD')) return 'sword'
    if (item.includes('SPEAR')) return 'spear'
    if (item.includes('HALBERD')) return 'halberd'
    if (item.includes('BOW') || item.includes('ARCHER')) return 'bow'

    if (item === 'HEAVY_ARMOR') return 'heavy_armor'
    if (item === 'LIGHT_ARMOR') return 'light_armor'
    if (item === 'HORSE_ARMOR') return 'horse_armor'
    if (item === 'SHIELD') return 'shield'

    if (item === 'LIGHT_HORSE') return 'light_horse'
    if (item === 'HEAVY_HORSE') return 'heavy_horse'
    if (item === 'HORSE_ARCHER') return 'light_horse' // fallback

    if (item === 'gold') return 'gold'
    if (item === 'silver') return 'silver'
    if (item === 'copper') return 'copper'

    return 'sword' // default fallback
}
