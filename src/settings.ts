import { readConfig, updateConfig } from './config.js'

export class SettingsError extends Error {}

export type Settings = {
  // How long since a PR or issue was last touched before it drops out of the panel.
  // null is no filter at all.
  stale: string
  staleMs: number | null
  refreshSeconds: number
}

export const DEFAULT_STALE = '4w'
export const DEFAULT_REFRESH = 30

// Below this, polling starts to look like something worth rate limiting.
export const BUSY_REFRESH = 10

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const UNITS: Record<string, number> = { h: HOUR, d: DAY, w: WEEK }

const OFF = new Set(['off', 'none', 'never', '0'])

export function parseStale(value: string): number | null {
  const text = value.trim().toLowerCase()

  if (!text) throw new SettingsError('Give a duration like 4w, 10d or 48h, or off.')
  if (OFF.has(text)) return null

  const match = /^(\d+)\s*(h|d|w)$/.exec(text)
  const size = match ? Number(match[1]) : 0

  if (!match || size < 1) throw new SettingsError(`"${value}" is not a duration. Try 4w, 10d, 48h or off.`)

  return size * UNITS[match[2]!]!
}

export function formatStale(ms: number | null): string {
  if (ms === null) return 'off'
  if (ms % WEEK === 0) return `${ms / WEEK}w`
  if (ms % DAY === 0) return `${ms / DAY}d`

  return `${Math.round(ms / HOUR)}h`
}

export function formatRefresh(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`
}

export function parseRefresh(value: string | number): number {
  const text = String(value).trim().replace(/s$/, '')
  const seconds = Number(text)

  if (!text || !Number.isInteger(seconds) || seconds < 1) {
    throw new SettingsError(`"${value}" is not a whole number of seconds.`)
  }

  return seconds
}

// A hand-edited setting that doesn't parse falls back to the default rather than taking
// the panel down; `flightdeck config` is where a wrong value gets reported.
function safe<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}

export function readSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const config = readConfig(env)

  const stale = safe(() => parseStale(config.stale ?? DEFAULT_STALE), parseStale(DEFAULT_STALE))
  const refreshSeconds = safe(() => parseRefresh(config.refreshSeconds ?? DEFAULT_REFRESH), DEFAULT_REFRESH)

  return { stale: formatStale(stale), staleMs: stale, refreshSeconds }
}

export function setStale(value: string, env: NodeJS.ProcessEnv = process.env): string {
  const canonical = formatStale(parseStale(value))

  updateConfig({ stale: canonical }, env)

  return canonical
}

export function setRefresh(value: string | number, env: NodeJS.ProcessEnv = process.env): number {
  const seconds = parseRefresh(value)

  updateConfig({ refreshSeconds: seconds }, env)

  return seconds
}
