#!/usr/bin/env node
import { render, type Instance } from 'ink'

import { App } from './app.js'
import type { Suspend } from './claude/launch.js'
import { runConfig } from './commands/config.js'
import { runLinear } from './commands/linear.js'
import { CLEAR_SCREEN, ENTER_ALT_SCREEN, LEAVE_ALT_SCREEN } from './screen.js'

// A .env in the working directory is a convenience, not a requirement — real env vars
// still win, and having no file at all is the normal case.
try {
  process.loadEnvFile()
} catch {
  // No .env here. Nothing to do.
}

const [command, ...args] = process.argv.slice(2)

if (command === 'linear') {
  process.exit(await runLinear(args))
} else if (command === 'config') {
  process.exit(runConfig(args))
} else if (process.argv.includes('--once')) {
  // A single frame, for scripting or a quick look: render, wait for the first fetch, unmount.
  let unmount = () => {}
  let done = false

  const ready = () => {
    if (done) return

    done = true
    setImmediate(() => unmount())
  }

  unmount = render(<App interactive={false} onReady={ready} />).unmount
} else {
  // The panel lives on the alternate screen, so quitting restores the terminal untouched.
  const leave = () => process.stdout.write(LEAVE_ALT_SCREEN)

  // Entering the alternate screen leaves the cursor at the shell prompt's row, so home it
  // first — otherwise the panel draws partway down the screen.
  process.stdout.write(ENTER_ALT_SCREEN + CLEAR_SCREEN)
  process.on('exit', leave)

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      leave()
      process.exit(0)
    })
  }

  let instance: Instance

  function start(): void {
    instance = render(<App interactive={Boolean(process.stdin.isTTY)} suspend={suspend} />)
  }

  // Handing the terminal to Claude Code when the emulator can't give us a window of its own.
  // Ink has to be unmounted rather than merely hidden, so that it stops reading stdin and
  // gives raw mode back; the panel is a fresh render on the way out, losing only which row
  // was selected.
  const suspend: Suspend = (run) => {
    void (async () => {
      instance.unmount()
      await instance.waitUntilExit()

      process.stdout.write(LEAVE_ALT_SCREEN)

      try {
        await run()
      } finally {
        process.stdout.write(ENTER_ALT_SCREEN + CLEAR_SCREEN)
        start()
      }
    })()
  }

  start()
}
