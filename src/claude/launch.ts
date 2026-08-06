import { spawn } from 'node:child_process'

import type { Work } from '../item'
import { shellQuote } from './quote'
import { knownRepos } from './repos'
import { newWindowFor } from './terminal'

// Runs the panel's own process in place of the panel, on the terminal it was using. The
// caller unmounts the UI first and puts it back afterwards.
export type Suspend = (run: () => Promise<void>) => void

export async function directoryFor(work: Work): Promise<string | undefined> {
  return (await knownRepos()).get(work.repo)
}

// `claude --from-pr` resumes a session already attached to the PR, which would beat anything
// we can compose. It cannot be the default, though: with no such session it does not fail, it
// opens an empty resume picker and waits — so it can neither be chained onto the seeded
// prompt nor recovered from without you noticing. Opt in when you know the session is there.
function resumes(env: NodeJS.ProcessEnv): boolean {
  const value = env.FLIGHT_DECK_FROM_PR?.trim() ?? ''

  return value !== '' && value !== '0'
}

export function scriptFor(work: Work, env: NodeJS.ProcessEnv = process.env): string {
  return work.fromPr && resumes(env)
    ? `claude --from-pr ${shellQuote(work.fromPr)}`
    : `claude ${shellQuote(work.prompt)}`
}

function inherit(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })

    child.on('error', () => resolve())
    child.on('close', () => resolve())
  })
}

// Opens the selected row's work in Claude Code: a new window where the terminal can give us
// one, otherwise in place of the panel. Does nothing at all when the repo isn't checked out
// anywhere we know about — the key is not advertised in that case either.
export async function launch(work: Work, suspend?: Suspend, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const dir = await directoryFor(work)

  if (!dir) return

  const script = scriptFor(work, env)
  const window = newWindowFor(dir, script, env)

  if (window) {
    // Detached so a terminal that outlives the panel never holds its stdio open.
    const child = spawn(window.command, window.args, { detached: true, stdio: 'ignore' })

    child.on('error', () => {})
    child.unref()

    return
  }

  // No login shell here: this one inherits the panel's own environment, and dropping into a
  // nested shell afterwards would strand you away from the panel you came from.
  suspend?.(() => inherit(env.SHELL || '/bin/zsh', ['-lc', script], dir))
}
