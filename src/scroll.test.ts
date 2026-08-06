import assert from 'node:assert/strict'
import { test } from 'node:test'

import { scrollOffset } from './scroll'

// A header (2 lines) followed by four rows (3 lines each).
const LIST = [2, 3, 3, 3, 3]

test('everything fits, so nothing scrolls', () => {
  assert.equal(scrollOffset(LIST, 4, 14, 0), 0)
})

test('the selection is brought into view', () => {
  assert.equal(scrollOffset(LIST, 4, 6, 0), 3)
})

test('room above the selection is reclaimed', () => {
  assert.equal(scrollOffset(LIST, 1, 14, 3), 0)
})

test('but only as far as the budget allows', () => {
  assert.equal(scrollOffset(LIST, 4, 8, 4), 3)
})

test('a selection taller than the panel still shows its own row', () => {
  assert.equal(scrollOffset(LIST, 4, 1, 0), 4)
})
