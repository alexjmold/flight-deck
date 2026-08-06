import { spawn } from 'node:child_process'

export function openUrl(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'

  // Detached so the browser never holds the TUI's stdio open.
  const child = spawn(command, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' })

  child.on('error', () => {})
  child.unref()
}
