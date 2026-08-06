import { Box, Text } from 'ink'

import { truncate } from '../format.js'
import type { Badge, Detail as ItemDetail, Item } from '../item.js'
import { colors, glyphs, toneColor } from '../theme.js'

type Props = {
  item: Item
  isSelected: boolean
  width: number
  refWidth: number
  // One clock for the whole panel, so every running check spins in step.
  spinnerFrame: string
}

// Cursor + space + glyph + two spaces, then the ref column.
const REF_INDENT = 5
const META_INDENT = 5

export function Row({ item, isSelected, width, refWidth, spinnerFrame }: Props) {
  const { status, badges } = item

  const rightWidth = badges.reduce((sum, badge) => sum + badge.text.length, 0) + badges.length - 1

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.accent}>{isSelected ? `${glyphs.cursor} ` : '  '}</Text>
        <Text color={toneColor[status.tone]}>{status.animate ? spinnerFrame : status.glyph}</Text>
        <Text color={colors.number} dimColor={!isSelected}>
          {'  '}
          {item.ref.padEnd(refWidth)}
        </Text>
        <Text bold={isSelected} dimColor={item.dim && !isSelected}>
          {truncate(item.title, width - REF_INDENT - refWidth - 1)}
        </Text>
      </Box>

      <Box paddingLeft={META_INDENT} paddingRight={1} justifyContent="space-between">
        <Text dimColor>{truncate(item.subject, width - META_INDENT - rightWidth - 2)}</Text>

        <Badges badges={badges} />
      </Box>

      {item.detail ? <Detail detail={item.detail} width={width} /> : null}
    </Box>
  )
}

function Badges({ badges }: { badges: Badge[] }) {
  return (
    <Text>
      {badges.map((badge, index) => (
        // Badges are secondary chrome, so a muted one dims rather than taking a colour.
        <Text
          key={badge.text}
          color={badge.tone === 'muted' ? undefined : toneColor[badge.tone]}
          dimColor={badge.tone === 'muted'}
        >
          {index > 0 ? ' ' : ''}
          {badge.text}
        </Text>
      ))}
    </Text>
  )
}

// The counterpart in the other tool, on its own line — the meta line has no room left,
// and the repo a PR lives in is worth more than the columns this would take from it.
function Detail({ detail, width }: { detail: ItemDetail; width: number }) {
  const rightWidth = detail.badges.reduce((sum, badge) => sum + badge.text.length, 0) + detail.badges.length - 1

  return (
    <Box paddingLeft={META_INDENT} paddingRight={1} justifyContent="space-between">
      <Text>
        <Text color={toneColor[detail.tone]}>{detail.glyph} </Text>
        <Text dimColor>{truncate(detail.text, width - META_INDENT - rightWidth - 4)}</Text>
      </Text>

      <Badges badges={detail.badges} />
    </Box>
  )
}
