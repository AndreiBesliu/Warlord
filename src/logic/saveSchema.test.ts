import { describe, it, expect } from 'vitest'
import {
  KNOWN_SAVE_KEYS, SAVE_SCHEMA, inspectSave, stampSave,
} from './saveSchema'

describe('reading a save decides whether this build may write one', () => {
  it('a save from before stamping existed is loadable and writable', () => {
    // Every save in the wild right now. Absent stamp means "the era before stamps",
    // not "corrupt" — treating it as newer would brick every existing kingdom.
    const i = inspectSave({ day: 4, units: [] })
    expect(i.schema).toBe(1)
    expect(i.fromNewerBuild).toBe(false)
  })

  it('a save from THIS build is writable', () => {
    expect(inspectSave({ schema: SAVE_SCHEMA }).fromNewerBuild).toBe(false)
  })

  it('a save from a NEWER build stops the writes', () => {
    expect(inspectSave({ schema: SAVE_SCHEMA + 1 }).fromNewerBuild).toBe(true)
    expect(inspectSave({ schema: SAVE_SCHEMA + 99 }).fromNewerBuild).toBe(true)
  })

  it('a garbled stamp reads as old, never as newer', () => {
    // A typo or a corrupted field must not be able to lock a player out of their own
    // kingdom. Refusing to write is the heavier outcome, so it needs a real number.
    for (const bad of [undefined, null, 'nine', NaN, Infinity, -3, {}, []]) {
      const i = inspectSave({ schema: bad })
      expect(i.schema).toBe(1)
      expect(i.fromNewerBuild).toBe(false)
    }
  })

  it('a missing or non-object save is not a newer save', () => {
    for (const bad of [undefined, null, 'x', 42]) {
      expect(inspectSave(bad).fromNewerBuild).toBe(false)
    }
  })

  it('a fractional stamp floors rather than rounding up into a refusal', () => {
    expect(inspectSave({ schema: SAVE_SCHEMA + 0.9 }).fromNewerBuild).toBe(false)
  })
})

describe('keys this build does not know survive the round trip', () => {
  it('carries an unknown top-level key through a save', () => {
    // The scenario: a newer build added `charters`, an older build opens the save. Even
    // if the stamp were forgotten, the data must not evaporate on the next write.
    const i = inspectSave({ day: 3, charters: [{ id: 'T1' }] })
    expect(i.carried).toEqual({ charters: [{ id: 'T1' }] })
    const out = stampSave({ day: 3 }, i.carried)
    expect(out).toMatchObject({ day: 3, charters: [{ id: 'T1' }], schema: SAVE_SCHEMA })
  })

  it('does not treat a key this build writes as unknown', () => {
    const i = inspectSave(Object.fromEntries(KNOWN_SAVE_KEYS.map((k) => [k, 1])))
    expect(i.carried).toEqual({})
  })

  it('the live value always beats a carried copy of the same key', () => {
    // If a future build ever drops a key from KNOWN_SAVE_KEYS, the carried copy must not
    // resurrect a stale value over the one the game is actually holding.
    const out = stampSave({ day: 9 }, { day: 1, mystery: true })
    expect(out.day).toBe(9)
    expect(out).toMatchObject({ mystery: true })
  })

  it('stamps even with nothing carried', () => {
    expect(stampSave({ day: 1 }).schema).toBe(SAVE_SCHEMA)
  })

  it('a stamped save re-reads as this build, with nothing left over', () => {
    const blob = Object.fromEntries(KNOWN_SAVE_KEYS.filter((k) => k !== 'schema').map((k) => [k, 1]))
    const round = inspectSave(stampSave(blob))
    expect(round.fromNewerBuild).toBe(false)
    expect(round.carried).toEqual({})
  })
})

describe('the key list is the contract', () => {
  it('names every key the save actually writes', () => {
    // If someone adds a key to the save blob and forgets this list, the key looks
    // "unknown" to its own build and gets carried — harmless, but the real cost is that
    // the SCHEMA bump gets forgotten with it. This test is here to be read, not to pass.
    expect(KNOWN_SAVE_KEYS).toContain('legions')
    expect(KNOWN_SAVE_KEYS).toContain('schema')
    expect(new Set(KNOWN_SAVE_KEYS).size).toBe(KNOWN_SAVE_KEYS.length)
  })

  it('the schema is a whole number at or above one', () => {
    expect(Number.isInteger(SAVE_SCHEMA)).toBe(true)
    expect(SAVE_SCHEMA).toBeGreaterThanOrEqual(1)
  })
})
