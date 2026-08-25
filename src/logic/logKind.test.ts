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

// ── Three defects found on 2026-08-25, each measured on a real line before it was fixed ──

describe('DEFECT: the day rule was unreachable', () => {
  // Every day summary carries arrows, and the economy rule matched arrows while sitting ABOVE
  // the day rule — so a day line was always filed under Economy and the "Days" chip counted no
  // days at all. Only the arrow-less catch-up line ever reached it, which is why the existing
  // test above passed while the common case did not.
  for (const line of [
    'DAY 1675 — Nature → +1 Wood | House → +320 Wood',
    '8/25/2026, 9:31:25 PM — DAY 1675 — Nature → +1 Wood',
  ]) {
    it(`files "${line.slice(0, 30)}…" under day, not economy`, () => {
      expect(logKind(line)).toBe('day')
    })
  }
})

describe('DEFECT: the fallback pretended to be a category', () => {
  it('an unclassifiable line goes to `other`', () => {
    // It used to return 'day', so the Days chip doubled as the bucket for everything nobody had
    // written a rule for. A count under a label that does not describe it is worse than no count.
    expect(logKind('Something nobody wrote a rule for')).toBe('other')
  })

  it('and `other` is a real chip, so the miss is visible rather than hidden', () => {
    expect(LOG_KINDS.map((k) => k.kind)).toContain('other')
  })

  it('a rout is battle news, and used to land in that fallback', () => {
    expect(logKind('The Second Host routs')).toBe('campaign')
  })
})

describe('DEFECT: substring collisions filed ordinary words under Army', () => {
  it('opportunity and community are not units', () => {
    // `/unit/` with no boundary matches inside both words.
    expect(logKind('An opportunity in the market')).not.toBe('military')
    expect(logKind('Community festival held')).not.toBe('military')
  })

  it('while the PREFIXES the list was written for still match', () => {
    // The boundary belongs at the start only: a full \b…\b would break promot/conver/casualt.
    expect(logKind('Promoted 12 to VETERAN')).toBe('military')
    expect(logKind('Converted 20 to HEAVY_CAV')).toBe('military')
    expect(logKind('Casualties: 12')).toBe('campaign')
    expect(logKind('Units disbanded')).toBe('military')
  })
})
