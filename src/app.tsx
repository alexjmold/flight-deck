import { Box, Text, useApp, useInput } from 'ink'
import { useEffect, useMemo, useState } from 'react'

import { launch, type Suspend } from './claude/launch.js'
import { Connect } from './components/connect.js'
import { Footer } from './components/footer.js'
import { Header, tabsFitInline } from './components/header.js'
import { Loading } from './components/loading.js'
import { Row } from './components/row.js'
import { SectionHeader } from './components/section.js'
import { SettingsScreen } from './components/settings.js'
import { truncate } from './format.js'
import { urlFor, type Item, type Section, type SourceKey } from './item.js'
import { openUrl } from './open-url.js'
import { useFeed } from './use-feed.js'
import { useRepos } from './use-repos.js'
import { useSpinner } from './use-spinner.js'
import { useTerminalSize } from './use-terminal-size.js'

type Entry = { kind: 'header'; key: string; label: string; count: number } | { kind: 'item'; key: string; item: Item }

// Title + rule (2) + gap (1), plus a spare line: a frame that exactly fills the terminal
// scrolls it, which strands the previous frame's top row above. The tab row and the
// footer are added on top.
const CHROME = 4

// Wide enough for #12345, capped so one long identifier can't squeeze every title.
const REF_WIDTH = { min: 6, max: 10 }

type View = { key: string; label: string; sources: SourceKey[] | null }

const VIEWS: View[] = [
  { key: 'all', label: 'ALL', sources: null },
  { key: 'github', label: 'GITHUB', sources: ['github'] },
  { key: 'linear', label: 'LINEAR', sources: ['linear'] },
]

// A linked row carries an extra line of Linear context, so heights vary per entry.
function heightOf(entry: Entry): number {
  if (entry.kind === 'header') return 2

  return entry.item.detail ? 4 : 3
}

function buildEntries(sections: Section[]): Entry[] {
  const entries: Entry[] = []

  for (const section of sections) {
    if (!section.items.length) continue

    entries.push({ kind: 'header', key: `h-${section.key}`, label: section.label, count: section.items.length })

    for (const item of section.items) entries.push({ kind: 'item', key: item.id, item })
  }

  return entries
}

// One width for the whole panel, so titles line up across sections and sources.
function refWidthFor(sections: Section[]): number {
  const longest = Math.max(0, ...sections.flatMap((section) => section.items.map((item) => item.ref.length)))

  return Math.min(REF_WIDTH.max, Math.max(REF_WIDTH.min, longest + 1))
}

type AppProps = {
  interactive?: boolean
  onReady?: () => void
  // Only cli.tsx can hand the terminal over, so it passes down the means to do it.
  suspend?: Suspend
}

export function App({ interactive = true, onReady, suspend }: AppProps) {
  const { exit } = useApp()
  const { sections, lastUpdated, isFetching, isRefreshing, errors, allFailed, hasLinear, hidden, refresh } = useFeed()
  const repos = useRepos()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [viewIndex, setViewIndex] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { width, rows } = useTerminalSize()

  const view = VIEWS[viewIndex]!

  // The LINEAR tab exists whether or not there is a key behind it: an empty tab you can
  // land on is how anyone finds out the panel does Linear at all.
  const invite = view.key === 'linear' && !hasLinear

  const filter = view.sources

  const shown = useMemo(
    () => (filter ? sections.filter((section) => filter.includes(section.source)) : sections),
    [sections, filter],
  )

  const entries = useMemo(() => buildEntries(shown), [shown])
  const selectable = useMemo(() => entries.filter((entry) => entry.kind === 'item'), [entries])
  const refWidth = useMemo(() => refWidthFor(shown), [shown])

  const found = selectable.findIndex((entry) => entry.key === selectedId)
  const selectedIndex = found === -1 ? 0 : found
  const selected = selectable[selectedIndex]
  const selectedItem = selected?.kind === 'item' ? selected.item : undefined

  // Only rows whose repo is checked out somewhere we know about can be opened.
  const work = selectedItem?.work
  const canLaunch = Boolean(work && repos.has(work.repo))

  // The tabs only cost a line when they can't share the title row.
  const tabRow = !tabsFitInline(width, VIEWS) ? 1 : 0

  // Only tick while something is actually running, and share the frame across every row
  // so they spin together rather than drifting apart.
  const isRunning = entries.some((entry) => entry.kind === 'item' && entry.item.status.animate)
  const spinnerFrame = useSpinner(isRunning)

  const hints = settingsOpen
    ? ['↑↓ move  ←→ change  esc done']
    : connecting
      ? ['⏎ connect  esc cancel']
      : hintsFor(hasLinear, selectedItem, canLaunch, invite)
  const budget = Math.max(0, rows - CHROME - tabRow - errors.length - hints.length)

  // Only the very first fetch gets a spinner; 30s polls refresh in place.
  const isFirstLoad = !lastUpdated && isFetching

  useEffect(() => {
    const target = entries.findIndex((entry) => entry.key === selected?.key)

    if (target === -1) return

    setOffset((prev) => {
      let next = Math.min(prev, target)
      let height = 0

      for (let i = next; i <= target; i++) height += heightOf(entries[i]!)

      while (height > budget && next < target) {
        height -= heightOf(entries[next]!)
        next++
      }

      // Then reclaim any room left above. Without this, a selection that resets to the top
      // of a shorter list — switching tabs while scrolled — strands the section header off
      // screen with empty space below it.
      while (next > 0 && height + heightOf(entries[next - 1]!) <= budget) {
        next--
        height += heightOf(entries[next]!)
      }

      return next
    })
  }, [entries, selected?.key, budget])

  useEffect(() => {
    if (lastUpdated || errors.length) onReady?.()
  }, [lastUpdated, errors.length, onReady])

  useInput(
    (input, key) => {
      // Ink handles Ctrl+C itself; the rest arrive as their bare letter, and would
      // otherwise land on the keys below — Ctrl+L opening a browser tab, say.
      if (key.ctrl || key.meta) return

      if (input === 'q') exit()

      if (key.upArrow || input === 'k') setSelectedId(selectable[Math.max(0, selectedIndex - 1)]?.key ?? null)

      if (key.downArrow || input === 'j') {
        setSelectedId(selectable[Math.min(selectable.length - 1, selectedIndex + 1)]?.key ?? null)
      }

      const item = selectedItem

      if (key.return && item) openUrl(item.url)

      // g and l reach the same work in whichever tool you want it in, from either side.
      if (input === 'g' && item) {
        const url = urlFor(item, 'github')

        if (url) openUrl(url)
      }

      if (input === 'l' && item) {
        const url = urlFor(item, 'linear')

        if (url) openUrl(url)
      }

      if (input === 'c' && work && canLaunch) void launch(work, suspend)

      // Uppercase, since l already opens the Linear side of a row. Available while
      // connected too — a revoked key is fixed by pressing it again.
      if (input === 'L' || (key.return && invite)) setConnecting(true)

      if (key.leftArrow || key.rightArrow) {
        const step = key.rightArrow ? 1 : VIEWS.length - 1

        setViewIndex((prev) => (prev + step) % VIEWS.length)
      }

      if (input === 'r') refresh()

      if (input === 's') setSettingsOpen(true)
    },
    // The connect screen takes the keyboard while it is up, so q and j don't land in a key.
    { isActive: interactive && !connecting && !settingsOpen },
  )

  const visible: Entry[] = []
  let used = 0

  for (const entry of entries.slice(offset)) {
    const height = heightOf(entry)

    if (used + height > budget) break

    visible.push(entry)
    used += height
  }

  return (
    <Box flexDirection="column" width={width}>
      <Header width={width} lastUpdated={lastUpdated} isRefreshing={isRefreshing} tabs={VIEWS} activeTab={view.key} />

      <Box flexDirection="column" marginTop={1}>
        {settingsOpen ? (
          <SettingsScreen
            width={width}
            onDone={() => {
              setSettingsOpen(false)
              refresh()
            }}
          />
        ) : connecting ? (
          <Connect
            width={width}
            onDone={() => {
              setConnecting(false)
              refresh()
            }}
            onCancel={() => setConnecting(false)}
          />
        ) : invite ? (
          <Box flexDirection="column" paddingLeft={2}>
            <Text dimColor>Linear isn't connected.</Text>
            <Text> </Text>
            <Text dimColor>{truncate('Press ⏎ to add a key. The issues', width - 3)}</Text>
            <Text dimColor>{truncate('assigned to you appear here.', width - 3)}</Text>
          </Box>
        ) : isFirstLoad ? (
          <Loading />
        ) : entries.length === 0 ? (
          <Box flexDirection="column" paddingLeft={2}>
            {/* The footer carries the reason, so this line only has to say which case it is. */}
            <Text dimColor>{allFailed ? 'Could not load.' : 'Nothing in flight.'}</Text>

            {/* An empty panel with a stale filter behind it otherwise looks broken. */}
            {!allFailed && hidden ? (
              <Text dimColor>{truncate(`${hidden} hidden as stale — press s to change.`, width - 3)}</Text>
            ) : null}

            <Text> </Text>
          </Box>
        ) : (
          visible.map((entry) =>
            entry.kind === 'header' ? (
              <Box key={entry.key} flexDirection="column">
                <SectionHeader label={entry.label} count={entry.count} />
                <Text> </Text>
              </Box>
            ) : (
              <Box key={entry.key} flexDirection="column">
                <Row
                  item={entry.item}
                  isSelected={entry.key === selected?.key}
                  width={width}
                  refWidth={refWidth}
                  spinnerFrame={spinnerFrame}
                />
                <Text> </Text>
              </Box>
            ),
          )
        )}
      </Box>

      <Footer errors={errors} hints={hints} width={width} />
    </Box>
  )
}

// A second line only exists once there is something to put on it, and the open keys are
// only advertised when the selected row actually has somewhere to go.
function hintsFor(hasLinear: boolean, item: Item | undefined, canLaunch: boolean, invite: boolean): string[] {
  // Nothing to move through and nothing to open on an empty Linear tab.
  if (invite) return ['⏎ connect  ←→ view  q quit']

  const hints = ['↑↓ move ⏎ open r refresh q quit']

  const extras: string[] = ['←→ view', 's settings']

  if (!hasLinear) extras.push('L connect linear')

  // ⏎ already opens the row's own tool, so only the counterpart is worth advertising.
  if (hasLinear && item?.link) extras.push(item.source === 'github' ? 'l linear' : 'g github')

  if (canLaunch) extras.push('c claude')

  return extras.length ? [...hints, extras.join('  ')] : hints
}
