// PR titles and the prompts built from them are text we do not control, and they end up
// inside a shell command string — and for the AppleScript terminals, inside a second layer
// of quoting on top of that. Every string built that way goes through here. Anywhere an
// argv array will do, use one instead and skip this file entirely.

// Single quotes take everything literally, so the only character needing care is the quote
// itself: close, escape one, reopen.
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

// An AppleScript string literal is double-quoted and understands backslash escapes.
// Backslashes go first, or we would escape the ones we just added.
export function appleScriptQuote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
