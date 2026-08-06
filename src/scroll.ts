// Which entry the panel starts drawing from. Rows vary in height, so this works in lines
// rather than in indices: keep the selection on screen, and fill whatever room is left.
export function scrollOffset(heights: number[], target: number, budget: number, previous: number): number {
  let offset = Math.min(previous, target)
  let used = 0

  for (let i = offset; i <= target; i++) used += heights[i] ?? 0

  // Down far enough for the selection to fit.
  while (used > budget && offset < target) {
    used -= heights[offset] ?? 0
    offset++
  }

  // Then back up while there is still room. Without this, a selection that resets to the top
  // of a shorter list — switching tabs while scrolled — strands the section header off screen
  // with empty space below it.
  while (offset > 0 && used + (heights[offset - 1] ?? 0) <= budget) {
    offset--
    used += heights[offset] ?? 0
  }

  return offset
}
