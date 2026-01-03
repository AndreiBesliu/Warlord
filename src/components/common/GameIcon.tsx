import React from 'react'

// Import the images directly so Vite handles the paths
import equipmentSheet from '../../assets/game_icons/equipment.png'
import coinSheet from '../../assets/game_icons/coins.png'
import shieldIcon from '../../assets/game_icons/shield.png'

export type IconName =
    | 'sword' | 'spear' | 'halberd'
    | 'bow' | 'heavy_armor' | 'light_armor'
    | 'horse_armor' | 'light_horse' | 'heavy_horse'
    | 'gold' | 'silver' | 'copper'
    | 'shield'

interface GameIconProps {
    name: IconName
    size?: number
    className?: string
}

export default function GameIcon({ name, size = 32, className = '' }: GameIconProps) {

    // Mapping for equipment.png (Assuming 3x3 grid)
    // Row 1: Sword, Spear, Halberd
    // Row 2: Bow, Heavy Armor, Light Armor (Wait, AI usually does random order, let's guess standard left-to-right)
    // Let's assume the order from the prompt: 
    // "iron sword, wooden spear, halberd, wooden bow, steel plate, leather armor, horse armor, light horse, heavy warhorse"

    const equipMap: Record<string, { x: number, y: number }> = {
        'sword': { x: 0, y: 0 },
        'spear': { x: 1, y: 0 },
        'halberd': { x: 2, y: 0 },
        'bow': { x: 0, y: 1 },
        'heavy_armor': { x: 1, y: 1 },
        'light_armor': { x: 2, y: 1 }, // leather
        'horse_armor': { x: 0, y: 2 },
        'light_horse': { x: 1, y: 2 },
        'heavy_horse': { x: 2, y: 2 },
    }

    // Mapping for coins.png (Assuming 3x3 grid to preserve aspect ratio, coins in middle row)
    const coinMap: Record<string, { x: number, y: number }> = {
        'gold': { x: 0, y: 1 },
        'silver': { x: 1, y: 1 },
        'copper': { x: 2, y: 1 },
    }

    let sheet = ''
    let x = 0
    let y = 0
    let cols = 1
    let rows = 1

    if (name === 'shield') {
        // Special case for single icon
        return (
            <img
                src={shieldIcon}
                alt={name}
                className={`inline-block shrink-0 ${className} object-contain`}
                style={{ width: size, height: size }}
            />
        )
    }

    if (name in equipMap) {
        sheet = equipmentSheet
        x = equipMap[name].x
        y = equipMap[name].y
        cols = 3
        rows = 3
    } else if (name in coinMap) {
        sheet = coinSheet
        x = coinMap[name].x
        y = coinMap[name].y
        cols = 3
        rows = 3 // Treat as square grid to avoid squashing
    } else {
        return null
    }

    // Calculate background position
    // For a 3x3 grid, percentage positions are 0%, 50%, 100%
    // Formula: (index / (total - 1)) * 100%

    const xPos = cols > 1 ? (x / (cols - 1)) * 100 : 0
    const yPos = rows > 1 ? (y / (rows - 1)) * 100 : 0

    return (
        <div
            className={`inline-block shrink-0 bg-no-repeat ${className}`}
            style={{
                backgroundImage: `url(${sheet})`,
                backgroundSize: `${cols * 100}% ${rows * 100}%`,
                backgroundPosition: `${xPos}% ${yPos}%`,
                width: size,
                height: size,
                // imageRendering: 'pixelated removed for smoother look
            }}
            title={name}
            aria-label={name}
        />
    )
}
