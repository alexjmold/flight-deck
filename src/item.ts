// Sources emit ready-to-render items, so the row component stays free of any one
// tool's domain logic. Tones are semantic — theme.ts owns the colours they map to.
export type Tone = 'ok' | 'danger' | 'warn' | 'muted'

export type Badge = { text: string; tone: Tone }

// `animate` marks the one state that is genuinely in motion — CI still running. It spins,
// which is what separates it from Linear's static ◐ for a started issue on the same row.
export type Status = { glyph: string; tone: Tone; animate?: boolean }

export type SourceKey = 'github' | 'linear'

// The same work as it exists in the other tool: a PR's Linear issue, or an issue's PR.
// Drives the g / l keys.
export type Link = { url: string; ref: string }

// An extra line under a row, for context that won't fit on the meta line.
export type Detail = { glyph: string; tone: Tone; text: string; badges: Badge[] }

// How to pick this row up in an agent: the repo it belongs to as owner/name, and a prompt
// shaped by what the row's state actually means. Only the source knows that a red glyph is
// failing CI rather than a rejected review, so only the source fills this in.
// `fromPr` lets Claude Code resume a session already attached to that PR.
export type Work = { repo: string; prompt: string; fromPr?: string }

export type Item = {
  id: string
  source: SourceKey
  ref: string
  title: string
  url: string
  subject: string
  status: Status
  badges: Badge[]
  updatedAt: string
  link?: Link
  detail?: Detail
  work?: Work
}

export type Section = { key: string; source: SourceKey; label: string; items: Item[] }

export function urlFor(item: Item, source: SourceKey): string | undefined {
  return item.source === source ? item.url : item.link?.url
}

// ISO timestamps sort correctly as plain strings, and an item with none sorts last.
export function byRecency(a: Item, b: Item): number {
  if (a.updatedAt === b.updatedAt) return 0

  return a.updatedAt > b.updatedAt ? -1 : 1
}
