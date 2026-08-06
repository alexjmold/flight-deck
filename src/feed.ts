import { readConfig } from './config.js'
import { demoSources, isDemo } from './demo.js'
import type { Section, SourceKey } from './item.js'
import { fetchGitHub } from './sources/github.js'
import { fetchIssuesForPullRequests, fetchLinear } from './sources/linear.js'

export type Source = { key: SourceKey; fetch: () => Promise<Section[]> }

// Linear is opt-in: no key means no issues, just the offer of them on its own tab.
// The environment wins over the stored key, so a shell that exports one — or a .env in
// this directory — still overrides what `flightdeck linear` last wrote.
export function linearKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  // A demo must not reach a real account, and its rows carry their own Linear context.
  if (isDemo(env)) return undefined

  return env.LINEAR_API_KEY?.trim() || readConfig(env).linearApiKey
}

export function enabledSources(env: NodeJS.ProcessEnv = process.env): Source[] {
  if (isDemo(env)) return demoSources()

  const sources: Source[] = [{ key: 'github', fetch: fetchGitHub }]

  const apiKey = linearKey(env)

  if (apiKey) sources.push({ key: 'linear', fetch: () => fetchLinear(apiKey) })

  return sources
}

export type Filtered = { sections: Section[]; hidden: number }

// Drops work nothing has happened to in a while, by last activity rather than by age —
// a PR opened months ago but touched this morning is not stale. An item with no
// timestamp can't be judged, so it stays.
export function filterStale(sections: Section[], staleMs: number | null, now = Date.now()): Filtered {
  if (staleMs === null) return { sections, hidden: 0 }

  const cutoff = now - staleMs
  let hidden = 0

  const kept = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.updatedAt) return true

      const fresh = new Date(item.updatedAt).getTime()

      if (Number.isNaN(fresh) || fresh >= cutoff) return true

      hidden++

      return false
    }),
  }))

  return { sections: kept, hidden }
}

// Hangs each PR's Linear issue off its row: the issue to jump to with `l`, plus the state
// and priority to show beneath. Returns the sections untouched if nothing links up.
export async function linkPullRequests(sections: Section[], apiKey: string): Promise<Section[]> {
  const urls = sections
    .filter((section) => section.source === 'github')
    .flatMap((section) => section.items.map((item) => item.url))

  const issues = await fetchIssuesForPullRequests(apiKey, urls)

  if (!issues.size) return sections

  return sections.map((section) =>
    section.source === 'github'
      ? {
          ...section,
          items: section.items.map((item) => {
            const found = issues.get(item.url)

            return found ? { ...item, link: found.link, detail: found.detail } : item
          }),
        }
      : section,
  )
}
