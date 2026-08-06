import { useStdout } from 'ink'
import { useEffect, useState } from 'react'

import { CLEAR_SCREEN } from './screen'

export type TerminalSize = {
  width: number
  rows: number
}

// COLUMNS/LINES win so the panel can be pinned to a fixed size.
function measure(stdout: NodeJS.WriteStream | undefined): TerminalSize {
  return {
    width: Number(process.env.COLUMNS) || stdout?.columns || 80,
    rows: Number(process.env.LINES) || stdout?.rows || 30,
  }
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout()
  const [size, setSize] = useState(() => measure(stdout))

  useEffect(() => {
    if (!stdout) return

    // Ink re-lays out on resize but doesn't re-render React, so we track it ourselves.
    // It also redraws with the old dimensions before our state lands, which can scroll a
    // too-tall frame into view — wipe the screen so only the corrected frame remains.
    const onResize = () => {
      if (stdout.isTTY) stdout.write(CLEAR_SCREEN)

      setSize(measure(stdout))
    }

    stdout.on('resize', onResize)

    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  return size
}
