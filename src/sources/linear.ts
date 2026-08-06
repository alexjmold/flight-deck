import { relativeTime } from '../format.js'
import { byRecency, type Badge, type Detail, type Item, type Link, type Section, type Status } from '../item.js'
import { glyphs } from '../theme.js'

const ENDPOINT = 'https://api.linear.app/graphql'

// Where a personal key comes from. Linear has no OAuth flow a CLI can run without a
// client secret to hide, so this page is the whole of the sign-in.
export const KEY_URL = 'https://linear.app/settings/api'

// A hung request must not stall the 30s poll.
const TIMEOUT = 10_000

// `auth` marks the one failure the panel can do something about: a missing, revoked or
// mistyped key is fixed by reconnecting, and the footer says so.
export class LinearError extends Error {
  constructor(
    message: string,
    readonly auth = false,
  ) {
    super(message)
  }
}

// "Started" is In Progress / In Review and any custom started state; "unstarted" is Todo.
const QUERY = `
{
  viewer {
    assignedIssues(first: 50, filter: { state: { type: { in: ["started", "unstarted"] } } }) {
      nodes {
        id
        identifier
        title
        url
        updatedAt
        priority
        state { name type }
        attachments { nodes { url sourceType } }
      }
    }
  }
}
`

// The cheapest question that only a valid key can answer, asked before one is saved: a
// key that turns out to be wrong should say so while you still have the tab open, not
// thirty seconds later as an error above the hints.
const VIEWER_QUERY = `
{
  viewer { name }
}
`

// Resolves PR urls back to their issues. Not scoped to the viewer, so a PR you are only
// reviewing still finds its issue.
const LINKS_QUERY = `
query($urls: [String!]) {
  issues(filter: { attachments: { url: { in: $urls } } }, first: 50) {
    nodes {
      identifier
      url
      priority
      state { name type }
      attachments { nodes { url sourceType } }
    }
  }
}
`

type RawAttachments = { nodes?: Array<{ url?: string; sourceType?: string }> }

type RawIssue = {
  id?: string
  identifier?: string
  title?: string
  url?: string
  updatedAt?: string
  priority?: number
  state?: { name?: string; type?: string }
  attachments?: RawAttachments
}

const STARTED: Status = { glyph: glyphs.pending, tone: 'warn' }
const TODO: Status = { glyph: glyphs.todo, tone: 'muted' }

// 0 is "no priority" and 3/4 are Medium/Low — only the two that change your day get a badge.
const PRIORITY: Record<number, Badge> = {
  1: { text: 'P1', tone: 'danger' },
  2: { text: 'P2', tone: 'warn' },
}

function priorityBadge(priority: number | undefined): Badge[] {
  const badge = priority === undefined ? undefined : PRIORITY[priority]

  return badge ? [badge] : []
}

// Linear's GitHub integration files the PR as an attachment on the issue, so the link is
// an exact url match rather than a guess at branch names.
function pullRequestUrl(attachments: RawAttachments | undefined): string | undefined {
  return attachments?.nodes?.find((node) => node.sourceType === 'github' && node.url)?.url
}

function refFromPullRequestUrl(url: string): string {
  return `#${url.split('/').pop()}`
}

function toItem(issue: RawIssue): Item | null {
  if (!issue.id || !issue.identifier || !issue.url) return null

  const updatedAt = issue.updatedAt ?? ''
  const prUrl = pullRequestUrl(issue.attachments)

  return {
    id: `linear:${issue.id}`,
    source: 'linear',
    ref: issue.identifier,
    title: issue.title ?? '',
    url: issue.url,
    // The team is already implied by the identifier prefix, so spend the columns on state.
    subject: issue.state?.name ?? '',
    status: issue.state?.type === 'started' ? STARTED : TODO,
    badges: [...priorityBadge(issue.priority), { text: relativeTime(updatedAt), tone: 'muted' as const }],
    updatedAt,
    link: prUrl ? { url: prUrl, ref: refFromPullRequestUrl(prUrl) } : undefined,
  }
}

// Started work sits above the queue regardless of which was touched most recently.
function byStateThenRecency(a: Item, b: Item): number {
  const rank = (item: Item) => (item.status === STARTED ? 0 : 1)

  return rank(a) - rank(b) || byRecency(a, b)
}

async function request<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  let response: Response

  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Personal API keys go in raw; only OAuth access tokens are Bearer-prefixed.
        Authorization: apiKey.startsWith('lin_oauth') ? `Bearer ${apiKey}` : apiKey,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(TIMEOUT),
    })
  } catch (error) {
    throw new LinearError(describeFailure(error))
  }

  if (response.status === 401 || response.status === 403) {
    throw new LinearError('Linear: invalid API key', true)
  }

  if (!response.ok) {
    throw new LinearError(`Linear: request failed (${response.status})`)
  }

  // Linear answers 200 with a top-level errors[] when the query itself is rejected.
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> }

  if (payload.errors?.length) {
    const message = payload.errors[0]?.message ?? 'query rejected'

    if (/auth|token|unauthor/i.test(message)) throw new LinearError('Linear: invalid API key', true)

    throw new LinearError(`Linear: ${message}`)
  }

  return payload.data as T
}

// Returns the name the key belongs to, which is worth showing back: it confirms both that
// the key works and that it is the account you meant.
export async function verifyKey(apiKey: string): Promise<string> {
  const data = await request<{ viewer?: { name?: string } }>(apiKey, VIEWER_QUERY)

  return data?.viewer?.name?.trim() || ''
}

export async function fetchLinear(apiKey: string): Promise<Section[]> {
  const data = await request<{ viewer?: { assignedIssues?: { nodes?: RawIssue[] } } }>(apiKey, QUERY)

  const items = (data?.viewer?.assignedIssues?.nodes ?? [])
    .map(toItem)
    .filter((item): item is Item => item !== null)
    .sort(byStateThenRecency)

  return [{ key: 'issues', source: 'linear', label: 'ISSUES', items }]
}

export type IssueLink = { link: Link; detail: Detail }

// Given PR urls, returns what Linear knows about each — the issue to jump to, and the
// state and priority to show under the row.
export async function fetchIssuesForPullRequests(apiKey: string, urls: string[]): Promise<Map<string, IssueLink>> {
  const found = new Map<string, IssueLink>()

  if (!urls.length) return found

  const data = await request<{ issues?: { nodes?: RawIssue[] } }>(apiKey, LINKS_QUERY, { urls })

  const wanted = new Set(urls)

  for (const issue of data?.issues?.nodes ?? []) {
    if (!issue.identifier || !issue.url) continue

    const entry: IssueLink = {
      link: { url: issue.url, ref: issue.identifier },
      detail: {
        glyph: issue.state?.type === 'started' ? STARTED.glyph : TODO.glyph,
        tone: issue.state?.type === 'started' ? STARTED.tone : TODO.tone,
        text: `${issue.identifier} ${issue.state?.name ?? ''}`.trim(),
        badges: priorityBadge(issue.priority),
      },
    }

    // One issue can carry several attachments; only the ones we asked about matter.
    for (const node of issue.attachments?.nodes ?? []) {
      if (node.url && wanted.has(node.url)) found.set(node.url, entry)
    }
  }

  return found
}

function describeFailure(error: unknown): string {
  const err = error as { name?: string; message?: string }

  if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'Linear: timed out'

  return 'Linear: unreachable'
}
