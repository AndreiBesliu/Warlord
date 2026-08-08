// src/logic/logKind.ts
// The activity log is one flat stream of strings, newest first, with no way to ask
// "what happened to my economy?" without reading every line about training and battles.
// Categories are INFERRED rather than recorded, because `addLog` is called from two dozen
// places and the strings are all written by us — so the markers are stable and testable.
// If a line ever gains a real category field, this becomes the fallback, not the source.

export type LogKind = 'day' | 'economy' | 'military' | 'campaign' | 'research' | 'alert'

export const LOG_KINDS: { kind: LogKind; label: string; icon: string }[] = [
  { kind: 'day', label: 'Days', icon: '📅' },
  { kind: 'economy', label: 'Economy', icon: '⚒' },
  { kind: 'military', label: 'Army', icon: '🛡' },
  { kind: 'campaign', label: 'Battles', icon: '⚔' },
  { kind: 'research', label: 'Research', icon: '🔬' },
  { kind: 'alert', label: 'Warnings', icon: '⚠' },
]

// Order matters: the first match wins, so the most specific markers come first.
export function logKind(line: string): LogKind {
  const s = line || ''

  if (s.includes('⚠') || /can'?t pay|cannot pay|not enough|starv|nu poți/i.test(s)) return 'alert'
  if (s.includes('🔬') || /research/i.test(s)) return 'research'
  if (/battle|victor|defeat|casualt|loot|enemy|retreat|forfeit/i.test(s)) return 'campaign'
  if (/train|recruit|promot|barracks|batch|conver|unit|soldier|morale/i.test(s)) return 'military'
  if (s.includes('→') || /smelt|mint|idle|nature|stable|foals|upkeep|sold|bought|built/i.test(s)) return 'economy'
  if (/^\s*\S+\s*[—-]\s*Day \d+|Day \d+ —|⏳/.test(s)) return 'day'

  return 'day'
}

// The timestamp prefix ("8/1/2026, 9:31:25 PM — ") is noise on every single line; the
// day number and the content are what the player is scanning for.
export function stripTimestamp(line: string): string {
  const i = line.indexOf('—')
  if (i === -1) return line
  const head = line.slice(0, i)
  return /\d/.test(head) && /[:/]/.test(head) ? line.slice(i + 1).trim() : line
}
