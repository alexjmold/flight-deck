import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

import { reasonFor } from '../error.js'
import { truncate } from '../format.js'
import {
  BUSY_REFRESH,
  formatRefresh,
  parseStale,
  readSettings,
  setRefresh,
  setStale,
  type Settings,
} from '../settings.js'
import { colors, glyphs } from '../theme.js'
import { Gap } from './gap.js'

// The arrows step through these. Anything else — 10d, 45s — is still valid, set from
// `flightdeck config`, and shown as it is until an arrow moves off it.
const STALE_STEPS = ['1w', '2w', '4w', '8w', '12w', '26w', 'off']
const REFRESH_STEPS = [5, 10, 15, 30, 60, 120, 300]

const NAME_WIDTH = 10

// Notes sit under the name, not under the cursor gutter.
const NOTE_INDENT = 4

type Props = {
  width: number
  onDone: () => void
}

function nearest(steps: number[], current: number): number {
  return steps.reduce(
    (best, step, index) => (Math.abs(step - current) < Math.abs(steps[best]! - current) ? index : best),
    0,
  )
}

function nearestStale(current: number | null): number {
  if (current === null) return STALE_STEPS.length - 1

  const durations = STALE_STEPS.map((step) => parseStale(step) ?? Number.MAX_SAFE_INTEGER)

  return nearest(durations, current)
}

function step<T>(values: T[], index: number, direction: number): T {
  return values[Math.min(values.length - 1, Math.max(0, index + direction))]!
}

export function SettingsScreen({ width, onDone }: Props) {
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [field, setField] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function change(direction: number): void {
    // From what is on disk rather than from React state, so a held-down arrow whose
    // repeats arrive faster than renders still steps once per press.
    const current = readSettings()

    try {
      if (field === 0) setStale(step(STALE_STEPS, nearestStale(current.staleMs), direction))
      else setRefresh(step(REFRESH_STEPS, nearest(REFRESH_STEPS, current.refreshSeconds), direction))

      setSettings(readSettings())
      setError(null)
    } catch (failure) {
      setError(reasonFor(failure))
    }
  }

  useInput((input, key) => {
    if (key.ctrl || key.meta) return

    if (key.escape || key.return || input === 'q') {
      onDone()
      return
    }

    if (key.upArrow || input === 'k') setField(0)
    if (key.downArrow || input === 'j') setField(1)
    if (key.leftArrow || input === 'h') change(-1)
    if (key.rightArrow || input === 'l') change(1)
  })

  const busy = settings.refreshSeconds < BUSY_REFRESH

  return (
    <Box flexDirection="column" paddingRight={1}>
      <Box paddingLeft={2}>
        <Text bold>SETTINGS</Text>
      </Box>

      <Gap />

      <Field
        name="stale"
        value={settings.stale}
        note={settings.staleMs === null ? 'Everything is shown, however old.' : 'Hide work untouched for longer.'}
        isSelected={field === 0}
        width={width}
      />

      <Gap />

      <Field
        name="refresh"
        value={formatRefresh(settings.refreshSeconds)}
        note="How often the panel refetches."
        isSelected={field === 1}
        width={width}
      />

      {busy ? (
        <Box paddingLeft={NOTE_INDENT}>
          <Text color={colors.pending} dimColor>
            {truncate(`${glyphs.conflict} GitHub or Linear may rate limit you.`, width - NOTE_INDENT - 1)}
          </Text>
        </Box>
      ) : null}

      {error ? (
        <Box paddingLeft={NOTE_INDENT}>
          <Text color={colors.failure}>{truncate(error, width - NOTE_INDENT - 1)}</Text>
        </Box>
      ) : null}

      <Gap />
    </Box>
  )
}

type FieldProps = {
  name: string
  value: string
  note: string
  isSelected: boolean
  width: number
}

function Field({ name, value, note, isSelected, width }: FieldProps) {
  return (
    <Box flexDirection="column">
      <Text>
        {/* The cursor sits in the same gutter the panel's rows use. */}
        <Text color={colors.accent}>{isSelected ? `${glyphs.cursor} ` : '  '}</Text>
        <Text dimColor={!isSelected}>{name.padEnd(NAME_WIDTH)}</Text>
        <Text color={isSelected ? colors.accent : undefined} bold={isSelected} dimColor={!isSelected}>
          {value}
        </Text>
      </Text>

      <Box paddingLeft={NOTE_INDENT}>
        <Text dimColor>{truncate(note, width - NOTE_INDENT - 1)}</Text>
      </Box>
    </Box>
  )
}
