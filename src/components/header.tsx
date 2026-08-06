import { Box, Text } from 'ink'

import { clock } from '../format'
import { colors, glyphs } from '../theme'
import { useSpinner } from '../use-spinner'

export type Tab = { key: string; label: string }

const TITLE = 'IN FLIGHT'

// "12:28 ⟳"
const CLOCK_WIDTH = 7

const GAP = 2

// Every tab reserves a column either side for its brackets, so the labels sit at fixed
// positions and only the gutter characters change as you move between them.
function tabsWidth(tabs: Tab[]): number {
  return tabs.reduce((sum, tab) => sum + tab.label.length + 2, 0)
}

// Sharing the title row is the nicer look, but below ~44 columns the tabs would collide
// with the clock — there they drop to a line of their own.
export function tabsFitInline(width: number, tabs: Tab[]): boolean {
  if (tabs.length < 2) return false

  return width >= 2 + TITLE.length + GAP + tabsWidth(tabs) + GAP + CLOCK_WIDTH + 1
}

// No separator between tabs: the reserved bracket columns already leave exactly two
// characters between one label and the next, whichever tab is active. A null active tab
// brackets none of them, and costs no width to say so.
function Tabs({ tabs, activeTab }: { tabs: Tab[]; activeTab: string | null }) {
  return (
    <Text>
      {tabs.map((tab) =>
        tab.key === activeTab ? (
          <Text key={tab.key} bold color={colors.accent}>
            [{tab.label}]
          </Text>
        ) : (
          <Text key={tab.key} dimColor>
            {` ${tab.label} `}
          </Text>
        ),
      )}
    </Text>
  )
}

type Props = {
  width: number
  lastUpdated: Date | null
  isRefreshing: boolean
  tabs: Tab[]
  activeTab: string | null
}

export function Header({ width, lastUpdated, isRefreshing, tabs, activeTab }: Props) {
  const frame = useSpinner(isRefreshing)

  const inline = tabsFitInline(width, tabs)

  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={1}>
      <Box justifyContent="space-between">
        <Text>
          <Text bold>{TITLE}</Text>
          {inline ? <Text>{' '.repeat(GAP)}</Text> : null}
          {inline ? <Tabs tabs={tabs} activeTab={activeTab} /> : null}
        </Text>

        <Text>
          <Text dimColor>{lastUpdated ? clock(lastUpdated) : '--:--'} </Text>
          <Text color={isRefreshing ? colors.accent : undefined} dimColor={!isRefreshing}>
            {isRefreshing ? frame : glyphs.refresh}
          </Text>
        </Text>
      </Box>

      {tabs.length > 1 && !inline ? <Tabs tabs={tabs} activeTab={activeTab} /> : null}

      <Text dimColor>{glyphs.rule.repeat(Math.max(0, width - 3))}</Text>
    </Box>
  )
}
