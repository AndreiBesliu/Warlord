import { describe, it, expect, beforeEach } from 'vitest'
import {
  channelsOf, classesOf, describeNode, growBlocker, grownNode, joinBan,
  legionChannelsByUnit, nodeDepth, outOfKeeping, sanitizeAuthoredText, spentPoints,
  validateDesign, type TraditionDesign,
} from './tradition'
import {
  CHANNEL_CAP, CONSTRAINT_OPTIONS, EFFECT_PRIMS, NO_CHANNELS, TIER_LEVEL, pointBudget,
  primById, type Constraint,
} from './traditionPalette'
import { LEGACY_DESIGNS, legacyDesign, legacyEarned } from './traditionLegacy'
import { GameConfig } from './config'
import { SoldierTypes, type SoldierType, type Unit } from './types'
import type { DeedLedger } from './practice'
import { applyBattleResult, DEFEAT_XP_KEEP } from './combat/army'
import { XP_CAP } from './combat/stats'
import type { BattleState, Combatant } from './combat/types'
import { hydrateLegions } from '../state/useLegions'

beforeEach(() => GameConfig.init(null))

const unit = (id: string, type: SoldierType, count = 20, avgXP = 0): Unit => ({
  id, type, buckets: [{ r: 'NOVICE', count, avgXP }], avgXP, training: false, morale: 100,
  equip: { weapons: {}, armors: {}, horses: {} }, loadout: null,
})

const design = (over: Partial<TraditionDesign> = {}): TraditionDesign => ({
  v: 1, name: 'The Iron Host', creed: 'They hold.', sworeDay: 3,
  constraints: [{ kind: 'DENY', cls: 'MOUNTED' }],
  nodes: [], ...over,
})

describe('a demand that demands nothing is refused at authoring time', () => {
  // This is the half that stops authoring from collapsing. Every kind of demand has a
  // no-op instantiation, and a design built out of those is twelve attributes behind twelve
  // free promises — "bonus AND constraint" reduced to a checkbox that says yes.

  it('a cohort cap equal to the cap that already exists forbids nothing', () => {
    const d = design({ constraints: [{ kind: 'MAX_COHORTS', n: 12 }] })
    expect(validateDesign(d).ok).toBe(false)
    expect(validateDesign(d).errors.join(' ')).toMatch(/forbids nothing/)
  })

  it('a cap one under it is a real promise', () => {
    expect(validateDesign(design({ constraints: [{ kind: 'MAX_COHORTS', n: 11 }] })).ok).toBe(true)
  })

  it('demanding one cohort asks nothing', () => {
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MIN_COHORTS', n: 1 }] })
    expect(validateDesign(d).errors.join(' ')).toMatch(/asks nothing/)
  })

  it('a one-percent share asks nothing', () => {
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'SHARE', cls: 'ARCHER', minPct: 1 }] })
    expect(validateDesign(d).errors.join(' ')).toMatch(/asks nothing/)
  })

  it('a tradition must REFUSE something, not merely require something', () => {
    // A share and a minimum are both breakable by a casualty, so neither can refuse at the
    // door. Without a monotone ban a tradition never says no to anything.
    const d = design({ constraints: [{ kind: 'SHARE', cls: 'HEAVY_FOOT', minPct: 50 }] })
    expect(validateDesign(d).errors.join(' ')).toMatch(/must REFUSE something/)
  })

  it('the same demand cannot be taken twice', () => {
    const d = design({ constraints: [{ kind: 'MAX_COHORTS', n: 6 }, { kind: 'MAX_COHORTS', n: 9 }] })
    expect(validateDesign(d).errors.join(' ')).toMatch(/once/)
  })

  it('but refusing two different kinds of soldier is two different promises', () => {
    // The Iron Vow denies horsemen AND archers. A uniqueness rule keyed on the kind alone
    // would have made a tradition that shipped by hand unsayable — which is exactly what
    // the legacy test is for.
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'DENY', cls: 'ARCHER' }] })
    expect(validateDesign(d).ok).toBe(true)
  })

  it('refusing both halves of the roster leaves nobody to serve', () => {
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'DENY', cls: 'FOOT' }] })
    expect(validateDesign(d).errors.join(' ')).toMatch(/nobody to serve/)
  })

  it('every ready-made option the game offers actually passes its own floors', () => {
    // The options a player picks from must not be able to author a refused design; if one
    // could, the floor and the palette disagree and the player finds out, not us.
    for (const opt of CONSTRAINT_OPTIONS) {
      const cs: Constraint[] = [opt.value]
      // Pair a standing demand with a ban so the monotone rule is not what fails.
      if (opt.value.kind === 'SHARE' || opt.value.kind === 'MIN_COHORTS') {
        cs.push({ kind: 'DENY', cls: opt.value.kind === 'SHARE' && opt.value.cls === 'MOUNTED' ? 'ARCHER' : 'MOUNTED' })
      }
      const r = validateDesign(design({ constraints: cs }))
      expect(r.ok, `${opt.label}: ${r.errors.join(', ')}`).toBe(true)
    }
  })
})

describe('the four that shipped by hand can be said in the authored vocabulary', () => {
  // THE most valuable test here. If the palette cannot express what four hand-written
  // traditions said, the palette is too small to hand to a player — and the fix is the
  // palette, never an exemption in the migration.
  it('every legacy design validates', () => {
    for (const [id, d] of Object.entries(LEGACY_DESIGNS)) {
      const r = validateDesign(d)
      expect(r.ok, `${id}: ${r.errors.join(', ')}`).toBe(true)
    }
  })

  it('each keeps its own shape rather than collapsing into one', () => {
    const shapes = Object.values(LEGACY_DESIGNS).map((d) => d.constraints.map((c) => c.kind).sort().join('+'))
    expect(new Set(shapes).size).toBeGreaterThan(1)
    const prims = Object.values(LEGACY_DESIGNS).flatMap((d) => d.nodes.map((n) => n.prim))
    expect(new Set(prims).size).toBeGreaterThan(4)
  })

  it('a legion migrated from a legacy oath keeps what it already paid for', () => {
    expect(legacyEarned('SHIELDWALL')).toEqual(['n0', 'n1'])
    expect(legacyDesign('SHIELDWALL', 42)?.sworeDay).toBe(42)
    expect(legacyDesign('NOT_A_THING', 1)).toBeNull()
    expect(legacyDesign(null, 1)).toBeNull()
  })
})

describe('growing the tree needs level, proof and points at once', () => {
  const rich: DeedLedger = {
    victories: 99, heldTheLine: 99, flawless: 99, hardWon: 99, defeats: 99,
    slainMounted: 9999, slainArcher: 9999, slainHeavyFoot: 9999,
    daysGarrisoned: 999, daysDrilled: 999, daysPatrolled: 999,
  }
  const want = (prim: string, steps = 1, parent: string | null = null) => ({ prim, steps, parent })

  it('a fresh legion has the level for the root tier and nothing deeper', () => {
    expect(TIER_LEVEL[0]).toBe(1)
    expect(TIER_LEVEL[1]).toBeGreaterThan(1)
  })

  it('refuses without the proof, and says how far off it is', () => {
    const d = design()
    expect(growBlocker(d, { victories: 99 }, want('HORSEBREAKERS')))
      .toMatch(/Needs 120 horsemen slain, has 0/)
  })

  it('refuses without the level, once the tree goes deeper', () => {
    const d = design({ nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 1 }] })
    // Level 1 (no renown at all) cannot reach the second tier however much proof it has.
    expect(growBlocker(d, { daysGarrisoned: 999 }, want('STEADFAST', 1, 'n0')))
      .toMatch(/Needs Level 3/)
  })

  it('refuses without the points', () => {
    // A LEVEL-1 ledger with plenty of proof: the wall it hits has to be the wallet, not
    // the level or the evidence, or the test proves nothing about points.
    const green: DeedLedger = { slainMounted: 9999 }
    const prim = primById('HORSEBREAKERS')!
    expect(growBlocker(design(), green, want('HORSEBREAKERS', prim.maxSteps))).toMatch(/points/)
  })

  it('refuses a piece the tradition already has — deepen it, do not repeat it', () => {
    const d = design({ nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 1 }] })
    expect(growBlocker(d, rich, want('SPOILS'))).toMatch(/already part of this tradition/)
  })

  it('refuses a parent that is not in the tree', () => {
    expect(growBlocker(design(), rich, want('SPOILS', 1, 'nowhere'))).toMatch(/not part of this tradition/)
  })

  it('refuses more steps than a piece has', () => {
    const prim = primById('SPOILS')!
    expect(growBlocker(design(), rich, want('SPOILS', prim.maxSteps + 1))).toMatch(/takes 1 to/)
  })

  it('lets a legion that has done the work take the piece', () => {
    expect(growBlocker(design(), rich, want('SPOILS', 1))).toBeNull()
  })

  it('a grown node lands at the right depth and keeps its parent', () => {
    let d = design()
    d = { ...d, nodes: [...d.nodes, grownNode(d, want('SPOILS'))] }
    expect(nodeDepth(d, 'n0')).toBe(0)
    d = { ...d, nodes: [...d.nodes, grownNode(d, want('STEADFAST', 1, 'n0'))] }
    expect(nodeDepth(d, 'n1')).toBe(1)
    expect(d.nodes[1].parent).toBe('n0')
  })

  it('an invalid design cannot be grown at all', () => {
    expect(growBlocker({ ...design(), invalid: true }, rich, want('SPOILS'))).not.toBeNull()
  })

  it('the budget rises with level and the constraints pay out at once', () => {
    expect(pointBudget(1)).toBeLessThan(pointBudget(5))
    const green: DeedLedger = { slainMounted: 9999 }
    const bare = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }] })
    const heavy = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MAX_COHORTS', n: 4 }] })
    // Giving up more buys more, immediately, at level 1 — the rebate is paid at founding.
    expect(growBlocker(heavy, green, want('HORSEBREAKERS', 3))).toBeNull()
    expect(growBlocker(bare, green, want('HORSEBREAKERS', 3))).toMatch(/points/)
  })
})

describe('the ceilings bound the TOTAL, not each piece', () => {
  it('stacking every morale piece cannot exceed the aggregate cap', () => {
    const nodes = EFFECT_PRIMS.filter((p) => p.channel === 'moraleFloor')
      .map((p, i) => ({ id: `n${i}`, parent: null, prim: p.id, steps: p.maxSteps }))
    const ch = channelsOf(design({ nodes }))
    expect(ch.moraleFloor).toBe(CHANNEL_CAP.moraleFloor)
  })

  it('a defeat may teach as much as a victory and never more', () => {
    const p = primById('HARD_LESSONS')!
    const ch = channelsOf(design({ nodes: [{ id: 'n0', parent: null, prim: p.id, steps: p.maxSteps }] }))
    expect(DEFEAT_XP_KEEP + ch.defeatXpBonus).toBeLessThanOrEqual(1)
  })

  it('duties may become cheap, never a printer', () => {
    const nodes = EFFECT_PRIMS.filter((p) => p.channel === 'dutyCopperMult')
      .map((p, i) => ({ id: `n${i}`, parent: null, prim: p.id, steps: p.maxSteps }))
    expect(channelsOf(design({ nodes })).dutyCopperMult).toBeGreaterThanOrEqual(CHANNEL_CAP.dutyCopperMult)
  })

  it('no tradition at all is the identity for every channel', () => {
    expect(channelsOf(null)).toEqual(NO_CHANNELS)
    expect(channelsOf(design())).toEqual(NO_CHANNELS)
    expect(channelsOf({ ...design(), invalid: true })).toEqual(NO_CHANNELS)
  })

  it('what the screen promises comes from the same numbers the game applies', () => {
    const node = { id: 'n0', parent: null, prim: 'UNBROKEN', steps: 2 }
    const ch = channelsOf(design({ nodes: [node] }))
    expect(describeNode(node)).toContain(String(ch.moraleFloor))
  })
})

describe('the XP ceiling still cannot be lifted — only a defeat is negotiable', () => {
  const combatant = (kills: number, side: 'PLAYER' | 'ENEMY' = 'PLAYER'): Combatant => ({
    id: 'P0', side, unitId: 'a', type: 'HEAVY_INF_SWORD', name: 'x', x: 0, y: 0,
    hp: 20, hpStart: 20, morale: 100, vet: 0, kills, hasMoved: false, hasActed: false,
    routed: false, buckets: [{ r: 'NOVICE', count: 20, avgXP: 0 }],
  })
  const battle = (kills: number, won: boolean): BattleState => ({
    version: 1, seed: 1, rngCursor: 0, width: 4, height: 4, terrain: {},
    combatants: [combatant(kills)], turn: 1, side: 'PLAYER', phase: 'RESOLVED',
    status: won ? 'PLAYER_WON' : 'ENEMY_WON', winner: won ? 'PLAYER' : 'ENEMY',
    log: [], config: { lethality: 0.35, maxTurns: 20 }, difficulty: 'BANDIT_RAID',
  })
  const xp = (kills: number, won: boolean, keep?: number) =>
    applyBattleResult([unit('a', 'HEAVY_INF_SWORD')], battle(kills, won), ['a'], 'PLAYER',
      keep === undefined ? undefined : () => keep).report[0].xpGain

  it('a massacre gives exactly the cap, whatever a tradition says', () => {
    expect(xp(100, true)).toBe(XP_CAP)
    expect(xp(100, true, 1)).toBe(XP_CAP)
  })

  it('a defeat normally keeps 40% of what it earned', () => {
    expect(xp(100, false)).toBe(Math.round(XP_CAP * DEFEAT_XP_KEEP))
  })

  it('a tradition may raise that, up to everything', () => {
    expect(xp(100, false, 1)).toBe(XP_CAP)
    expect(xp(100, false, 0.7)).toBeGreaterThan(xp(100, false))
  })

  it('and cannot push a defeat past a victory', () => {
    expect(xp(100, false, 99)).toBeLessThanOrEqual(xp(100, true))
  })
})

describe('constraints in play', () => {
  it('a ban refuses at the door and names what it refuses', () => {
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }] })
    expect(joinBan(d, 'HEAVY_CAV', 0, 'The Iron Host')).toMatch(/sworn against horsemen/)
    expect(joinBan(d, 'HEAVY_INF_SWORD', 0, 'The Iron Host')).toBeNull()
  })

  it('a cohort cap refuses at the door AND suspends when already exceeded', () => {
    // Both halves matter: a save can arrive holding more cohorts than the oath allows, and
    // a rule that only ever ran on the way in would never notice.
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MAX_COHORTS', n: 4 }] })
    expect(joinBan(d, 'HEAVY_INF_SWORD', 4, 'X')).toMatch(/no more than 4/)
    const seven = Array.from({ length: 7 }, (_, i) => unit(`u${i}`, 'HEAVY_INF_SWORD'))
    expect(outOfKeeping(d, seven)).toMatch(/holds 7 cohorts where it swore to 4/)
  })

  it('a proportion suspends but never revokes, with the real numbers', () => {
    const d = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'SHARE', cls: 'HEAVY_FOOT', minPct: 50 }] })
    const ok = [unit('a', 'HEAVY_INF_SWORD'), unit('b', 'LIGHT_INF_SPEAR')]
    expect(outOfKeeping(d, ok)).toBeNull()
    expect(outOfKeeping(d, [unit('b', 'LIGHT_INF_SPEAR')])).toMatch(/needs 1 of 1/)
  })

  it('an empty legion is out of keeping for EVERY standing demand', () => {
    // One predicate, no exceptions: 0 of 0 is arithmetically satisfied, but a legion with
    // nobody in it is not keeping anything.
    const share = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'SHARE', cls: 'HEAVY_FOOT', minPct: 50 }] })
    const min = design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MIN_COHORTS', n: 8 }] })
    expect(outOfKeeping(share, [])).not.toBeNull()
    expect(outOfKeeping(min, [])).not.toBeNull()
  })

  it('a tradition with only bans is always in keeping', () => {
    expect(outOfKeeping(design({ constraints: [{ kind: 'DENY', cls: 'MOUNTED' }] }), [])).toBeNull()
  })

  it('an out-of-keeping legion is owed nothing at all', () => {
    const d = design({
      constraints: [{ kind: 'DENY', cls: 'MOUNTED' }, { kind: 'MIN_COHORTS', n: 8 }],
      nodes: [{ id: 'n0', parent: null, prim: 'UNBROKEN', steps: 2 }],
    })
    const map = legionChannelsByUnit([{ unitIds: ['a'], tradition: d }], [unit('a', 'HEAVY_INF_SWORD')])
    expect(map.size).toBe(0)
  })
})

describe('type classes are derived, not listed', () => {
  it('every soldier type lands in at least one class', () => {
    for (const t of SoldierTypes) expect(classesOf(t).length).toBeGreaterThan(0)
  })
  it('a horse archer is both mounted and an archer', () => {
    expect(classesOf('HORSE_ARCHER').sort()).toEqual(['ARCHER', 'MOUNTED'])
  })
})

describe('what a save may carry', () => {
  it('a legacy oath is migrated on load, with its day', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'Old', foundedDay: 3, unitIds: [], honours: [],
      tradition: 'SHIELDWALL', traditionDay: 42,
    }])
    expect(l.tradition?.name).toBe('The Shieldwall')
    expect(l.tradition?.sworeDay).toBe(42)
    expect(l.tradition?.nodes.length).toBeGreaterThan(0)
    expect(validateDesign(l.tradition!).ok).toBe(true)
  })

  it('a save from before traditions loads as none', () => {
    const [l] = hydrateLegions([{ id: 'L1', name: 'Old', foundedDay: 3, unitIds: [], honours: [] }])
    expect(l.tradition).toBeNull()
  })

  it('an authored design survives the round trip', () => {
    const d = design({ nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 2 }] })
    const [l] = hydrateLegions(JSON.parse(JSON.stringify([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [], tradition: d,
    }])))
    expect(l.tradition?.nodes).toEqual(d.nodes)
    expect(l.tradition?.constraints).toEqual(d.constraints)
  })

  it('a piece the game no longer has is dropped, and its children with it', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      tradition: { ...design(), nodes: [
        { id: 'n0', parent: null, prim: 'SORCERY', steps: 1 },
        { id: 'n1', parent: 'n0', prim: 'SPOILS', steps: 1 },
      ] },
    }])
    // n0 is unknown so it never enters; n1's parent is therefore not present and it hangs
    // off the root rather than pointing at nothing.
    expect(l.tradition?.nodes.map((n) => n.prim)).toEqual(['SPOILS'])
    expect(l.tradition?.nodes[0].parent).toBeNull()
  })

  it('a design that no longer validates is KEPT and marked, never silently dropped', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      // No monotone ban: valid to nobody, but it is the player's authorship.
      tradition: { ...design(), constraints: [{ kind: 'SHARE', cls: 'ARCHER', minPct: 50 }] },
    }])
    expect(l.tradition).not.toBeNull()
    expect(l.tradition?.invalid).toBe(true)
    expect(channelsOf(l.tradition!)).toEqual(NO_CHANNELS)
  })

  it('steps are clamped to what the piece allows', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      tradition: { ...design(), nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 999 }] },
    }])
    expect(l.tradition?.nodes[0].steps).toBe(primById('SPOILS')!.maxSteps)
  })

  it('authored text is sanitised on LOAD, not only on entry', () => {
    const [l] = hydrateLegions([{
      id: 'L1', name: 'X', foundedDay: 1, unitIds: [], honours: [],
      tradition: { ...design(), name: '⚠ The Warned ' },
    }])
    expect(l.tradition?.name).toBe('The Warned')
  })
})

describe('authored text', () => {
  it('strips the glyphs the log filter tests for, and keeps words', () => {
    expect(sanitizeAuthoredText('⚠️ The Victors', 'x', 40)).toBe('The Victors')
  })
  it('falls back rather than leaving an empty title', () => {
    expect(sanitizeAuthoredText('   ', 'The First Host', 40)).toBe('The First Host')
  })
  it('cuts by code point, so a long name does not end in a broken glyph', () => {
    expect([...sanitizeAuthoredText('\u{1F600}'.repeat(60), 'x', 40)].length).toBe(40)
  })
})

describe('points', () => {
  it('spent points count what the tree actually holds', () => {
    const d = design({ nodes: [{ id: 'n0', parent: null, prim: 'SPOILS', steps: 2 }] })
    expect(spentPoints(d)).toBe(primById('SPOILS')!.points * 2)
  })
})
