import { describe, it, expect } from 'vitest'
import { logKind, stripTimestamp, LOG_KINDS } from './logKind'

// The strings below are copied from the code that writes them, not invented — a
// categoriser tested against imaginary input proves nothing.
describe('logKind sorts the real lines the game writes', () => {
  it('flags warnings first, whatever else the line mentions', () => {
    expect(logKind('Day 41 — ⚠ Nu poți plăti upkeep-ul! | Wallet Δ -12g')).toBe('alert')
    expect(logKind('Not enough resources: need 30 WOOD.')).toBe('alert')
  })

  it('recognises research', () => {
    expect(logKind('🔬 Research complete: Iron Tools.')).toBe('research')
    expect(logKind('🔬 Drill Fields requires: Iron Tools.')).toBe('research')
  })

  it('recognises battles', () => {
    expect(logKind('Victory! Bandit Raid cleared — loot 4g')).toBe('campaign')
    expect(logKind('Defeat at Rival Baron — casualties 12')).toBe('campaign')
  })

  it('recognises army business', () => {
    expect(logKind('Training queue full.')).toBe('military')
    expect(logKind('Promoted 4 NOVICE → TRAINED')).toBe('military')
  })

  it('recognises the economy', () => {
    expect(logKind('SMELTER → Smelted 19 IRON_INGOT (gain 4g)')).toBe('economy')
    expect(logKind('Nature → +1 Wood')).toBe('economy')
    expect(logKind('Stable: +2 foals; upkeep 10g for 202 horses')).toBe('economy')
  })

  it('treats the day summary and the offline catch-up as day entries', () => {
    expect(logKind('⏳ Away 40m — resolving 8 days.')).toBe('day')
  })

  it('never returns a kind that has no filter chip', () => {
    const known = new Set(LOG_KINDS.map((k) => k.kind))
    for (const line of ['', 'something entirely unexpected', 'Day 3 — quiet']) {
      expect(known.has(logKind(line))).toBe(true)
    }
  })
})

describe('stripTimestamp removes the clock, not the content', () => {
  it('drops a real timestamp prefix', () => {
    expect(stripTimestamp('8/1/2026, 9:31:25 PM — ⏳ Away 40m')).toBe('⏳ Away 40m')
  })

  it('leaves a line whose dash is part of the message', () => {
    const line = 'Victory — loot 4g'
    expect(stripTimestamp(line)).toBe(line)
  })

  it('leaves a line with no dash at all', () => {
    expect(stripTimestamp('Training queue full.')).toBe('Training queue full.')
  })
})
