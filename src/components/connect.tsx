import { Box, Text, useInput } from 'ink'
import { useEffect, useRef, useState } from 'react'

import { configPath, prettyPath, updateConfig } from '../config.js'
import { reasonFor } from '../error.js'
import { truncate } from '../format.js'
import { openUrl } from '../open-url.js'
import { KEY_URL, verifyKey } from '../sources/linear.js'
import { colors, glyphs } from '../theme.js'
import { useSpinner } from '../use-spinner.js'
import { Gap } from './gap.js'

// Long enough to read the name and know the key went to the right account.
const PAUSE = 1400

// `lin_api_` is a constant rather than a secret, and seeing it is how you know the paste landed.
const PREFIX = 8

type Phase = 'input' | 'checking' | 'done'

type Props = {
  width: number
  onDone: () => void
  onCancel: () => void
}

function mask(value: string): string {
  return value.slice(0, PREFIX) + '•'.repeat(Math.max(0, value.length - PREFIX))
}

function clean(input: string): string {
  return input.replace(/[\u0000-\u001f\u007f]/g, '')
}

// The screen already says Linear at the top.
function withoutPrefix(error: unknown): string {
  return reasonFor(error).replace(/^Linear: /, '')
}

export function Connect({ width, onDone, onCancel }: Props) {
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [shadowed, setShadowed] = useState(false)

  const frame = useSpinner(phase === 'checking')
  const timer = useRef<NodeJS.Timeout>(undefined)

  // The key is two clicks away on a page nobody knows the URL of.
  useEffect(() => {
    openUrl(KEY_URL)

    return () => clearTimeout(timer.current)
  }, [])

  async function submit(raw: string): Promise<void> {
    const key = raw.trim()

    if (!key) return

    setPhase('checking')
    setError(null)

    try {
      const who = await verifyKey(key)

      updateConfig({ linearApiKey: key })

      setShadowed(Boolean(process.env.LINEAR_API_KEY?.trim()) && process.env.LINEAR_API_KEY?.trim() !== key)
      setName(who)
      setPhase('done')
      timer.current = setTimeout(onDone, PAUSE)
    } catch (failure) {
      // Editing a masked string is no way to fix a bad paste.
      setValue('')
      setError(withoutPrefix(failure))
      setPhase('input')
    }
  }

  useInput((input, key) => {
    if (phase !== 'input') return

    if (key.escape) {
      onCancel()
      return
    }

    if (key.return) {
      void submit(value)
      return
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1))
      return
    }

    if (key.ctrl || key.meta) return

    // A paste arrives as one chunk, usually carrying the newline that ended the copy —
    // that newline is a return, not a character.
    const [first, ...rest] = input.split(/[\r\n]/)
    const next = value + clean(first ?? '')

    setValue(next)

    if (rest.length) void submit(next)
  })

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={1}>
      <Text bold>CONNECT LINEAR</Text>

      <Gap />

      <Text dimColor>{truncate(`Opened ${KEY_URL.replace('https://', '')}`, width - 3)}</Text>
      <Text dimColor>{truncate('Create a key there and paste it below.', width - 3)}</Text>

      <Gap />

      {phase === 'done' ? (
        <Text color={colors.success}>
          {truncate(`${glyphs.success} Connected${name ? ` as ${name}` : ''}`, width - 3)}
        </Text>
      ) : (
        <Text>
          <Text dimColor>key </Text>
          <Text color={colors.accent}>{truncate(mask(value), Math.max(0, width - 8))}</Text>
          {phase === 'checking' ? <Text dimColor> {frame} checking…</Text> : <Text color={colors.accent}>▏</Text>}
        </Text>
      )}

      {phase === 'done' ? (
        shadowed ? (
          // Saving a key the environment overrides would otherwise look like it did nothing.
          <Text color={colors.pending}>{truncate('LINEAR_API_KEY in your environment still wins', width - 3)}</Text>
        ) : (
          <Text dimColor>{truncate(`saved to ${prettyPath(configPath())}`, width - 3)}</Text>
        )
      ) : null}

      {error ? <Text color={colors.failure}>{truncate(error, width - 3)}</Text> : null}

      <Gap />
    </Box>
  )
}
