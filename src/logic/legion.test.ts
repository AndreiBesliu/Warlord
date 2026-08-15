import { describe, it, expect } from 'vitest'
import {
  LEGION_MAX_HONOURS, LEGION_MAX_UNITS, LEGION_NAME_MAX,
  addHonour, cohortLabel, emptyLegion, joinBlocker, legionOfUnit, pruneMembership,
  sanitizeLegionName, suggestLegionName, unitsOfLegion, roman, awardVictoryHonours,
  type Legion,
} from './legion'
import { hydrateLegions } from '../state/useLegions'
import { logKind } from './logKind'
import type { Unit } from './types'

const unitOf = (id: string): Unit => ({
  id, type: 'LIGHT_INF_SPEAR', buckets: [{ r: 'NOVICE', count: 10, avgXP: 0 }],
  avgXP: 0, training: false, morale: 100,
  equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
})

const legionOf = (name: string, unitIds: string[] = []): Legion =>
  ({ ...emptyLegion(name, 1), unitIds })

describe('the game never suggests a name the army already carries', () => {
  it('thirty legions get thirty distinct names', () => {
    const names: string[] = []
    for (let i = 0; i < 30; i++) names.push(suggestLegionName(names))
    expect(new Set(names).size).toBe(30)
  })

  it('disbanding one from the middle does not hand its successor a taken name', () => {
    // The bug in "count what exists and add one": drop the Second of three and the counter
    // says 2, which is the name the Third is still using.
    const names = ['The First Host', 'The Second Host', 'The Third Host']
    const afterDisband = names.filter((n) => n !== 'The Second Host')
    const next = suggestLegionName(afterDisband)
    expect(afterDisband).not.toContain(next)
    expect(next).toBe('The Second Host') // it reuses the freed one, which is correct
  })

  it('respects a name the player typed by hand', () => {
    // Counting cannot see this at all: one legion exists, so a counter proposes the Second.
    const typed = ['The Second Host']
    const next = suggestLegionName(typed)
    expect(next).not.toBe('The Second Host')
  })

  it('ignores case and stray spacing when deciding what is taken', () => {
    expect(suggestLegionName(['  the   FIRST host '])).not.toMatch(/first/i)
  })

  it('still returns something when hundreds of names are taken', () => {
    const taken: string[] = []
    for (let i = 0; i < 300; i++) taken.push(suggestLegionName(taken))
    const next = suggestLegionName(taken)
    expect(next.length).toBeGreaterThan(0)
    expect(taken).not.toContain(next)
  })
})

describe('a legion name cannot break the screens it appears on', () => {
  it('an empty or blank name falls back to what the CALLER supplied', () => {
    // Never a fresh suggestion: clearing the field while renaming must give the name back,
    // not rebaptise the legion.
    expect(sanitizeLegionName('', 'The Ninth Host')).toBe('The Ninth Host')
    expect(sanitizeLegionName('   \t  ', 'The Ninth Host')).toBe('The Ninth Host')
  })

  it('cannot file its own log lines under Warnings or Research', () => {
    // `logKind` scans the whole line and tests these two glyphs with `includes`, before
    // anything else. A legion carrying them would misfile every line about itself.
    const nasty = sanitizeLegionName('⚠️ Doom 🔬 Corps', 'fallback')
    expect(logKind(`${nasty} was raised.`)).not.toBe('alert')
    expect(logKind(`${nasty} was raised.`)).not.toBe('research')
  })

  it('leaves ordinary words alone, even ones the log classifier reacts to', () => {
    // The line: strip marker GLYPHS, never words. A legion may be called The Victors and
    // have its lines filed under Battles — cosmetic. Mutilating a chosen name is worse.
    expect(sanitizeLegionName('The Victors', 'x')).toBe('The Victors')
  })

  it('strips control characters', () => {
    expect(sanitizeLegionName('Ni\u0000nth\u0007 Ho\u001fst', 'x')).toBe('Ninth Host')
  })

  it('takes the marker glyph WITH its variation selector, and leaves other emoji whole', () => {
    // A blunt strip of every U+FE0F would quietly change how an unrelated emoji renders.
    expect(sanitizeLegionName('\u26a0\ufe0fWatch', 'x')).toBe('Watch')
    expect(sanitizeLegionName('\u{1F6E1}\ufe0f Guard', 'x')).toBe('\u{1F6E1}\ufe0f Guard')
  })

  it('caps the length without cutting a character in half', () => {
    const long = '🛡️'.repeat(80)
    const out = sanitizeLegionName(long, 'x')
    expect([...out].length).toBeLessThanOrEqual(LEGION_NAME_MAX)
    expect(out).not.toContain('�')
  })

  it('sanitising twice changes nothing', () => {
    // It runs on load and on every rename.
    const once = sanitizeLegionName('  The   Ninth   Host  ', 'x')
    expect(sanitizeLegionName(once, 'x')).toBe(once)
  })
})

describe('membership is resolved against the living army, not maintained on death', () => {
  it('a unit that no longer exists is simply not there', () => {
    // The whole reason for this design: a unit id dies in seven places, one of them the
    // PvP write-back, which rewrites the saved army from outside this game's state.
    const legion = legionOf('The First Host', ['A', 'B', 'C'])
    const survivors = [unitOf('A'), unitOf('C')]
    expect(unitsOfLegion(legion, survivors).map((u) => u.id)).toEqual(['A', 'C'])
  })

  it('cohorts close ranks — numbering counts the living', () => {
    const legion = legionOf('The First Host', ['A', 'B', 'C'])
    const afterBLost = [unitOf('A'), unitOf('C')]
    expect(cohortLabel(legion, afterBLost, 'A')).toBe('Cohort I')
    expect(cohortLabel(legion, afterBLost, 'C')).toBe('Cohort II')
    expect(cohortLabel(legion, afterBLost, 'B')).toBe('')
  })

  it('keeps the legion order, not the army order', () => {
    const legion = legionOf('The First Host', ['C', 'A'])
    expect(unitsOfLegion(legion, [unitOf('A'), unitOf('C')]).map((u) => u.id)).toEqual(['C', 'A'])
  })

  it('pruning drops the dead and returns the SAME object when nothing died', () => {
    const legion = legionOf('The First Host', ['A', 'B'])
    const alive = [unitOf('A'), unitOf('B')]
    expect(pruneMembership(legion, alive)).toBe(legion) // no needless state write
    expect(pruneMembership(legion, [unitOf('A')]).unitIds).toEqual(['A'])
  })

  it('roman numerals for the cohorts a legion can actually hold', () => {
    expect([1, 4, 9, 12].map(roman)).toEqual(['I', 'IV', 'IX', 'XII'])
  })
})

describe('a legion is as large as a battle can hold', () => {
  it('refuses the thirteenth cohort, and says why', () => {
    // Twelve is not a taste decision: PvP rejects a thirteenth combatant server-side, and
    // the campaign silently stacks them onto occupied tiles above twenty-four.
    const ids = Array.from({ length: LEGION_MAX_UNITS }, (_, i) => `U${i}`)
    const legion = legionOf('The First Host', ids)
    const units = ids.map(unitOf).concat(unitOf('NEW'))
    const why = joinBlocker(legion, 'NEW', units, [legion])
    expect(why).toBeTruthy()
    expect(why).toContain(String(LEGION_MAX_UNITS))
  })

  it('counts the LIVING when deciding it is full', () => {
    // A legion whose cohorts all fell has room again, even though the rolls still name them.
    const ids = Array.from({ length: LEGION_MAX_UNITS }, (_, i) => `U${i}`)
    const legion = legionOf('The First Host', ids)
    expect(joinBlocker(legion, 'NEW', [unitOf('NEW')], [legion])).toBeNull()
  })

  it('a unit cannot serve two legions at once', () => {
    const a = legionOf('The First Host', ['U1'])
    const b = legionOf('The Second Host', [])
    const why = joinBlocker(b, 'U1', [unitOf('U1')], [a, b])
    expect(why).toContain('The First Host')
    expect(legionOfUnit([a, b], 'U1')?.name).toBe('The First Host')
  })

  it('refuses a unit it already holds', () => {
    const a = legionOf('The First Host', ['U1'])
    expect(joinBlocker(a, 'U1', [unitOf('U1')], [a])).toBeTruthy()
  })
})

describe('honours are counted, not listed', () => {
  it('the same feat twice is one honour with a count', () => {
    // The whole save travels to Firestore as one document; the activity log is capped for
    // exactly this reason.
    let h = addHonour([], { key: 'WIN:RAID', label: 'Victor of Raid', day: 3 })
    h = addHonour(h, { key: 'WIN:RAID', label: 'Victor of Raid', day: 9 })
    expect(h).toHaveLength(1)
    expect(h[0].count).toBe(2)
  })

  it('remembers when it was FIRST earned, not most recently', () => {
    let h = addHonour([], { key: 'WIN:RAID', label: 'Victor of Raid', day: 3 })
    h = addHonour(h, { key: 'WIN:RAID', label: 'Victor of Raid', day: 90 })
    expect(h[0].firstDay).toBe(3)
  })

  it('different feats are different honours', () => {
    let h = addHonour([], { key: 'WIN:RAID', label: 'Victor of Raid', day: 1 })
    h = addHonour(h, { key: 'WIN:INVASION', label: 'Victor of Invasion', day: 2 })
    expect(h).toHaveLength(2)
  })

  it('cannot grow without bound', () => {
    let h: ReturnType<typeof addHonour> = []
    for (let i = 0; i < 500; i++) h = addHonour(h, { key: `K${i}`, label: `L${i}`, day: i })
    expect(h.length).toBeLessThanOrEqual(LEGION_MAX_HONOURS)
    // The oldest are what a legion is known for; a cap that dropped those would rewrite it.
    expect(h[0].key).toBe('K0')
  })
})

describe('a save from before legions existed', () => {
  it('loads as no legions rather than undefined', () => {
    for (const bad of [undefined, null, 'x', 42, {}, { legions: [] }]) {
      expect(hydrateLegions(bad)).toEqual([])
    }
  })

  it('round-trips through JSON unchanged', () => {
    const legions = [{ ...legionOf('The First Host', ['A', 'B']), honours: [{ key: 'K', label: 'L', count: 3, firstDay: 7 }] }]
    expect(hydrateLegions(JSON.parse(JSON.stringify(legions)))).toEqual(legions)
  })

  it('is idempotent — loading twice changes nothing', () => {
    const once = hydrateLegions([legionOf('The First Host', ['A'])])
    expect(hydrateLegions(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })

  it('throws nothing away that it can repair, and drops what it cannot', () => {
    const out = hydrateLegions([
      { id: 'L1', name: 'The First Host', foundedDay: 4, unitIds: ['A', 'A', 'B'], honours: [] },
      { name: 'no id' },
      null,
      'garbage',
    ])
    expect(out).toHaveLength(1)
    // A unit listed twice would number the cohorts wrong and let one unit fight twice.
    expect(out[0].unitIds).toEqual(['A', 'B'])
  })

  it('never loads a legion larger than a battle can hold', () => {
    const tooMany = Array.from({ length: 40 }, (_, i) => `U${i}`)
    const out = hydrateLegions([{ id: 'L1', name: 'X', foundedDay: 1, unitIds: tooMany, honours: [] }])
    expect(out[0].unitIds.length).toBe(LEGION_MAX_UNITS)
  })
})

describe('only the legions that came home are decorated', () => {
  const entry = { key: 'WIN:EASY', label: 'Victor of Bandit Raid', day: 12 }

  it('decorates a legion whose cohorts survived', () => {
    const home = legionOf('The First Host', ['A', 'B'])
    const out = awardVictoryHonours([home], ['A', 'B'], entry)
    expect(out[0].honours).toHaveLength(1)
    expect(out[0].honours[0].label).toBe('Victor of Bandit Raid')
  })

  it('does NOT decorate a legion that stayed home', () => {
    // Undeployed units pass through the battle result untouched, so a careless pass would
    // decorate the whole standing army with a victory it never marched to.
    const away = legionOf('The Second Host', ['Z'])
    expect(awardVictoryHonours([away], ['A', 'B'], entry)[0].honours).toEqual([])
  })

  it('a legion wiped out to the last cohort earns nothing', () => {
    // Its units are gone from the army entirely — there is nobody left to decorate.
    const dead = legionOf('The Third Host', ['X', 'Y'])
    expect(awardVictoryHonours([dead], [], entry)[0].honours).toEqual([])
  })

  it('one surviving cohort is enough — the legion came home', () => {
    const mauled = legionOf('The Fourth Host', ['A', 'B', 'C'])
    expect(awardVictoryHonours([mauled], ['B'], entry)[0].honours).toHaveLength(1)
  })

  it('winning the same mission twice is one honour with a count of two', () => {
    const l = legionOf('The First Host', ['A'])
    const once = awardVictoryHonours([l], ['A'], entry)
    const twice = awardVictoryHonours(once, ['A'], { ...entry, day: 40 })
    expect(twice[0].honours).toHaveLength(1)
    expect(twice[0].honours[0].count).toBe(2)
    expect(twice[0].honours[0].firstDay).toBe(12)
  })

  it('leaves every other field of the legion alone', () => {
    const l = legionOf('The First Host', ['A'])
    const out = awardVictoryHonours([l], ['A'], entry)[0]
    expect({ ...out, honours: [] }).toEqual({ ...l, honours: [] })
  })
})
