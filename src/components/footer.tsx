import { Box, Text } from 'ink'

import { truncate } from '../format'
import { colors } from '../theme'

type Props = {
  errors: string[]
  hints: string[]
  width: number
}

export function Footer({ errors, hints, width }: Props) {
  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={1}>
      {errors.map((error) => (
        <Text key={error} color={colors.failure} dimColor>
          {truncate(error, width - 3)}
        </Text>
      ))}

      {hints.map((hint) => (
        <Text key={hint} dimColor>
          {truncate(hint, width - 3)}
        </Text>
      ))}
    </Box>
  )
}
