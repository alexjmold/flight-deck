import { Box, Text } from 'ink'

import { colors } from '../theme'
import { useSpinner } from '../use-spinner'
import { Gap } from './gap'

export function Loading() {
  const frame = useSpinner(true)

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2}>
        <Text color={colors.accent}>{frame}</Text>
        <Text dimColor> Fetching pull requests…</Text>
      </Box>

      <Gap />
    </Box>
  )
}
