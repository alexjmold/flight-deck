import assert from 'node:assert/strict'
import { test } from 'node:test'

import { newWindowFor } from './terminal.js'

const DIR = '/Users/alex/Projects/flight-deck'
const SCRIPT = "claude 'fix it'"

test('ghostty opens the app bundle with a login shell', () => {
  const spawn = newWindowFor(DIR, SCRIPT, { TERM_PROGRAM: 'ghostty', SHELL: '/bin/zsh' })

  assert.equal(spawn?.command, 'open')
  assert.deepEqual(spawn?.args, [
    '-na',
    'Ghostty.app',
    '--args',
    `--working-directory=${DIR}`,
    '-e',
    '/bin/zsh',
    '-lc',
    "claude 'fix it'; exec /bin/zsh",
  ])
})

test('the bundle id identifies the terminal when TERM_PROGRAM does not', () => {
  const spawn = newWindowFor(DIR, SCRIPT, { __CFBundleIdentifier: 'com.mitchellh.ghostty' })

  assert.equal(spawn?.args[1], 'Ghostty.app')
})

test('kitty is recognised by its own variables', () => {
  assert.equal(newWindowFor(DIR, SCRIPT, { KITTY_WINDOW_ID: '1' })?.command, 'kitty')
  assert.equal(newWindowFor(DIR, SCRIPT, { TERM: 'xterm-kitty' })?.command, 'kitty')
})

test('tmux wins over the terminal it is running in', () => {
  const spawn = newWindowFor(DIR, SCRIPT, { TMUX: '/tmp/tmux-501/default,123,0', TERM_PROGRAM: 'ghostty' })

  assert.equal(spawn?.command, 'tmux')
  assert.deepEqual(spawn?.args.slice(0, 3), ['new-window', '-c', DIR])
})

test('the override wins over everything, with both values quoted', () => {
  const spawn = newWindowFor(DIR, SCRIPT, {
    FLIGHT_DECK_TERMINAL: 'myterm --cd {dir} -- sh -c {cmd}',
    TMUX: '/tmp/tmux',
    TERM_PROGRAM: 'ghostty',
    SHELL: '/bin/zsh',
  })

  assert.equal(spawn?.command, '/bin/sh')
  assert.equal(spawn?.args[1], `myterm --cd '${DIR}' -- sh -c 'claude '\\''fix it'\\''; exec /bin/zsh'`)
})

test('terminals that cannot run a command hand back to the caller', () => {
  assert.equal(newWindowFor(DIR, SCRIPT, { TERM_PROGRAM: 'WarpTerminal' }), null)
  assert.equal(newWindowFor(DIR, SCRIPT, { TERM_PROGRAM: 'vscode' }), null)
  assert.equal(newWindowFor(DIR, SCRIPT, {}), null)
})

test('a directory with a space survives the AppleScript terminals', () => {
  const dir = '/Users/alex/My Projects/thing'

  for (const term of ['Apple_Terminal', 'iTerm.app']) {
    const spawn = newWindowFor(dir, SCRIPT, { TERM_PROGRAM: term, SHELL: '/bin/zsh' })

    assert.equal(spawn?.command, 'osascript')
    assert.match(spawn?.args[1] ?? '', /'\/Users\/alex\/My Projects\/thing'/)
  }
})
