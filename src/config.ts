import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Where the Linear key lives once it isn't coming from the environment: the installed binary
// runs from wherever you happen to be standing, so a .env in the working directory won't do.
//
// Plain text with the permissions locked down, which is what `gh` does with the token this
// panel already borrows. Anything stronger means a keychain per platform.

export type Config = {
  linearApiKey?: string
  // Canonical duration, or "off". settings.ts owns what these mean.
  stale?: string
  refreshSeconds?: number
}

const DIR_MODE = 0o700
const FILE_MODE = 0o600

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config')

  return join(base, 'flight-deck', 'config.json')
}

// `~/.config/flight-deck/config.json` reads better than the absolute path, and is the
// same thing anyone would type back.
export function prettyPath(path: string): string {
  const home = homedir()

  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

// Absent, unreadable and empty all mean the same thing to a caller: nothing configured.
// Malformed is different — that file has something in it, and silently overwriting it
// would be the wrong way to find out.
function readRaw(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const path = configPath(env)
  let text: string

  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return {}
  }

  if (!text.trim()) return {}

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ConfigError(`${path} is not valid JSON`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ConfigError(`${path} is not a JSON object`)
  }

  return parsed as Record<string, unknown>
}

export class ConfigError extends Error {}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  let raw: Record<string, unknown>

  try {
    raw = readRaw(env)
  } catch {
    // A broken config must not take the panel down with it; the `linear` command reports
    // the real reason, and every read here has a working fallback.
    return {}
  }

  const key = typeof raw.linearApiKey === 'string' ? raw.linearApiKey.trim() : ''

  return {
    ...(key ? { linearApiKey: key } : {}),
    ...(typeof raw.stale === 'string' ? { stale: raw.stale } : {}),
    ...(typeof raw.refreshSeconds === 'number' ? { refreshSeconds: raw.refreshSeconds } : {}),
  }
}

// Merges rather than replaces, so a hand-added setting this version knows nothing about
// survives being written by it. `undefined` removes a key.
export function updateConfig(patch: Config, env: NodeJS.ProcessEnv = process.env): string {
  const path = configPath(env)
  const raw = readRaw(env)

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete raw[key]
    else raw[key] = value
  }

  mkdirSync(dirname(path), { recursive: true, mode: DIR_MODE })
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, { mode: FILE_MODE })

  // The mode above only applies to a file being created — an existing one keeps whatever
  // permissions it already had, which may well be world-readable.
  chmodSync(path, FILE_MODE)

  return path
}
