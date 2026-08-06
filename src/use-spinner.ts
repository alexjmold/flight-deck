import { useEffect, useState } from 'react'

import { spinnerFrames } from './theme.js'

const FRAME_MS = 80

export function useSpinner(isActive: boolean): string {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!isActive) return

    const timer = setInterval(() => setFrame((current) => (current + 1) % spinnerFrames.length), FRAME_MS)

    return () => clearInterval(timer)
  }, [isActive])

  return spinnerFrames[frame] ?? ''
}
