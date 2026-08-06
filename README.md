# Flight Deck

A narrow terminal panel showing the work you have in flight: your open GitHub PRs (drafts included) with CI state, PRs waiting on your review, and — if you use Linear — the issues assigned to you. Refreshes every 30 seconds.

```
  IN FLIGHT                         10:28 ⟳
  ─────────────────────────────────────────

  YOURS                                   6

❯ ✓  #387  refactor(mcp): rename fire_acti…
     sanity-io/workflows                17h

  ✗  #71   feat: implemented a basic confi…
     sanity-labs/bernoulli       ⚠ conf 24w

  REVIEWS                                 2

  ✓  #338  docs: improve changeset release…
     workflows · @snorrees               1w

  ↑↓ move ⏎ open r refresh q quit
```

## Requirements

The [`gh` CLI](https://cli.github.com), authenticated (`gh auth login`). Auth is reused from `gh` — there is no token to configure.

## Linear

Optional, and the panel asks for it rather than expecting you to have read this: the `LINEAR` tab is there from the start, and arriving on it offers to connect — `⏎` takes it up. `L` does the same from anywhere.

That opens [linear.app/settings/api](https://linear.app/settings/api), takes the pasted key, and checks it with Linear before saving — a key that doesn't work says so while you still have the tab open, and a key that works says whose it is. `ISSUES` appears on the next refresh.

The key is stored in `~/.config/flight-deck/config.json`, `0600`. That rather than a `.env`, because the installed binary runs from wherever you happen to be standing, and a file in the current directory is only found by accident.

From a script or a dotfile, the same thing without the panel:

```sh
flightdeck linear <key>        # verify and store
pbpaste | flightdeck linear -  # … without it landing in shell history
flightdeck linear              # connected? as whom? from where?
flightdeck linear --logout     # forget it
```

`LINEAR_API_KEY` still wins over the stored key, whether exported or in a `.env` in the directory you run from. A personal key acts as you: `--logout` forgets it here, revoking it is done at Linear.

```
  ISSUES                                  4

  ◐  ENG-412    Fix flaky auth redirect
     In Progress                        2h

  ◐  PROJ-1234  Spike: streaming parser
     In Review                       P1 1d

  ○  ENG-431    Add retry to webhook sender
     Todo                            P2 3h
```

It lists the issues assigned to you that are started or up next — started states first, then Todo, each by recency. Linear has no `gh`-style CLI to borrow auth from, and no OAuth flow a CLI can run without a client secret to hide in it, so a personal key is the whole of the sign-in.

The two sources are fetched independently. If one is down the other still renders, with the reason on a line above the key hints.

### Linked work

Linear's GitHub integration files a PR as an attachment on its issue, so Flight Deck can match the two by exact URL — no branch-name guessing. When a PR has an issue, its row gains a line with the issue's state and priority:

```
  ✗  #2586     feat(ada): cmd+k search functio…
     sanity-io/ada             DRAFT ⚠ conf 29w
     ○ SDK-1518 Backlog
```

The lookup isn't scoped to issues assigned to you, so a PR you're only reviewing finds its issue too. `l` opens the Linear side of the selected row, `g` the GitHub side; `⏎` opens whichever tool the row itself belongs to.

### Views

`←` and `→` cycle three views: everything, GitHub only, Linear only. All three sit in the header with the current one bracketed:

```
  IN FLIGHT  [ALL] GITHUB  LINEAR       12:42 ⟳
  ─────────────────────────────────────────────
```

Each tab reserves a column either side for its brackets, so the labels stay put as you move between views.

Below 44 columns they move to a line of their own so they don't collide with the clock. The `LINEAR` tab is shown whether or not there's a key behind it — an empty tab you can land on is how anyone finds out the panel does Linear at all.

## Claude Code

Every row is a piece of work with an obvious next move. `c` makes it — a Claude Code session in that repository's checkout, in a new terminal window, opened with a prompt shaped by what the row is actually telling you:

| Row                    | Prompt                               |
| ---------------------- | ------------------------------------ |
| Failing CI             | Work out why it's failing and fix it |
| Merge conflict         | Resolve them                         |
| Changes requested      | Address the review feedback          |
| Anything else of yours | Pick up where we left off            |
| Waiting on your review | `/review <url>`                      |

The key is only offered when there is somewhere to go — a row whose repository isn't checked out on this machine doesn't show `c` and doesn't respond to it.

### Finding your checkouts

It asks Claude Code. Every session records the directory it ran in, so the repositories you work in are already written down in `~/.claude/projects`; the panel reads the `cwd` out of each transcript and matches it to a PR by the checkout's `origin` remote.

The remote, not the directory name — on this machine `~/Projects/brighton-listings` is `alexjmold/giggull`, and matching by name would quietly miss it. And the `cwd` from inside the transcript rather than the directory name under `projects/`: those are slugified paths, which are lossy and go stale the moment you rename a directory.

Set `FLIGHT_DECK_REPO_ROOT` to a directory of checkouts to have them scanned the same way, by remote. That covers repositories you've never opened Claude Code in. Anything found there ranks below the history, so a repository you have actually worked in always wins.

### The window

The panel is already running inside your terminal, and the terminal says which one it is, so `c` opens a window of the same one you're in. Inside tmux it opens a tmux window instead, which keeps the panel a key away rather than behind another application.

Ghostty and Alacritty are a wrinkle: macOS won't launch a terminal binary from a CLI, so they have to be opened through their app bundle, and that starts a second instance of the application rather than another window of the one you're in. WezTerm, kitty, iTerm2 and Terminal.app can all be told to open a window in the instance already running, and do.

Warp, VS Code's integrated terminal, an ssh session, anything unrecognised — none of these can run a command in a new window, so the panel steps aside instead: it unmounts, hands the terminal to Claude, and comes back when you quit. The only thing lost is which row was selected.

`FLIGHT_DECK_TERMINAL` overrides all of it with a template, for a terminal this doesn't know or for a split rather than a window. `{dir}` and `{cmd}` are substituted, already quoted:

```sh
export FLIGHT_DECK_TERMINAL='wezterm cli split-pane --cwd {dir} -- zsh -lc {cmd}'
```

### Resuming instead

`claude --from-pr <url>` reopens the session already attached to that PR, which knows far more than any prompt could carry. It isn't the default, because when no such session exists it doesn't fail — it opens an empty resume picker and waits, which is a worse place to land than a fresh session. Set `FLIGHT_DECK_FROM_PR=1` if you'd rather have it.

## Usage

```sh
npm install
npm run dev          # run from source
npm run build        # compile to dist/
npm test             # quoting, repo matching, terminal detection, config
node dist/cli.js
```

`--once` prints a single frame and exits.

The panel runs on the terminal's alternate screen, so quitting restores whatever was there before. The layout follows the window as you resize it.

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
| `r`               | Refresh now                         |
| `q`               | Quit                                |

## Indicators

PRs: `✓` CI passing · `✗` failing · `⠋` running · `·` no checks · `⚠ conf` merge conflict · `DRAFT` · `APPROVED` · `CHANGES` requested

Issues: `◐` started · `○` todo · `P1` urgent · `P2` high

Running CI spins. That's what separates it from a started Linear issue, which is a static `◐` and can appear on the same row — motion means something is happening right now. The panel only animates while a check is actually in flight.

Set `COLUMNS` to pin the panel to a fixed width regardless of terminal size.
