import { useEffect, useState } from 'react'

import { knownRepos } from './claude/repos'

// Which repos exist on this machine, as owner/name. Resolved once, because the footer has to
// decide whether to offer `c` while it renders. Empty until it lands, which only means the
// hint appears a moment after the first frame.
export function useRepos(): Set<string> {
  const [repos, setRepos] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true

    void knownRepos().then((map) => {
      if (live) setRepos(new Set(map.keys()))
    })

    return () => {
      live = false
    }
  }, [])

  return repos
}
