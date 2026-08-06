const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(iso: string, now = Date.now()): string {
  if (!iso) return ''

  const elapsed = now - new Date(iso).getTime()

  if (elapsed < MINUTE) return 'now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`

  return `${Math.floor(elapsed / (7 * DAY))}w`
}

export function truncate(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text

  return `${text.slice(0, Math.max(0, width - 1))}…`
}

export function clock(date: Date): string {
  return date.toTimeString().slice(0, 5)
}
