# Flight Deck

A narrow terminal panel showing the work you have in flight: your open GitHub PRs (drafts included) with CI state, PRs waiting on your review, and — if you use Linear — the issues assigned to you. Refreshes every 30 seconds, and hides anything nothing has happened to in four weeks — both adjustable.

```
  IN FLIGHT  [ALL] GITHUB  LINEAR     10:28 ⟳
  ───────────────────────────────────────────

  YOURS                                     6

❯ ✓  #387  refactor(mcp): rename fire_action…
     sanity-io/workflows                  17h

  ✗  #71   feat: implemented a basic config …
     sanity-labs/bernoulli         ⚠ conf 24w

  REVIEWS                                   2

  ✓  #338  docs: improve changeset release n…
     workflows · @snorrees                 1w

  ↑↓ move ⏎ open r refresh q quit
  ←→ view  s settings  c claude
```

## Install

```sh
npm install -g flight-deck
flightdeck
```

Needs Node 20+ and the [`gh` CLI](https://cli.github.com), authenticated (`gh auth login`). Auth is reused from `gh`, so there is no GitHub token to configure. Linear is optional and set up from inside the panel.

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

The panel runs on the terminal's alternate screen, so quitting restores whatever was there before, and the layout follows the window as you resize it. `flightdeck --once` prints a single frame and exits, for scripting or a quick look. `COLUMNS` pins the panel to a fixed width.

## Settings

`s` opens them in the panel. `↑` `↓` pick one, `←` `→` change it, and each change is saved as you make it:

```
  SETTINGS

❯ stale     4w
    Hide work untouched for longer.

  refresh   30s
    How often the panel refetches.

  ↑↓ move  ←→ change  esc done
```

| Setting   | Default | What it does                                                                       |
| --------- | ------- | ---------------------------------------------------------------------------------- |
| `stale`   | `4w`    | Hides PRs and issues nothing has happened to in this long. `off` shows everything. |
| `refresh` | `30s`   | How often the panel refetches.                                                     |

Stale counts from the last activity, not from when the work was opened — a PR from March you rebased this morning stays. Anything it hides is counted on the empty panel, so a filter that hides everything doesn't look like a broken one.

The arrows step through sensible values; anything else goes in from a script or a dotfile, alongside the Linear key in the same `config.json`:

```sh
flightdeck config              # show both, and where they live
flightdeck config stale 10d    # 4w, 10d, 48h … or off
flightdeck config refresh 60   # whole seconds
```

Both places warn below 10 seconds: GitHub and Linear will rate limit you, and the panel is only as useful as the API it can still reach.

## Linear

Optional, and the panel asks for it rather than expecting you to have read this: the `LINEAR` tab is there from the start, and arriving on it offers to connect. `⏎` takes it up, and `L` does the same from anywhere.

```
  CONNECT LINEAR

  Opened linear.app/settings/api
  Create a key there and paste it below.

  key ▏

  ⏎ connect  esc cancel
```

The page it opens is [linear.app/settings/api](https://linear.app/settings/api), and the key you paste back is checked with Linear before it's saved — one that doesn't work says so while you still have the screen open, and one that works says whose it is. `ISSUES` appears on the next refresh:

```
  ISSUES                                    4

  ◐  ENG-412   Fix flaky auth redirect
     In Progress                           2h

  ◐  PROJ-1234 Spike: streaming parser
     In Review                          P1 1d

  ○  ENG-431   Add retry to webhook sender
     Todo                               P2 3h
```

It lists the issues assigned to you that are started or up next — started states first, then Todo, each by recency.

The key is stored in `~/.config/flight-deck/config.json`, `0600`. That rather than a `.env`, because the installed binary runs from wherever you happen to be standing, and a file in the current directory is only found by accident. The same thing without the panel:

```sh
flightdeck linear <key>        # verify and store
pbpaste | flightdeck linear -  # … without it landing in shell history
flightdeck linear              # connected? as whom? from where?
flightdeck linear --logout     # forget it
```

`LINEAR_API_KEY` still wins over the stored key, whether exported or in a `.env` in the directory you run from. A personal key acts as you: `--logout` forgets it here, revoking it is done at Linear. It's the whole of the sign-in, since Linear has no `gh`-style CLI to borrow auth from and no OAuth flow a CLI can run without a client secret to hide in it.

### Linked work

Linear's GitHub integration files a PR as an attachment on its issue, so Flight Deck can match the two by exact URL — no branch-name guessing. When a PR has an issue, its row gains a line with the issue's state and priority:

```
  ✗  #2586     feat(ada): cmd+k search funct…
     sanity-io/ada           DRAFT ⚠ conf 29w
     ○ SDK-1518 Backlog
```

The lookup isn't scoped to issues assigned to you, so a PR you're only reviewing finds its issue too. `l` opens the Linear side of the selected row, `g` the GitHub side; `⏎` opens whichever tool the row itself belongs to.

### Views

`←` and `→` cycle three views: everything, GitHub only, Linear only. All three sit in the header with the current one bracketed, and below 44 columns they move to a line of their own so they don't collide with the clock:

```
  IN FLIGHT                     10:28 ⟳
   ALL  GITHUB [LINEAR]
  ─────────────────────────────────────
```

`LINEAR` is shown whether or not there's a key behind it — an empty tab you can land on is how anyone finds out the panel does Linear at all.

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

The remote rather than the directory name, because on this machine `~/Projects/brighton-listings` is `alexjmold/giggull` and matching by name would quietly miss it. And the `cwd` from inside the transcript rather than the directory name under `projects/`, because those are slugified paths: lossy, and stale the moment you rename a directory.

`FLIGHT_DECK_REPO_ROOT` adds a directory of checkouts to scan the same way, covering repositories you've never opened Claude Code in. Anything found there ranks below the history.

### The window

The panel is already running inside your terminal, and the terminal says which one it is, so `c` opens a window of the same one you're in. Inside tmux it opens a tmux window instead, which keeps the panel a key away rather than behind another application.

WezTerm, kitty, iTerm2 and Terminal.app can all be told to open a window in the instance already running, and do. Ghostty and Alacritty are a wrinkle: macOS won't launch a terminal binary from a CLI, so they go through their app bundle, which starts a second instance rather than another window.

Warp, VS Code's integrated terminal, an ssh session, anything unrecognised — none of these can run a command in a new window, so the panel steps aside instead: it unmounts, hands the terminal to Claude, and comes back when you quit. The only thing lost is which row was selected.

`FLIGHT_DECK_TERMINAL` overrides all of it with a template, for a terminal this doesn't know or for a split rather than a window. `{dir}` and `{cmd}` are substituted, already quoted:

```sh
export FLIGHT_DECK_TERMINAL='wezterm cli split-pane --cwd {dir} -- zsh -lc {cmd}'
```

`claude --from-pr <url>` reopens the session already attached to that PR, which knows far more than any prompt could carry. It isn't the default, because when no such session exists it doesn't fail — it opens an empty resume picker and waits, which is a worse place to land than a fresh session. Set `FLIGHT_DECK_FROM_PR=1` if you'd rather have it.

## Indicators

PRs: `✓` CI passing · `✗` failing · `⠋` running · `·` no checks · `⚠ conf` merge conflict · `DRAFT` · `APPROVED` · `CHANGES` requested

Issues: `◐` started · `○` todo · `P1` urgent · `P2` high

Running CI spins. That's what separates it from a started Linear issue, which is a static `◐` and can appear on the same row — motion means something is happening right now. The panel only animates while a check is actually in flight.

## Development

```sh
npm install
npm run dev    # run from source
npm test       # quoting, repo matching, scrolling, terminal detection, config
npm run build  # compile to dist/, then: node dist/cli.js
```

### Screenshots

`npm run demo` runs the panel on made-up work: the same render path, but nobody's real PRs in it and no network to wait for. `npm run frame` prints a single frame of it, ready to paste somewhere like [boron.sh](https://boron.sh):

```sh
npm run --silent frame | pbcopy
COLUMNS=40 npm run --silent frame   # the narrow layout, tabs on their own line
npm run demo                        # then s, or L, for the other screens
```

The rows live in `src/demo.ts`, and their ages are relative, so a frame taken next month reads the same as one taken today. `FLIGHT_DECK_DEMO=1` is what turns it on, if you'd rather run it another way.
