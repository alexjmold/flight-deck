import assert from 'node:assert/strict'
import { test } from 'node:test'

import { scriptFor } from './launch'

const WORK = {
  repo: 'sanity-io/workflows',
  prompt: 'CI is failing on https://github.com/sanity-io/workflows/pull/388. Work out why and fix it.',
  fromPr: 'https://github.com/sanity-io/workflows/pull/388',
}

test('the seeded prompt is the default', () => {
  assert.equal(
    scriptFor(WORK, {}),
    "claude 'CI is failing on https://github.com/sanity-io/workflows/pull/388. Work out why and fix it.'",
  )
})

test('--from-pr is opt-in, and never chained onto the prompt', () => {
  const script = scriptFor(WORK, { FLIGHT_DECK_FROM_PR: '1' })

  assert.equal(script, "claude --from-pr 'https://github.com/sanity-io/workflows/pull/388'")

  // Chaining would strand you in the resume picker rather than falling through to the prompt.
  assert.doesNotMatch(script, /\|\||&&|;/)
})

test('an off switch that reads like one', () => {
  for (const value of ['', '0', '   ']) {
    assert.match(scriptFor(WORK, { FLIGHT_DECK_FROM_PR: value }), /^claude '/)
  }
})

test('a row with no PR behind it always gets the prompt', () => {
  const work = { repo: 'a/b', prompt: 'do the thing' }

  assert.equal(scriptFor(work, { FLIGHT_DECK_FROM_PR: '1' }), "claude 'do the thing'")
})

test("a title's quotes cannot escape the command", () => {
  const work = { repo: 'a/b', prompt: "fix 'it'; rm -rf $HOME" }

  assert.equal(scriptFor(work, {}), `claude 'fix '\\''it'\\''; rm -rf $HOME'`)
})
