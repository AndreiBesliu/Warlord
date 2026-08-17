// src/logic/traditionCode.ts
// A tradition as a short string you can hand to somebody.
//
// The property that makes this safe is not the encoding — it is what the encoding CANNOT
// carry. A code holds piece ids, step counts, parent links, the demands, and two strings.
// It holds no prices, no thresholds, no ceilings, because a design never had any: those are
// recomputed from the importer's own palette when the code is read.
//
// So an inflated tradition is not something to detect and reject. It is not REPRESENTABLE.
// Someone editing a code by hand can produce a tradition that is illegal (and gets refused
// with a reason) or a different legal one — never a stronger one than the palette allows.
// That is the same discipline `sanitizeDeploy` uses on the PvP wire: rebuild from a
// whitelist rather than trust what arrived.
//
// What a code does NOT carry, deliberately: the legion's record, its level, and everything
// it has actually done. You can be given a tradition. You cannot be given a history — the
// tree still has to be grown, by that legion, from its own deeds.

import type { TraditionDesign } from './tradition'
import { sanitizeAuthoredText, validateDesign } from './tradition'
import {
  DESIGN_MAX_CONSTRAINTS, DESIGN_MAX_NODES, TRADITION_CREED_MAX, TRADITION_NAME_MAX, primById,
  type Constraint,
} from './traditionPalette'

const PREFIX = 'WLT1:'

/**
 * Four characters over the whole payload. Not security — a code is meant to be shareable,
 * and there is nothing in it worth forging. It catches the ordinary failure: a code that
 * lost its tail to a chat client's line wrap, which would otherwise decode into a smaller,
 * legal-looking tradition and be accepted in silence.
 */
function checksum(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36).slice(-4).padStart(4, '0')
}

/** base64url, and hand-rolled because `btoa` is byte-oriented and a creed is not ASCII. */
function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(s: string): string | null {
  try {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Short keys because the payload is meant to be pasted into a message, not a file. */
interface Wire {
  n: string
  c: string
  k: unknown[]
  d: [string, number, number][] // [prim, steps, parentIndex] — -1 = the root
}

export function encodeDesign(design: TraditionDesign): string {
  const index = new Map(design.nodes.map((n, i) => [n.id, i]))
  const wire: Wire = {
    n: design.name,
    c: design.creed,
    k: design.constraints,
    // Parents as POSITIONS, not ids: ids are an internal detail, and a position cannot
    // point at something that is not in the code.
    d: design.nodes.map((n) => [n.prim, n.steps, n.parent === null ? -1 : (index.get(n.parent) ?? -1)]),
  }
  const body = toB64Url(JSON.stringify(wire))
  return PREFIX + body + '.' + checksum(body)
}

export type DecodeResult =
  | { ok: true; design: TraditionDesign }
  | { ok: false; error: string }

/**
 * Read a code back. Rebuilds, never passes through — every field is re-derived against this
 * build's palette, and the result must pass the same validator an authored design does.
 */
export function decodeDesign(raw: string, sworeDay = 0): DecodeResult {
  const text = (raw ?? '').trim()
  if (!text.startsWith(PREFIX)) return { ok: false, error: 'That is not a tradition code' }
  const rest = text.slice(PREFIX.length)
  const dot = rest.lastIndexOf('.')
  if (dot < 0) return { ok: false, error: 'The code is missing its check — it may have been cut short' }
  const body = rest.slice(0, dot)
  if (checksum(body) !== rest.slice(dot + 1)) {
    return { ok: false, error: 'The code did not survive being copied — ask for it again' }
  }

  const json = fromB64Url(body)
  if (json === null) return { ok: false, error: 'The code is damaged' }
  let wire: Partial<Wire>
  try { wire = JSON.parse(json) } catch { return { ok: false, error: 'The code is damaged' } }

  const nodes: TraditionDesign['nodes'] = []
  const rows = Array.isArray(wire.d) ? wire.d.slice(0, DESIGN_MAX_NODES) : []
  rows.forEach((row, i) => {
    if (!Array.isArray(row)) return
    const prim = primById(String(row[0]))
    if (!prim) return
    const steps = Math.min(prim.maxSteps, Math.max(1, Math.round(Number(row[1]) || 1)))
    // A parent must be EARLIER in the list, which is what keeps cycles unrepresentable
    // rather than something to hunt for.
    const at = Math.round(Number(row[2]))
    const parent = at >= 0 && at < i && nodes[at] ? nodes[at].id : null
    nodes.push({ id: `n${nodes.length}`, parent, prim: prim.id, steps })
  })

  const constraints: Constraint[] = []
  for (const raw2 of (Array.isArray(wire.k) ? wire.k : []).slice(0, DESIGN_MAX_CONSTRAINTS)) {
    if (!raw2 || typeof raw2 !== 'object') continue
    const c = raw2 as Record<string, unknown>
    const cls = String(c.cls) as Constraint extends { cls: infer T } ? T : never
    switch (String(c.kind)) {
      case 'DENY': constraints.push({ kind: 'DENY', cls }); break
      case 'MAX_COHORTS': constraints.push({ kind: 'MAX_COHORTS', n: Math.round(Number(c.n)) }); break
      case 'MIN_COHORTS': constraints.push({ kind: 'MIN_COHORTS', n: Math.round(Number(c.n)) }); break
      case 'SHARE': constraints.push({ kind: 'SHARE', cls, minPct: Math.round(Number(c.minPct)) }); break
    }
  }

  const design: TraditionDesign = {
    v: 1,
    name: sanitizeAuthoredText(String(wire.n ?? ''), '', TRADITION_NAME_MAX),
    creed: sanitizeAuthoredText(String(wire.c ?? ''), '', TRADITION_CREED_MAX),
    sworeDay,
    constraints,
    nodes,
  }
  const check = validateDesign(design)
  // Refused with the validator's OWN words: a code that arrives illegal fails for the same
  // stated reason it would have failed at authoring, rather than a vaguer import error.
  return check.ok ? { ok: true, design } : { ok: false, error: check.errors[0] }
}

/**
 * A code names a tradition; it does not hand over what a legion has done. The nodes come
 * across as the PROMISE of a tree, and the receiving legion still has to earn each one.
 */
export function asFreshOath(design: TraditionDesign, sworeDay: number): TraditionDesign {
  return { ...design, sworeDay, nodes: [] }
}
