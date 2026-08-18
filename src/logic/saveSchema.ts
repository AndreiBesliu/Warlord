// src/logic/saveSchema.ts
// The save's version stamp, and the rule that stops an OLDER build from eating a NEWER
// save.
//
// The hazard is specific to how this game ships and syncs, and it is not hypothetical:
//
//   `useGameState` composes the save from a FIXED LITERAL of top-level keys, and each
//   slice hydrates through a closed field list. A build that predates a field therefore
//   drops it on contact — silently, by construction, because "I don't know this key" and
//   "this key isn't there" look identical to a spread.
//
//   Warlord has NO client auto-update path. A tab left open runs its build indefinitely.
//
//   `warlordCloud` adopts strictly by `rev`, and every save BUMPS the rev before writing.
//
// Chain those and an old tab, ticking one day, writes a truncated blob, bumps the rev,
// pushes it, and the player's other device adopts the truncated version. Every field the
// old build never heard of is gone, with no error anywhere. Nothing here is recoverable
// afterwards, so the only useful place to stand is BEFORE the write.
//
// Two defences, deliberately different in kind:
//   1. A build that reads a save stamped NEWER than it understands refuses to persist at
//      all. Loud and total: the in-memory state is already missing whatever it could not
//      hydrate, so any write from it is lossy.
//   2. Unknown top-level keys are carried through the save round-trip instead of dropped.
//      Belt to the braces — it covers the case where someone adds a key and forgets to
//      bump, which is the likeliest way this gets re-broken.
//
// What this CANNOT do: protect against builds that shipped before it. Those have no check
// to run. The hazard closes for tabs from this build onward, and every day it goes
// unshipped is another build that will never learn to stand down.

/**
 * Bump this whenever the save gains a field an older build would not preserve — a new
 * top-level key, or a new field inside any slice's hydrate.
 *
 * 1 = everything up to and including legion traditions.
 * 2 = `Legion.practice` (the deed ledger) and `CampaignState.marchedLegions`.
 * 3 = `Legion.duty`.
 * 4 = `Legion.tradition` changed from a catalog id (a string) to an inline authored design.
 *     An older build would read the object as an unknown id and null it, so this one is not
 *     merely additive — it is exactly the case the guard exists for.
 * 5 = `Legion.standard` (where its eagle is, if somebody else has it).
 * 6 = `Legion.commander`.
 * 7 = `population` — the domain's souls and where their hands are posted. An older build
 *     drops the key, and the absent-key branch of `hydratePopulation` then re-seeds a town
 *     that has already spent souls on soldiers, so the save degrades to "everybody is at
 *     home" rather than to anything negative. Both halves live in ONE key precisely so an
 *     old build cannot keep the postings while losing the souls.
 * 8 = `population.work` — days each crew has worked, from which its LEVEL is derived. An
 *     older build would drop the counter and every crew would silently fall back to level 1
 *     while still being paid for at its old rate on this build.
 */
export const SAVE_SCHEMA = 8

/**
 * The top-level keys this build writes. Anything in a loaded save that is NOT here is
 * carried through untouched rather than dropped.
 *
 * Kept as data next to the guard rather than derived from the blob literal: deriving it
 * from the object being written would make every key "known" by definition, which is
 * exactly the bug.
 */
export const KNOWN_SAVE_KEYS: readonly string[] = [
  'schema',
  'day', 'lastTickAt', 'log',
  'wallet', 'inv', 'buildings', 'resources',
  'barracks', 'barracksLevel', 'recruits', 'batches',
  'units', 'campaign', 'research', 'legions', 'population',
]

export interface SaveInspection {
  /** The schema the loaded save was written with. A save from before stamping reads as 1. */
  schema: number
  /**
   * The save came from a build newer than this one. When true the caller must not persist:
   * whatever it could not hydrate is already gone from memory.
   */
  fromNewerBuild: boolean
  /** Top-level keys this build does not know, preserved verbatim for the next write. */
  carried: Record<string, unknown>
}

export function inspectSave(saved: unknown): SaveInspection {
  if (!saved || typeof saved !== 'object') {
    return { schema: SAVE_SCHEMA, fromNewerBuild: false, carried: {} }
  }
  const s = saved as Record<string, unknown>
  // An absent stamp is a save from before stamping existed, not a corrupt one — it is
  // schema 1 and perfectly loadable. A non-numeric stamp is treated the same way rather
  // than as "newer": refusing to write on garbage would brick a save over a typo.
  const raw = s.schema
  const schema = typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1

  const carried: Record<string, unknown> = {}
  for (const k of Object.keys(s)) {
    if (!KNOWN_SAVE_KEYS.includes(k)) carried[k] = s[k]
  }
  return { schema, fromNewerBuild: schema > SAVE_SCHEMA, carried }
}

/**
 * Stamp the blob and re-attach anything this build did not understand.
 *
 * `carried` is applied FIRST so a known key can never be shadowed by a stale copy of
 * itself — if a future build moves a key out of `KNOWN_SAVE_KEYS`, the live value still
 * wins over the carried one.
 */
export function stampSave<T extends Record<string, unknown>>(
  blob: T, carried: Record<string, unknown> = {},
): T & { schema: number } {
  return { ...carried, ...blob, schema: SAVE_SCHEMA }
}

/** What the player is told. One sentence, and it names the only thing that fixes it. */
export const STALE_BUILD_MESSAGE =
  'This kingdom was last saved by a newer version of the game. Nothing will be saved from '
  + 'this tab until you reload the page — that keeps the newer save from being overwritten '
  + 'with an older one.'
