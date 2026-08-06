import { useCallback, useEffect, useRef, useState } from 'react'

import { reasonFor } from './error.js'
import { enabledSources, filterStale, linearKey, linkPullRequests, type Source } from './feed.js'
import type { Section } from './item.js'
import { readSettings } from './settings.js'
import { LinearError } from './sources/linear.js'

export type Feed = {
  sections: Section[]
  lastUpdated: Date | null
  isFetching: boolean
  isRefreshing: boolean
  errors: string[]
  allFailed: boolean
  // With one source there is nothing to switch between, so the view chrome stays hidden.
  hasLinear: boolean
  // Dropped by the stale filter. An empty panel needs to say so rather than look broken.
  hidden: number
  refresh: () => void
}

type SourceState = Record<string, { sections: Section[]; error: string | null }>

export function useFeed(): Feed {
  const [sources, setSources] = useState<Source[]>(enabledSources)
  const [state, setState] = useState<SourceState>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hidden, setHidden] = useState(0)
  const [pollInterval, setPollInterval] = useState(() => readSettings().refreshSeconds * 1000)

  const inFlight = useRef(false)

  const collect = useCallback(async () => {
    // Read afresh each time, so connecting Linear or changing a setting from inside the
    // panel takes effect on the next fetch rather than the next launch.
    const active = enabledSources()
    const settings = readSettings()

    setSources(active)
    setPollInterval(settings.refreshSeconds * 1000)

    const results = await Promise.allSettled(active.map((source) => source.fetch()))

    const fetched: Record<string, Section[] | null> = {}

    results.forEach((result, index) => {
      fetched[active[index]!.key] = result.status === 'fulfilled' ? result.value : null
    })

    // Cross-source enrichment is a bonus, never a dependency: if it fails the rows just
    // render without their Linear context.
    const apiKey = linearKey()

    if (apiKey && fetched.github) {
      try {
        fetched.github = await linkPullRequests(fetched.github, apiKey)
      } catch {
        // Leave the PR rows as they are.
      }
    }

    // Filtering after enrichment, so a hidden PR takes its Linear detail with it.
    let dropped = 0

    for (const key of Object.keys(fetched)) {
      const sections = fetched[key]

      if (!sections) continue

      const result = filterStale(sections, settings.staleMs)

      fetched[key] = result.sections
      dropped += result.hidden
    }

    setHidden(dropped)

    setState((prev) => {
      const next: SourceState = {}

      results.forEach((result, index) => {
        const key = active[index]!.key

        // Keep the last good sections for a failed source; one tool being down
        // shouldn't blank the others.
        next[key] =
          result.status === 'fulfilled'
            ? { sections: fetched[key] ?? result.value, error: null }
            : { sections: prev[key]?.sections ?? [], error: messageFor(result.reason) }
      })

      return next
    })

    // A timestamp on a frame where nothing loaded would be a lie — the header keeps
    // showing --:-- until something actually arrives.
    if (results.some((result) => result.status === 'fulfilled')) setLastUpdated(new Date())
  }, [])

  const load = useCallback(
    async (manual: boolean) => {
      if (inFlight.current) return

      inFlight.current = true
      setIsFetching(true)
      setIsRefreshing(manual)

      try {
        await collect()
      } finally {
        // Released whatever happened: a fetch left in flight would lock out every later
        // poll, and the refresh key with it.
        inFlight.current = false
        setIsFetching(false)
        setIsRefreshing(false)
      }
    },
    [collect],
  )

  useEffect(() => {
    void load(false)

    const timer = setInterval(() => void load(false), pollInterval)

    return () => clearInterval(timer)
  }, [load, pollInterval])

  const entries = sources.map((source) => state[source.key])
  const sections = entries.flatMap((entry) => entry?.sections ?? []).filter((section) => section.items.length > 0)
  const errors = entries.map((entry) => entry?.error).filter((error): error is string => Boolean(error))

  return {
    sections,
    lastUpdated,
    isFetching,
    isRefreshing,
    errors,
    allFailed: errors.length === sources.length,
    hasLinear: sources.some((source) => source.key === 'linear'),
    hidden,
    refresh: () => void load(true),
  }
}

function messageFor(reason: unknown): string {
  // A revoked or mistyped key is the one failure with a key to press.
  if (reason instanceof LinearError && reason.auth) return `${reason.message} — press L to reconnect`

  return reasonFor(reason)
}
