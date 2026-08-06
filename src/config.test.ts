import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { ConfigError, configPath, readConfig, updateConfig } from './config'

function scratch(): NodeJS.ProcessEnv {
  const env = { XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'flight-deck-')) }

  mkdirSync(dirname(configPath(env)), { recursive: true })

  return env
}

test('no config is not an error', () => {
  assert.deepEqual(readConfig(scratch()), {})
})

test('a written key reads back', () => {
  const env = scratch()

  updateConfig({ linearApiKey: 'lin_api_abc' }, env)

  assert.equal(readConfig(env).linearApiKey, 'lin_api_abc')
})

test('the file is not readable by anyone else', () => {
  const env = scratch()
  const path = updateConfig({ linearApiKey: 'lin_api_abc' }, env)

  assert.equal(statSync(path).mode & 0o777, 0o600)
})

test('permissions are tightened on a file that already existed', () => {
  const env = scratch()
  const path = configPath(env)

  writeFileSync(path, '{}', { mode: 0o644 })
  updateConfig({ linearApiKey: 'lin_api_abc' }, env)

  assert.equal(statSync(path).mode & 0o777, 0o600)
})

test('settings this version knows nothing about survive a write', () => {
  const env = scratch()

  writeFileSync(configPath(env), JSON.stringify({ future: 'setting' }))
  updateConfig({ linearApiKey: 'lin_api_abc' }, env)

  const raw = JSON.parse(readFileSync(configPath(env), 'utf8')) as Record<string, unknown>

  assert.equal(raw.future, 'setting')
  assert.equal(raw.linearApiKey, 'lin_api_abc')
})

test('a key is dropped rather than written as undefined', () => {
  const env = scratch()

  updateConfig({ linearApiKey: 'lin_api_abc' }, env)
  updateConfig({ linearApiKey: undefined }, env)

  assert.deepEqual(readConfig(env), {})
  assert.equal(readFileSync(configPath(env), 'utf8').includes('linearApiKey'), false)
})

test('an empty key counts as no key', () => {
  const env = scratch()

  writeFileSync(configPath(env), JSON.stringify({ linearApiKey: '  ' }))

  assert.deepEqual(readConfig(env), {})
})

test('a broken config does not take the panel down, but is not overwritten either', () => {
  const env = scratch()

  writeFileSync(configPath(env), 'not json')

  assert.deepEqual(readConfig(env), {})
  assert.throws(() => updateConfig({ linearApiKey: 'lin_api_abc' }, env), ConfigError)
  assert.equal(readFileSync(configPath(env), 'utf8'), 'not json')
})
