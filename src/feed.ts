import { readConfig } from './config.js'
import type { Section, SourceKey } from './item.js'
import { fetchGitHub } from './sources/github.js'
import { fetchIssuesForPullRequests, fetchLinear } from './sources/linear.js'

export type Source = { key: SourceKey; fetch: () => Promise<Section[]> }

// Linear is opt-in: no key means no issues, just the offer of them on its own tab.
// The environment wins over the stored key, so a shell that exports one — or a .env in
// this directory — still overrides what `flightdeck linear` last wrote.
export function linearKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.LINEAR_API_KEY?.trim() || readConfig(env).linearApiKey
}

export function enabledSources(env: NodeJS.ProcessEnv = process.env): Source[] {
  const sources: Source[] = [{ key: 'github', fetch: fetchGitHub }]

  const apiKey = linearKey(env)

  if (apiKey) sources.push({ key: 'linear', fetch: () => fetchLinear(apiKey) })

  return sources
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
