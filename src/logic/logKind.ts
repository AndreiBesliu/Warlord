// src/logic/logKind.ts
// The activity log is one flat stream of strings, newest first, with no way to ask
// "what happened to my economy?" without reading every line about training and battles.
// Categories are INFERRED rather than recorded, because `addLog` is called from two dozen
// places and the strings are all written by us — so the markers are stable and testable.
// If a line ever gains a real category field, this becomes the fallback, not the source.
//
// ── Three things this got wrong, all measured ─────────────────────────────────────────
//
// 1. ORDER. The day rule sat below the economy rule, and every day line carries an arrow
//    ("DAY 1675 — Nature → +1 Wood"), so economy always won and the day rule was UNREACHABLE.
//    Which meant the chip labelled "Days" was not counting days at all.
// 2. THE FALLBACK PRETENDED TO BE A CATEGORY. Anything unmatched returned 'day', so the same
//    chip doubled as the bucket for everything nobody had classified — a rout, for one. A count
//    under a label that does not describe it is worse than no count.
// 3. SUBSTRING COLLISIONS. `/unit/` matched inside "opportunity" and "community", filing them
//    under Army. The word lists are PREFIXES on purpose (promot → promote/promotion), so the
//    fix is a boundary at the START only: `\b(?:unit|promot)`, never a full `\b…\b`.

export type LogKind = 'day' | 'economy' | 'military' | 'campaign' | 'research' | 'alert' | 'other'

export const LOG_KINDS: { kind: LogKind; label: string; icon: string }[] = [
  { kind: 'day', label: 'Days', icon: '📅' },
  { kind: 'economy', label: 'Economy', icon: '⚒' },
  { kind: 'military', label: 'Army', icon: '🛡' },
  { kind: 'campaign', label: 'Battles', icon: '⚔' },
  { kind: 'research', label: 'Research', icon: '🔬' },
  { kind: 'alert', label: 'Warnings', icon: '⚠' },
  // Named honestly. It is the measure of how well the rules above are doing, and a chip that
  // starts climbing is the signal that a new kind of line has appeared with nowhere to go.
  { kind: 'other', label: 'Other', icon: '·' },
]

/** Prefix match anchored at a word START, so "opportunity" is not a unit and "promot" still is. */
const starts = (...words: string[]) => new RegExp(`\\b(?:${words.join('|')})`, 'i')

const ALERT = /can'?t pay|cannot pay|not enough|starv|nu po[țt]i/i
// A day line is recognised STRUCTURALLY, by its prefix, not by the words inside it — those are
// whatever the day happened to produce.
const DAY = /(^|\s)day \d+\s*[—:-]|⏳/i
const RESEARCH = starts('research', 'unlocked', 'scriptorium', 'study', 'tech')
const CAMPAIGN = starts('battle', 'victor', 'defeat', 'casualt', 'loot', 'enemy', 'retreat', 'forfeit', 'rout', 'march', 'legion', 'cohort')
const MILITARY = starts('train', 'recruit', 'promot', 'barracks', 'batch', 'conver', 'unit', 'soldier', 'morale', 'levy', 'disband')
const ECONOMY = starts('smelt', 'mint', 'idle', 'nature', 'stable', 'foal', 'upkeep', 'sold', 'bought', 'built', 'harvest', 'crew', 'post', 'food', 'treasury', 'wallet')

export function logKind(line: string): LogKind {
  const s = line || ''

  // An alert stays an alert whatever else the sentence contains.
  if (s.includes('⚠') || ALERT.test(s)) return 'alert'
  // Before economy, because a day line is full of arrows and would otherwise never be seen.
  if (DAY.test(s)) return 'day'
  if (s.includes('🔬') || RESEARCH.test(s)) return 'research'
  if (CAMPAIGN.test(s)) return 'campaign'
  if (MILITARY.test(s)) return 'military'
  if (s.includes('→') || ECONOMY.test(s)) return 'economy'

  return 'other'
}

// The timestamp prefix ("8/1/2026, 9:31:25 PM — ") is noise on every single line; the
// day number and the content are what the player is scanning for.
export function stripTimestamp(line: string): string {
  const i = line.indexOf('—')
  if (i === -1) return line
  const head = line.slice(0, i)
  return /\d/.test(head) && /[:/]/.test(head) ? line.slice(i + 1).trim() : line
}
