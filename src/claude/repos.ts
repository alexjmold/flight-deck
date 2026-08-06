import { execFile } from 'node:child_process'
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

// A row knows its repo as owner/name; to open anything there we need the checkout on disk.
// Claude Code already records every directory you have worked in, so the map comes from its
// own history rather than from configuration.
//
// The directory names under projects/ are slugified paths and cannot be reversed: they are
// lossy (every separator becomes a dash) and go stale when a directory is renamed. The cwd
// recorded inside the transcript is the only trustworthy path, and the git remote is the
// only trustworthy way back to owner/name — repo directories are routinely named something
// else entirely.

// Transcripts reach several megabytes, so never read one whole. Any record carries the same
// cwd, and the tail is both cheap to reach and the most likely to be current.
const TAIL = 128 * 1024

const CWD_FIELD = /"cwd":"((?:[^"\\]|\\.)*)"/

export function repoSlug(remote: string): string | undefined {
  const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(remote.trim())

  return match?.[1] && match[2] ? `${match[1]}/${match[2]}` : undefined
}

async function cwdOf(file: string): Promise<string | undefined> {
  const handle = await open(file, 'r')

  try {
    const { size } = await handle.stat()
    const length = Math.min(size, TAIL)
    const buffer = Buffer.alloc(length)

    await handle.read(buffer, 0, length, size - length)

    const match = CWD_FIELD.exec(buffer.toString('utf8'))

    // The captured text is still JSON-escaped; a path can contain a quote or a backslash.
    return match?.[1] === undefined ? undefined : (JSON.parse(`"${match[1]}"`) as string)
  } catch {
    return undefined
  } finally {
    await handle.close()
  }
}

type Transcript = { file: string; modified: number }

async function newestTranscript(dir: string): Promise<Transcript | undefined> {
  let newest: Transcript | undefined

  let names: string[]

  try {
    names = await readdir(dir)
  } catch {
    return undefined
  }

  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue

    const file = join(dir, name)

    try {
      const { mtimeMs } = await stat(file)

      if (!newest || mtimeMs > newest.modified) newest = { file, modified: mtimeMs }
    } catch {
      // Gone between listing and stat. Nothing to do.
    }
  }

  return newest
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function remoteOf(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await run('git', ['-C', cwd, 'remote', 'get-url', 'origin'])

    return stdout.trim() || undefined
  } catch {
    // Not a repo, or no origin. Either way there is nothing to match a PR against.
    return undefined
  }
}

// A directory only earns a place in the map if it still exists and still resolves to a
// GitHub remote. Guessing at either would send Claude somewhere you did not ask for.
async function entryFor(cwd: string): Promise<[string, string] | undefined> {
  if (!(await isDirectory(cwd))) return undefined

  const remote = await remoteOf(cwd)
  const slug = remote ? repoSlug(remote) : undefined

  return slug ? [slug, cwd] : undefined
}

async function fromHistory(root: string): Promise<Array<{ cwd: string; modified: number }>> {
  let names: string[]

  try {
    names = await readdir(root)
  } catch {
    // No Claude Code history here. The panel simply cannot launch anything.
    return []
  }

  const found = await Promise.all(
    names.map(async (name) => {
      const transcript = await newestTranscript(join(root, name))

      if (!transcript) return undefined

      const cwd = await cwdOf(transcript.file)

      return cwd ? { cwd, modified: transcript.modified } : undefined
    }),
  )

  return found.filter((entry): entry is { cwd: string; modified: number } => entry !== undefined)
}

async function fromRoot(root: string): Promise<Array<{ cwd: string; modified: number }>> {
  try {
    const names = await readdir(root)

    // Anything found this way ranks below the history, so it never displaces a directory
    // you have actually worked in.
    return names.map((name) => ({ cwd: join(root, name), modified: -1 }))
  } catch {
    return []
  }
}

async function build(env: NodeJS.ProcessEnv): Promise<Map<string, string>> {
  const configured = env.FLIGHT_DECK_REPO_ROOT?.trim()

  const candidates = [
    ...(await fromHistory(join(homedir(), '.claude', 'projects'))),
    ...(configured ? await fromRoot(configured) : []),
  ].sort((a, b) => b.modified - a.modified)

  const map = new Map<string, string>()
  const seen = new Set<string>()

  for (const candidate of candidates) {
    if (seen.has(candidate.cwd)) continue

    seen.add(candidate.cwd)

    const entry = await entryFor(candidate.cwd)

    // Sorted newest first, so the first checkout to claim a slug is the one you touched
    // most recently — the right guess when a repo is cloned more than once.
    if (entry && !map.has(entry[0])) map.set(entry[0], entry[1])
  }

  return map
}

let cached: Promise<Map<string, string>> | undefined

// Where your checkouts are barely changes, and building the map costs a git subprocess per
// project, so it is resolved once and kept for the life of the panel.
export function knownRepos(env: NodeJS.ProcessEnv = process.env): Promise<Map<string, string>> {
  cached ??= build(env).catch(() => new Map<string, string>())

  return cached
}
