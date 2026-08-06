import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { configPath } from './config.js'
import {
  DEFAULT_REFRESH,
  formatRefresh,
  formatStale,
  parseRefresh,
  parseStale,
  readSettings,
  setRefresh,
  setStale,
  SettingsError,
} from './settings.js'

const WEEK = 7 * 24 * 3_600_000

function scratch(): NodeJS.ProcessEnv {
  const env = { XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'flight-deck-')) }

  mkdirSync(dirname(configPath(env)), { recursive: true })

  return env
}

test('durations parse in weeks, days and hours', () => {
  assert.equal(parseStale('4w'), 4 * WEEK)
  assert.equal(parseStale('10d'), 10 * 24 * 3_600_000)
  assert.equal(parseStale('48h'), 48 * 3_600_000)
  assert.equal(parseStale(' 2W '), 2 * WEEK)
})

test('off means no filter at all', () => {
  for (const value of ['off', 'none', 'never', '0', 'OFF']) assert.equal(parseStale(value), null)
})

test('a duration without a unit is rejected rather than guessed at', () => {
  for (const value of ['4', 'soon', '', '-1w', '0w', '4m']) {
    assert.throws(() => parseStale(value), SettingsError, value)
  }
})

test('durations round-trip through their canonical form', () => {
  assert.equal(formatStale(parseStale('4w')), '4w')
  assert.equal(formatStale(parseStale('10d')), '10d')
  assert.equal(formatStale(parseStale('48h')), '2d')
  assert.equal(formatStale(parseStale('36h')), '36h')
  assert.equal(formatStale(null), 'off')
})

test('refresh takes whole seconds only', () => {
  assert.equal(parseRefresh('30'), 30)
  assert.equal(parseRefresh('30s'), 30)
  assert.equal(parseRefresh(5), 5)

  for (const value of ['0', '-5', '1.5', 'fast', '']) assert.throws(() => parseRefresh(value), SettingsError, value)
})

test('a minute or more reads as minutes', () => {
  assert.equal(formatRefresh(30), '30s')
  assert.equal(formatRefresh(60), '1m')
  assert.equal(formatRefresh(300), '5m')
  assert.equal(formatRefresh(90), '90s')
})

test('the defaults are four weeks and thirty seconds', () => {
  const settings = readSettings(scratch())

  assert.equal(settings.stale, '4w')
  assert.equal(settings.staleMs, 4 * WEEK)
  assert.equal(settings.refreshSeconds, 30)
})

test('settings survive a write and read back canonical', () => {
  const env = scratch()

  setStale('48h', env)
  setRefresh('45s', env)

  const settings = readSettings(env)

  assert.equal(settings.stale, '2d')
  assert.equal(settings.refreshSeconds, 45)
})

test('a hand-edited setting that makes no sense falls back to the default', () => {
  const env = scratch()

  writeFileSync(configPath(env), JSON.stringify({ stale: 'whenever', refreshSeconds: -3 }))

  const settings = readSettings(env)

  assert.equal(settings.stale, '4w')
  assert.equal(settings.refreshSeconds, DEFAULT_REFRESH)
})
