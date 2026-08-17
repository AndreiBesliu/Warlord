import { describe, it, expect, beforeEach } from 'vitest'
import { asFreshOath, decodeDesign, encodeDesign } from './traditionCode'
import { deepenBlocker, validateDesign, type TraditionDesign } from './tradition'
import { LEGACY_DESIGNS } from './traditionLegacy'
import { GameConfig } from './config'
import { primById } from './traditionPalette'
import type { DeedLedger } from './practice'

beforeEach(() => GameConfig.init(null))

const design = (over: Partial<TraditionDesign> = {}): TraditionDesign => ({
  v: 1, name: 'The Long Vigil', creed: 'They were on the wall before you were born.', sworeDay: 7,
  constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MAX_COHORTS', n: 9 }],
  nodes: [
    { id: 'n0', parent: null, prim: 'STEADFAST', steps: 2 },
    { id: 'n1', parent: 'n0', prim: 'SPOILS', steps: 3 },
  ],
  ...over,
})

describe('a tradition survives being written down and read back', () => {
  it('round-trips its promise and its shape', () => {
    const back = decodeDesign(encodeDesign(design()))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.design.name).toBe('The Long Vigil')
    expect(back.design.creed).toContain('on the wall')
    expect(back.design.constraints).toEqual(design().constraints)
    expect(back.design.nodes.map((n) => [n.prim, n.steps])).toEqual([['STEADFAST', 2], ['SPOILS', 3]])
  })

  it('carries parents as POSITIONS, so a link can never point outside the code', () => {
    const back = decodeDesign(encodeDesign(design()))
    if (!back.ok) throw new Error('expected ok')
    expect(back.design.nodes[0].parent).toBeNull()
    expect(back.design.nodes[1].parent).toBe(back.design.nodes[0].id)
  })

  it('every tradition that shipped by hand can be written as a code', () => {
    for (const [id, d] of Object.entries(LEGACY_DESIGNS)) {
      const back = decodeDesign(encodeDesign(d))
      expect(back.ok, `${id}`).toBe(true)
    }
  })

  it('survives text that is not ASCII', () => {
    const back = decodeDesign(encodeDesign(design({ name: 'Straja Îndelungată', creed: 'Așa a fost și așa rămâne — ⚔' })))
    if (!back.ok) throw new Error('expected ok')
    expect(back.design.name).toBe('Straja Îndelungată')
  })
})

describe('what a code CANNOT carry is the point', () => {
  it('holds no prices, thresholds or ceilings — only ids and counts', () => {
    // The safety argument in one assertion: nothing numeric in the payload is a game value,
    // so an inflated tradition is not representable rather than merely refused.
    const raw = atob(encodeDesign(design()).slice('WLT1:'.length).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))
    expect(raw).not.toMatch(/points|proofPerStep|step"|maxSteps|rebate/)
  })

  it('a hand-edited step count is clamped to what the piece allows', () => {
    const prim = primById('SPOILS')!
    const evil = design({ nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 99 }] })
    const back = decodeDesign(encodeDesign(evil))
    if (!back.ok) throw new Error('expected ok')
    expect(back.design.nodes[0].steps).toBe(prim.maxSteps)
  })

  it('an unknown piece is dropped rather than trusted', () => {
    const back = decodeDesign(encodeDesign(design({
      nodes: [{ id: 'n0', parent: null, prim: 'SORCERY', steps: 1 }, { id: 'n1', parent: null, prim: 'SPOILS', steps: 1 }],
    })))
    if (!back.ok) throw new Error('expected ok')
    expect(back.design.nodes.map((n) => n.prim)).toEqual(['SPOILS'])
  })

  it('a code that arrives illegal is refused in the validator OWN words', () => {
    // Not a vaguer "import error": it fails for the same stated reason it would have failed
    // at authoring, so the two doors agree.
    const noBan = design({ constraints: [{ kind: 'SHARE', cls: 'ARCHER', minPct: 50 }] })
    const back = decodeDesign(encodeDesign(noBan))
    expect(back.ok).toBe(false)
    if (back.ok) return
    expect(back.error).toBe(validateDesign(noBan).errors[0])
  })

  it('authored text is sanitised on the way in', () => {
    const back = decodeDesign(encodeDesign(design({ name: '⚠ The Warned' })))
    if (!back.ok) throw new Error('expected ok')
    expect(back.design.name).toBe('The Warned')
  })
})

describe('a code that did not survive being copied is refused, not half-read', () => {
  it('rejects a truncated code rather than decoding a smaller tradition', () => {
    // The real failure this guards: a chat client wraps the line, the tail is lost, and
    // without the check the remainder would decode into something legal-looking.
    const code = encodeDesign(design())
    expect(decodeDesign(code.slice(0, code.length - 8)).ok).toBe(false)
  })

  it('rejects a code with a tampered body', () => {
    const code = encodeDesign(design())
    const [body, sum] = code.slice('WLT1:'.length).split('.')
    expect(decodeDesign(`WLT1:${body.slice(0, -2)}XY.${sum}`).ok).toBe(false)
  })

  it('says plainly when it is not a tradition code at all', () => {
    for (const junk of ['', 'hello', 'WLT1', 'WLT2:abc.1234']) {
      const r = decodeDesign(junk)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
    }
  })
})

describe('you can be handed a tradition, never a history', () => {
  it('an imported oath starts with an empty tree', () => {
    const fresh = asFreshOath(design(), 40)
    expect(fresh.nodes).toEqual([])
    expect(fresh.constraints).toEqual(design().constraints)
    expect(fresh.sworeDay).toBe(40)
    expect(validateDesign(fresh).ok).toBe(true)
  })
})

describe('deepening — because the refusal told the player to do it', () => {
  const rich: DeedLedger = { victories: 999, daysGarrisoned: 999, slainMounted: 9999 }
  const one = design({ nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 1 }] })

  it('a piece already in the tree is deepened, not repeated', () => {
    expect(deepenBlocker(one, rich, 'n0', 2)).toBeNull()
  })

  it('refuses to go backwards or stand still', () => {
    expect(deepenBlocker(one, rich, 'n0', 1)).toMatch(/already at 1/)
    expect(deepenBlocker(one, rich, 'n0', 0)).toMatch(/already at 1/)
  })

  it('refuses past what the piece allows', () => {
    const prim = primById('SPOILS')!
    expect(deepenBlocker(one, rich, 'n0', prim.maxSteps + 1)).toMatch(/goes no further/)
  })

  it('asks the proof for the NEW TOTAL, not for the extra step', () => {
    // Part-paying the evidence would let a legion ladder up to a claim it never met.
    const prim = primById('SPOILS')!
    const justEnoughForOne: DeedLedger = { victories: prim.proofPerStep }
    expect(deepenBlocker(one, justEnoughForOne, 'n0', 2)).toMatch(new RegExp(`Needs ${prim.proofPerStep * 2}`))
  })

  it('charges only the DIFFERENCE in points', () => {
    const prim = primById('SPOILS')!
    // A level-1 wallet is 3 + the rebate; going 1 -> 2 costs one step, not two.
    const green: DeedLedger = { victories: 999 }
    expect(deepenBlocker(one, green, 'n0', 2)).toBeNull()
    expect(prim.points).toBeGreaterThan(0)
  })

  it('refuses an attribute that is not in this tree', () => {
    expect(deepenBlocker(one, rich, 'nowhere', 2)).toMatch(/not part of this tradition/)
  })

  it('an invalid design cannot be deepened', () => {
    expect(deepenBlocker({ ...one, invalid: true }, rich, 'n0', 2)).not.toBeNull()
  })
})
