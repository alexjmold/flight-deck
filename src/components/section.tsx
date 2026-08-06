import { Box, Text } from 'ink'

type Props = {
  label: string
  count: number
}

export function SectionHeader({ label, count }: Props) {
  return (
    <Box paddingLeft={2} paddingRight={1} justifyContent="space-between">
      <Text bold dimColor>
        {label}
      </Text>

      <Text dimColor>{count}</Text>
    </Box>
  )
}
