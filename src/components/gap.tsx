import { Text } from 'ink'

// The blank line every row and every screen leaves beneath itself, so nothing butts up
// against the footer.
export function Gap() {
  return <Text> </Text>
}
