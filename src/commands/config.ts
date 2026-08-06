import { configPath, prettyPath } from '../config'
import { reasonFor } from '../error'
import {
  BUSY_REFRESH,
  DEFAULT_REFRESH,
  DEFAULT_STALE,
  formatRefresh,
  readSettings,
  setRefresh,
  setStale,
} from '../settings'

const USAGE = `Usage:
  flightdeck config                 show the current settings
  flightdeck config stale <value>   hide work untouched for longer than this
                                    (4w, 10d, 48h, or off)
  flightdeck config refresh <secs>  how often to refetch, in whole seconds`

function list(): number {
  const settings = readSettings()

  console.log(`  stale     ${settings.stale.padEnd(8)}${describeStale(settings.stale)}`)
  console.log(`  refresh   ${formatRefresh(settings.refreshSeconds).padEnd(8)}how often the panel refetches`)
  console.log(`\n  ${prettyPath(configPath())}`)

  return 0
}

function describeStale(stale: string): string {
  return stale === 'off' ? 'everything is shown, however old' : 'work untouched for longer is hidden'
}

export function runConfig(args: string[]): number {
  const [key, ...rest] = args
  const value = rest.join(' ')

  if (!key) return list()

  if (key === '-h' || key === '--help') {
    console.log(USAGE)

    return 0
  }

  if (key !== 'stale' && key !== 'refresh') {
    console.error(`Unknown setting "${key}".\n\n${USAGE}`)

    return 1
  }

  if (!value) {
    console.error(`No value given. Defaults are ${DEFAULT_STALE} and ${DEFAULT_REFRESH}s.\n\n${USAGE}`)

    return 1
  }

  try {
    if (key === 'stale') {
      console.log(`stale = ${setStale(value)}`)

      return 0
    }

    const seconds = setRefresh(value)

    console.log(`refresh = ${formatRefresh(seconds)}`)

    if (seconds < BUSY_REFRESH) {
      console.error(`Warning: polling this often may get you rate limited by GitHub or Linear.`)
    }

    return 0
  } catch (error) {
    console.error(reasonFor(error))

    return 1
  }
}
