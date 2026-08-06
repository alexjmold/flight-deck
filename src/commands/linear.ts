import { configPath, prettyPath, readConfig, updateConfig } from '../config'
import { reasonFor } from '../error'
import { KEY_URL, verifyKey } from '../sources/linear'

const USAGE = `Usage:
  flightdeck linear              show whether Linear is connected
  flightdeck linear <key>        verify a personal API key and store it
  flightdeck linear -            read the key from stdin
  flightdeck linear --logout     forget the stored key

Keys come from ${KEY_URL}.`

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []

  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)

  return Buffer.concat(chunks).toString('utf8')
}

async function status(): Promise<number> {
  const fromEnv = process.env.LINEAR_API_KEY?.trim()
  const key = fromEnv || readConfig().linearApiKey

  if (!key) {
    console.log(`Not connected. Create a key at ${KEY_URL}, then:\n\n  flightdeck linear <key>`)

    return 0
  }

  const source = fromEnv ? 'LINEAR_API_KEY in the environment' : prettyPath(configPath())

  try {
    const name = await verifyKey(key)

    console.log(`Connected${name ? ` as ${name}` : ''} — key from ${source}`)

    return 0
  } catch (error) {
    console.error(`${reasonFor(error)} — key from ${source}`)

    return 1
  }
}

async function connect(raw: string): Promise<number> {
  const key = raw.trim()

  if (!key) {
    console.error('No key given.')

    return 1
  }

  let name: string

  try {
    name = await verifyKey(key)
  } catch (error) {
    console.error(reasonFor(error))

    return 1
  }

  const path = updateConfig({ linearApiKey: key })

  console.log(`Connected${name ? ` as ${name}` : ''} — key saved to ${prettyPath(path)}`)

  if (process.env.LINEAR_API_KEY?.trim() && process.env.LINEAR_API_KEY.trim() !== key) {
    console.error('Warning: LINEAR_API_KEY in your environment overrides the stored key.')
  }

  return 0
}

function logout(): number {
  updateConfig({ linearApiKey: undefined })

  console.log(`Forgotten. Revoke the key itself at ${KEY_URL}.`)

  if (process.env.LINEAR_API_KEY?.trim()) {
    console.error('Note: LINEAR_API_KEY is still set in your environment, so Linear stays connected.')
  }

  return 0
}

export async function runLinear(args: string[]): Promise<number> {
  const [first] = args

  try {
    if (!first) return await status()
    if (first === '--logout' || first === '--forget') return logout()
    if (first === '-h' || first === '--help') {
      console.log(USAGE)

      return 0
    }

    // A key on the command line ends up in shell history; `-` is there for the scripts
    // and dotfiles that would rather it didn't.
    if (first === '-') return await connect(await readStdin())
    if (first.startsWith('-')) {
      console.error(USAGE)

      return 1
    }

    return await connect(first)
  } catch (error) {
    console.error(reasonFor(error))

    return 1
  }
}
