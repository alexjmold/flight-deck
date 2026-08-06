import { appleScriptQuote, shellQuote } from './quote'

// Opening a window means knowing which terminal you are in. macOS has no registered default
// the way Linux has x-terminal-emulator, and needs none: the emulator the panel is already
// running inside announces itself on the way in.
//
// Anything that can't run a command in a new window — Warp, VS Code, SSH, anything
// unrecognised — returns null, and the caller suspends the panel instead. That path is what
// makes the feature work everywhere, not a consolation prize.

export type Spawn = { command: string; args: string[] }

// TERM_PROGRAM is set by the emulator; __CFBundleIdentifier is set by launchd on macOS and
// survives a shell that rewrites the first. Either identifies the terminal.
const TERMINALS: Record<string, string> = {
  ghostty: 'ghostty',
  'com.mitchellh.ghostty': 'ghostty',
  'iTerm.app': 'iterm',
  'com.googlecode.iterm2': 'iterm',
  Apple_Terminal: 'terminal',
  'com.apple.Terminal': 'terminal',
  WezTerm: 'wezterm',
  'com.github.wez.wezterm': 'wezterm',
  Alacritty: 'alacritty',
  'org.alacritty': 'alacritty',
  kitty: 'kitty',
  'net.kovidgoyal.kitty': 'kitty',
}

function terminalOf(env: NodeJS.ProcessEnv): string | undefined {
  // kitty announces itself in neither variable.
  if (env.KITTY_WINDOW_ID || env.TERM === 'xterm-kitty') return 'kitty'

  for (const hint of [env.TERM_PROGRAM, env.__CFBundleIdentifier]) {
    const found = hint ? TERMINALS[hint] : undefined

    if (found) return found
  }

  return undefined
}

// macOS refuses to launch a terminal binary straight from a CLI, so the app bundle is opened
// instead; on Linux the binary takes the same flags directly.
function launchApp(app: string, flags: string[], platform: string): Spawn {
  return platform === 'darwin'
    ? { command: 'open', args: ['-na', `${app}.app`, '--args', ...flags] }
    : { command: app.toLowerCase(), args: flags }
}

// A window that vanishes the moment Claude exits takes the session's last words with it, so
// the shell stays behind in the same directory.
function keepOpen(script: string, shell: string): string {
  return `${script}; exec ${shell}`
}

export function newWindowFor(dir: string, script: string, env: NodeJS.ProcessEnv = process.env): Spawn | null {
  // -e and its equivalents exec the command directly rather than through a login shell, so
  // nothing from your profile is on PATH — and Claude itself shells out to gh, node and git.
  const shell = env.SHELL || '/bin/zsh'
  const command = keepOpen(script, shell)
  const platform = process.platform

  // An escape hatch for terminals nobody has taught this file about, and for anyone who
  // wants a split rather than a window. {dir} and {cmd} arrive quoted.
  const template = env.FLIGHT_DECK_TERMINAL?.trim()

  if (template) {
    const filled = template.replaceAll('{dir}', shellQuote(dir)).replaceAll('{cmd}', shellQuote(command))

    return { command: '/bin/sh', args: ['-c', filled] }
  }

  // Inside tmux nothing needs a new OS window, and a new tmux window keeps the panel one
  // key away rather than behind another application.
  if (env.TMUX) return { command: 'tmux', args: ['new-window', '-c', dir, shell, '-lc', command] }

  switch (terminalOf(env)) {
    case 'ghostty':
      return launchApp('Ghostty', [`--working-directory=${dir}`, '-e', shell, '-lc', command], platform)

    case 'alacritty':
      return launchApp('Alacritty', ['--working-directory', dir, '-e', shell, '-lc', command], platform)

    // wezterm and kitty can talk to the instance already running, so they get a real window
    // rather than a second copy of the application.
    case 'wezterm':
      return { command: 'wezterm', args: ['cli', 'spawn', '--new-window', '--cwd', dir, '--', shell, '-lc', command] }

    case 'kitty':
      return { command: 'kitty', args: ['@', 'launch', '--type=os-window', '--cwd', dir, shell, '-lc', command] }

    case 'iterm': {
      const inner = `cd ${shellQuote(dir)} && ${command}`

      return {
        command: 'osascript',
        args: [
          '-e',
          `tell application "iTerm" to create window with default profile command ${appleScriptQuote(
            `${shell} -lc ${shellQuote(inner)}`,
          )}`,
        ],
      }
    }

    case 'terminal': {
      const inner = `cd ${shellQuote(dir)} && ${command}`

      return {
        command: 'osascript',
        args: [
          '-e',
          `tell application "Terminal" to do script ${appleScriptQuote(inner)}`,
          '-e',
          'tell application "Terminal" to activate',
        ],
      }
    }

    default:
      return null
  }
}
