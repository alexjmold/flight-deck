import { Box, Text } from 'ink'

import { colors } from '../theme.js'
import { useSpinner } from '../use-spinner.js'

export function Loading() {
  const frame = useSpinner(true)

  return (
    <Box paddingLeft={2}>
      <Text color={colors.accent}>{frame}</Text>
      <Text dimColor> Fetching pull requests…</Text>
    </Box>
  )
}
