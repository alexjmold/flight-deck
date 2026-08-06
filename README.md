# Flight Deck

A narrow terminal panel for the work you have in flight: your open GitHub PRs with CI state, PRs waiting on your review, and your Linear issues. Refreshes every 30 seconds.

![The panel in a terminal window: open pull requests with CI state, pull requests waiting on review, and assigned Linear issues](https://raw.githubusercontent.com/alexjmold/flight-deck/main/docs/all-view.png)

## Install

```sh
npm install -g flight-deck
flightdeck
```

Needs Node 20+ and the [`gh` CLI](https://cli.github.com), signed in with `gh auth login`. Auth is reused from `gh`, so there is no GitHub token to configure. Linear is optional and set up from inside the panel.

## Keys

| Key               | Action                              |
| ----------------- | ----------------------------------- |
| `↑` `↓` / `k` `j` | Move selection                      |
| `←` `→`           | Switch view (all / GitHub / Linear) |
| `⏎`               | Open it in your browser             |
| `g`               | Open the GitHub side of the row     |
| `l`               | Open the Linear side of the row     |
| `L`               | Connect Linear, or replace the key  |
| `c`               | Work on it in Claude Code           |
| `s`               | Settings                            |
| `r`               | Refresh now                         |
| `q`               | Quit                                |

The panel runs on the terminal's alternate screen, so quitting restores whatever was there before. `flightdeck --once` prints a single frame and exits.

## Reading a row

PRs: `✓` CI passing · `✗` failing · `⠋` running · `·` no checks · `⚠ conf` merge conflict · `DRAFT` · `APPROVED` · `CHANGES` requested

Issues: `◐` started · `○` todo · `P1` urgent · `P2` high

Only running CI animates, so motion always means something is happening right now.

A PR that Linear knows about gains a third line with its issue's state and priority. The match is by exact URL, taken from Linear's GitHub integration rather than guessed from a branch name, so a PR you are only reviewing finds its issue too.

## Linear

Optional. The `LINEAR` tab is there from the start, landing on it offers to connect, and `L` does the same from anywhere.

![The connect screen: the key page already opened, and a masked key being pasted in](https://raw.githubusercontent.com/alexjmold/flight-deck/main/docs/linear-key-view.png)

The key is checked with Linear before it is saved, and stored `0600` in `~/.config/flight-deck/config.json`. Your started and up next issues appear on the following refresh.

The same thing without the panel:

```sh
flightdeck linear <key>        # verify and store
pbpaste | flightdeck linear -  # ... without it landing in shell history
flightdeck linear              # connected? as whom? from where?
flightdeck linear --logout     # forget it
```

`LINEAR_API_KEY` wins over the stored key. A personal key acts as you: `--logout` forgets it here, revoking it is done at Linear.

## Settings

`s` opens them in the panel. `↑` `↓` pick one, `←` `→` change it, and each change is saved as you make it.

![The settings screen: stale and refresh, each with a note under it](https://raw.githubusercontent.com/alexjmold/flight-deck/main/docs/settings-view.png)

| Setting   | Default | What it does                                                             |
| --------- | ------- | ------------------------------------------------------------------------ |
| `stale`   | `4w`    | Hides work nothing has happened to in this long. `off` shows everything. |
| `refresh` | `30s`   | How often the panel refetches.                                           |

Stale counts from the last activity, not from when the work was opened, so a PR from March you rebased this morning stays.

The arrows step through sensible values. Anything else goes in from a script or a dotfile:

```sh
flightdeck config              # show both, and where they live
flightdeck config stale 10d    # 4w, 10d, 48h ... or off
flightdeck config refresh 60   # whole seconds
```

Both places warn below 10 seconds, where GitHub and Linear start rate limiting you.

## Claude Code

`c` opens a Claude Code session in that row's repository, in a new terminal window, with a prompt shaped by what the row is telling you:

| Row                    | Prompt                               |
| ---------------------- | ------------------------------------ |
| Failing CI             | Work out why it's failing and fix it |
| Merge conflict         | Resolve them                         |
| Changes requested      | Address the review feedback          |
| Anything else of yours | Pick up where we left off            |
| Waiting on your review | `/review <url>`                      |

The key is only offered when the repository is checked out on this machine.

**Finding your checkouts.** Every Claude Code session records the directory it ran in, so the panel reads the `cwd` out of each transcript in `~/.claude/projects` and matches it to a PR by the checkout's `origin` remote. Matching on the remote rather than the directory name means `~/Projects/brighton-listings` still finds `alexjmold/giggull`. `FLIGHT_DECK_REPO_ROOT` adds a directory of checkouts to scan, ranked below the history.

**The window.** WezTerm, kitty, iTerm2 and Terminal.app open another window of the instance you are already in. Ghostty and Alacritty start a second instance, because macOS won't launch a terminal binary from a CLI. Inside tmux it opens a tmux window. Warp, VS Code, ssh and anything unrecognised get the panel stepping aside instead: it unmounts, hands the terminal to Claude, and comes back when you quit.

`FLIGHT_DECK_TERMINAL` overrides all of it with a template, for a terminal this doesn't know or for a split rather than a window. `{dir}` and `{cmd}` are substituted, already quoted:

```sh
export FLIGHT_DECK_TERMINAL='wezterm cli split-pane --cwd {dir} -- zsh -lc {cmd}'
```

`FLIGHT_DECK_FROM_PR=1` switches to `claude --from-pr <url>`, which reopens the session already attached to that PR. It isn't the default because with no such session it opens an empty resume picker and waits.

## Development

```sh
npm install
npm run dev    # run from source
npm test       # quoting, repo matching, scrolling, terminal detection, config
npm run build  # compile to dist/, then: node dist/cli.js
```

`npm run demo` runs the panel on made-up work: the same render path, no network, and nobody's real PRs in it. Add `--once` for a single frame to paste somewhere like [boron.sh](https://boron.sh):

```sh
npm run demo                                                  # s or L for the other screens
COLUMNS=64 LINES=40 npm run --silent demo -- --once | pbcopy
```

Piped output has no terminal to measure, so set `COLUMNS` and `LINES` yourself. The rows live in `src/demo.ts` and their ages are relative, so a frame taken next month reads the same as one taken today.
