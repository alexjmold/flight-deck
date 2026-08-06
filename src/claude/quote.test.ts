import { execFile } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { promisify } from 'node:util'

import { appleScriptQuote, shellQuote } from './quote'

const run = promisify(execFile)

// PR titles carry every one of these in the wild, and each one is a way out of a quoted
// string. Rather than assert on the escaping, hand it to a real shell and see what lands.
const NASTY = [
  "it's fine",
  'rm -rf $HOME',
  '`whoami`',
  '$(whoami)',
  'a"b',
  "close ' then $(echo pwned)",
  'back\\slash',
  'semi; echo no',
  'pipe | echo no',
  'new\nline',
  'ampersand && echo no',
]

for (const value of NASTY) {
  test(`shellQuote survives a shell: ${JSON.stringify(value)}`, async () => {
    const { stdout } = await run('/bin/sh', ['-c', `printf %s ${shellQuote(value)}`])

    assert.equal(stdout, value)
  })
}

test('appleScriptQuote escapes quotes and backslashes', () => {
  assert.equal(appleScriptQuote('a"b'), '"a\\"b"')
  assert.equal(appleScriptQuote('back\\slash'), '"back\\\\slash"')

  // A backslash already followed by a quote must not end up escaping the quote we add.
  assert.equal(appleScriptQuote('trailing\\'), '"trailing\\\\"')
})
