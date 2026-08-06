import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { relativeTime } from '../format'
import { byRecency, type Badge, type Item, type Section, type Status } from '../item'
import { glyphs } from '../theme'

const run = promisify(execFile)

export type CiState = 'success' | 'failure' | 'pending' | 'none'

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null

export type PullRequest = {
  id: string
  number: number
  title: string
  url: string
  repo: string
  author: string
  isDraft: boolean
  isConflicting: boolean
  updatedAt: string
  ci: CiState
  reviewDecision: ReviewDecision
}

export class GitHubError extends Error {}

// A hung request must not stall the poll: the panel would sit on a spinner and never
// refresh again, since the next tick finds a fetch still in flight.
const TIMEOUT = 15_000

const PR_FIELDS = `
  ... on PullRequest {
    id
    number
    title
    url
    isDraft
    mergeable
    updatedAt
    reviewDecision
    author { login }
    repository { nameWithOwner }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
`

const QUERY = `
{
  yours: search(query: "is:pr is:open author:@me", type: ISSUE, first: 50) {
    nodes { ${PR_FIELDS} }
  }
  requested: search(query: "is:pr is:open review-requested:@me", type: ISSUE, first: 50) {
    nodes { ${PR_FIELDS} }
  }
  teamRequested: search(query: "is:pr is:open team-review-requested:@me", type: ISSUE, first: 50) {
    nodes { ${PR_FIELDS} }
  }
}
`

type RawNode = {
  id?: string
  number?: number
  title?: string
  url?: string
  isDraft?: boolean
  mergeable?: string
  updatedAt?: string
  reviewDecision?: ReviewDecision
  author?: { login?: string } | null
  repository?: { nameWithOwner?: string }
  commits?: { nodes?: Array<{ commit?: { statusCheckRollup?: { state?: string } | null } }> }
}

type Variant = 'yours' | 'review'

const CI_STATUS: Record<CiState, Status> = {
  success: { glyph: glyphs.success, tone: 'ok' },
  failure: { glyph: glyphs.failure, tone: 'danger' },
  pending: { glyph: glyphs.pending, tone: 'warn', animate: true },
  none: { glyph: glyphs.none, tone: 'muted' },
}

function toCiState(state: string | undefined): CiState {
  switch (state) {
    case 'SUCCESS':
      return 'success'
    case 'FAILURE':
    case 'ERROR':
      return 'failure'
    case 'PENDING':
    case 'EXPECTED':
      return 'pending'
    default:
      return 'none'
  }
}

function toPullRequest(node: RawNode): PullRequest | null {
  if (!node.id || !node.number || !node.url) return null

  const rollup = node.commits?.nodes?.[0]?.commit?.statusCheckRollup

  return {
    id: node.id,
    number: node.number,
    title: node.title ?? '',
    url: node.url,
    repo: node.repository?.nameWithOwner ?? '',
    author: node.author?.login ?? '',
    isDraft: node.isDraft ?? false,
    isConflicting: node.mergeable === 'CONFLICTING',
    updatedAt: node.updatedAt ?? '',
    ci: toCiState(rollup?.state),
    reviewDecision: node.reviewDecision ?? null,
  }
}

function badgesFor(pr: PullRequest, variant: Variant): Badge[] {
  const badges: Badge[] = []

  if (pr.isDraft) badges.push({ text: 'DRAFT', tone: 'muted' })

  // Conflicts only matter on your own PRs — it isn't the reviewer's job to fix them.
  if (pr.isConflicting && variant === 'yours') {
    badges.push({ text: `${glyphs.conflict} conf`, tone: 'danger' })
  }

  if (variant === 'yours' && pr.reviewDecision === 'APPROVED') {
    badges.push({ text: 'APPROVED', tone: 'ok' })
  }

  if (variant === 'yours' && pr.reviewDecision === 'CHANGES_REQUESTED') {
    badges.push({ text: 'CHANGES', tone: 'warn' })
  }

  badges.push({ text: relativeTime(pr.updatedAt), tone: 'muted' })

  return badges
}

// What the row is asking for, in the order the states matter: red CI is the thing you would
// open first, and a conflict you cannot merge past comes before feedback you can read at
// leisure. Reviews are someone else's branch, so they get the slash command rather than work.
function promptFor(pr: PullRequest, variant: Variant): string {
  if (variant === 'review') return `/review ${pr.url}`

  if (pr.ci === 'failure') return `CI is failing on ${pr.url}. Work out why and fix it.`

  if (pr.isConflicting) return `${pr.url} has merge conflicts with its base branch. Resolve them.`

  if (pr.reviewDecision === 'CHANGES_REQUESTED') return `Address the review feedback on ${pr.url}.`

  return `Pick up where we left off on ${pr.url}.`
}

function toItem(pr: PullRequest, variant: Variant): Item {
  return {
    id: `github:${pr.id}`,
    source: 'github',
    ref: `#${pr.number}`,
    title: pr.title,
    url: pr.url,
    subject: variant === 'review' ? `${pr.repo.split('/').pop()} · @${pr.author}` : pr.repo,
    status: CI_STATUS[pr.ci],
    badges: badgesFor(pr, variant),
    updatedAt: pr.updatedAt,
    work: { repo: pr.repo, prompt: promptFor(pr, variant), fromPr: pr.url },
  }
}

function parseNodes(nodes: RawNode[] | undefined, variant: Variant): Item[] {
  return (nodes ?? [])
    .map(toPullRequest)
    .filter((pr): pr is PullRequest => pr !== null)
    .map((pr) => toItem(pr, variant))
}

type Payload = {
  data?: { yours?: { nodes?: RawNode[] }; requested?: { nodes?: RawNode[] }; teamRequested?: { nodes?: RawNode[] } }
}

async function query(): Promise<Payload> {
  let stdout: string

  try {
    const result = await run('gh', ['api', 'graphql', '-f', `query=${QUERY}`], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: TIMEOUT,
    })
    stdout = result.stdout
  } catch (error) {
    throw new GitHubError(describeFailure(error))
  }

  try {
    return JSON.parse(stdout) as Payload
  } catch {
    throw new GitHubError('gh returned something that is not JSON')
  }
}

export async function fetchGitHub(): Promise<Section[]> {
  const payload = await query()

  const yours = parseNodes(payload.data?.yours?.nodes, 'yours').sort(byRecency)

  // A PR can be requested from you directly and via a team — dedupe by node id.
  const reviews = new Map<string, Item>()

  for (const item of [
    ...parseNodes(payload.data?.requested?.nodes, 'review'),
    ...parseNodes(payload.data?.teamRequested?.nodes, 'review'),
  ]) {
    reviews.set(item.id, item)
  }

  return [
    { key: 'yours', source: 'github', label: 'YOURS', items: yours },
    { key: 'reviews', source: 'github', label: 'REVIEWS', items: [...reviews.values()].sort(byRecency) },
  ]
}

function describeFailure(error: unknown): string {
  const err = error as { code?: string; killed?: boolean; stderr?: string; message?: string }

  if (err.code === 'ENOENT') return 'gh CLI not found — install it from cli.github.com'
  if (err.killed) return 'gh timed out'

  const stderr = (err.stderr ?? '').trim()

  if (/auth|token|401/i.test(stderr)) return 'gh is not authenticated — run: gh auth login'

  // A failure can leave stderr empty, and an empty line in the footer says nothing.
  return stderr.split('\n')[0] || err.message || 'Failed to reach GitHub'
}
