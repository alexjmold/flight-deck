import type { Source } from './feed'
import { relativeTime } from './format'
import type { Badge, Detail, Item, Link, Section, SourceKey, Status } from './item'
import { glyphs } from './theme'

// Made-up work for screenshots. FLIGHT_DECK_DEMO=1 renders the panel from these instead of
// reaching for gh or Linear, so a frame can be captured without anyone's real work in it —
// and without a network round trip deciding what ends up in the README.

export function isDemo(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.FLIGHT_DECK_DEMO?.trim() ?? ''

  return value !== '' && value !== '0'
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const PASSING: Status = { glyph: glyphs.success, tone: 'ok' }
const FAILING: Status = { glyph: glyphs.failure, tone: 'danger' }
const RUNNING: Status = { glyph: glyphs.pending, tone: 'warn', animate: true }
const STARTED: Status = { glyph: glyphs.pending, tone: 'warn' }
const TODO: Status = { glyph: glyphs.todo, tone: 'muted' }

const DRAFT: Badge = { text: 'DRAFT', tone: 'muted' }
const CONFLICT: Badge = { text: `${glyphs.conflict} conf`, tone: 'danger' }
const APPROVED: Badge = { text: 'APPROVED', tone: 'ok' }
const P1: Badge = { text: 'P1', tone: 'danger' }
const P2: Badge = { text: 'P2', tone: 'warn' }

type Row = {
  ref: string
  title: string
  url: string
  subject: string
  ago: number
  status: Status
  badges?: Badge[]
  repo?: string
  link?: Link
  detail?: Detail
}

// Ages are relative to now, so a frame taken today reads the same as one taken next month.
function toItem(source: SourceKey, row: Row): Item {
  const updatedAt = new Date(Date.now() - row.ago).toISOString()

  return {
    id: `demo:${source}:${row.ref}`,
    source,
    ref: row.ref,
    title: row.title,
    url: row.url,
    subject: row.subject,
    status: row.status,
    badges: [...(row.badges ?? []), { text: relativeTime(updatedAt), tone: 'muted' }],
    updatedAt,
    link: row.link,
    detail: row.detail,
    ...(row.repo ? { work: { repo: row.repo, prompt: `Pick up where we left off on ${row.url}.` } } : {}),
  }
}

const YOURS: Row[] = [
  {
    ref: '#387',
    title: 'fix(auth): stop the session refresh racing itself',
    url: 'https://github.com/northwind/atlas/pull/387',
    subject: 'northwind/atlas',
    repo: 'northwind/atlas',
    ago: 17 * HOUR,
    status: PASSING,
    badges: [APPROVED],
    link: { url: 'https://linear.app/demo/issue/ATL-482', ref: 'ATL-482' },
    detail: { glyph: glyphs.pending, tone: 'warn', text: 'ATL-482 In Review', badges: [P2] },
  },
  {
    ref: '#71',
    title: 'feat: read settings from a config file',
    url: 'https://github.com/northwind/harbour/pull/71',
    subject: 'northwind/harbour',
    repo: 'northwind/harbour',
    ago: 6 * DAY,
    status: FAILING,
    badges: [CONFLICT],
  },
  {
    ref: '#2586',
    title: 'feat(search): cmd+k across every workspace',
    url: 'https://github.com/orbit-labs/kestrel/pull/2586',
    subject: 'orbit-labs/kestrel',
    repo: 'orbit-labs/kestrel',
    ago: 40 * MINUTE,
    status: RUNNING,
    badges: [DRAFT],
  },
]

const REVIEWS: Row[] = [
  {
    ref: '#338',
    title: 'docs: rewrite the release notes generator',
    url: 'https://github.com/northwind/atlas/pull/338',
    subject: 'atlas · @jrivera',
    repo: 'northwind/atlas',
    ago: 8 * DAY,
    status: PASSING,
  },
  {
    ref: '#1204',
    title: 'fix(ui): stop the presence cursor flickering',
    url: 'https://github.com/orbit-labs/kestrel/pull/1204',
    subject: 'kestrel · @tspencer',
    repo: 'orbit-labs/kestrel',
    ago: 3 * HOUR,
    status: FAILING,
  },
]

const ISSUES: Row[] = [
  {
    ref: 'ATL-482',
    title: 'Session refresh fires twice on a slow network',
    url: 'https://linear.app/demo/issue/ATL-482',
    subject: 'In Review',
    ago: 17 * HOUR,
    status: STARTED,
    badges: [P2],
    link: { url: 'https://github.com/northwind/atlas/pull/387', ref: '#387' },
  },
  {
    ref: 'ENG-412',
    title: 'Fix flaky auth redirect on first sign-in',
    url: 'https://linear.app/demo/issue/ENG-412',
    subject: 'In Progress',
    ago: 2 * HOUR,
    status: STARTED,
    badges: [P1],
  },
  {
    ref: 'ENG-431',
    title: 'Add retry to the webhook sender',
    url: 'https://linear.app/demo/issue/ENG-431',
    subject: 'Todo',
    ago: 3 * DAY,
    status: TODO,
  },
]

function sections(): Section[] {
  return [
    { key: 'yours', source: 'github', label: 'YOURS', items: YOURS.map((row) => toItem('github', row)) },
    { key: 'reviews', source: 'github', label: 'REVIEWS', items: REVIEWS.map((row) => toItem('github', row)) },
    { key: 'issues', source: 'linear', label: 'ISSUES', items: ISSUES.map((row) => toItem('linear', row)) },
  ]
}

export function demoSources(): Source[] {
  const of = (source: SourceKey) => async () => sections().filter((section) => section.source === source)

  return [
    { key: 'github', fetch: of('github') },
    { key: 'linear', fetch: of('linear') },
  ]
}

// Every demo repo counts as checked out, so the `c` hint shows without depending on what
// this machine happens to have cloned.
export function demoRepos(): Map<string, string> {
  const repos = [...YOURS, ...REVIEWS].map((row) => row.repo).filter((repo): repo is string => Boolean(repo))

  return new Map(repos.map((repo) => [repo, `/demo/${repo}`]))
}
