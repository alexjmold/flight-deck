import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterStale } from './feed'
import type { Item, Section } from './item'

const NOW = Date.UTC(2026, 7, 6)
const DAY = 86_400_000
const WEEK = 7 * DAY

function item(id: string, agoDays: number | null): Item {
  return {
    id,
    source: 'github',
    ref: `#${id}`,
    title: id,
    url: '',
    subject: '',
    status: { glyph: '✓', tone: 'ok' },
    badges: [],
    updatedAt: agoDays === null ? '' : new Date(NOW - agoDays * DAY).toISOString(),
  }
}

function sections(...items: Item[]): Section[] {
  return [{ key: 'yours', source: 'github', label: 'YOURS', items }]
}

const refs = (result: Section[]) => result.flatMap((section) => section.items.map((entry) => entry.id))

test('work untouched for longer than the window is hidden', () => {
  const result = filterStale(sections(item('fresh', 3), item('old', 40)), 4 * WEEK, NOW)

  assert.deepEqual(refs(result.sections), ['fresh'])
  assert.equal(result.hidden, 1)
})

test('the boundary keeps the item', () => {
  const result = filterStale(sections(item('exactly', 28)), 4 * WEEK, NOW)

  assert.deepEqual(refs(result.sections), ['exactly'])
  assert.equal(result.hidden, 0)
})

test('off hides nothing', () => {
  const all = sections(item('ancient', 900), item('fresh', 1))
  const result = filterStale(all, null, NOW)

  assert.equal(result.sections, all)
  assert.equal(result.hidden, 0)
})

test('an item with no usable timestamp cannot be judged, so it stays', () => {
  const unparseable = { ...item('nonsense', 0), updatedAt: 'last thursday' }
  const result = filterStale(sections(item('undated', null), unparseable), WEEK, NOW)

  assert.equal(result.hidden, 0)
  assert.equal(result.sections[0]!.items.length, 2)
})

test('sections are kept even when everything in them goes', () => {
  const result = filterStale(sections(item('old', 40)), WEEK, NOW)

  assert.equal(result.sections.length, 1)
  assert.equal(result.sections[0]!.items.length, 0)
  assert.equal(result.hidden, 1)
})
