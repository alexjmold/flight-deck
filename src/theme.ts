import type { Tone } from './item.js'

export const colors = {
  success: 'green',
  failure: 'red',
  pending: 'yellow',
  muted: 'gray',
  accent: 'cyan',
  number: 'magenta',
} as const

export const glyphs = {
  success: '✓',
  failure: '✗',
  pending: '◐',
  none: '·',
  todo: '○',
  conflict: '⚠',
  cursor: '❯',
  refresh: '⟳',
  rule: '─',
} as const

export const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// Sources describe items in tones; only this file decides what a tone looks like.
export const toneColor: Record<Tone, string> = {
  ok: colors.success,
  danger: colors.failure,
  warn: colors.pending,
  muted: colors.muted,
}
