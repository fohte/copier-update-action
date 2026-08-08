export const BEFORE_MARKER = '<<<<<<< before updating'
export const BASE_MARKER = '||||||| last update'
export const SEP_MARKER = '======='
export const AFTER_MARKER = '>>>>>>> after updating'

interface TakeResult {
  taken: string[]
  nextIndex: number
}

function takeUntil(
  lines: string[],
  start: number,
  marker: string,
): TakeResult | null {
  const taken: string[] = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    if (line === undefined) break
    if (line === marker) {
      return { taken, nextIndex: i + 1 }
    }
    taken.push(line)
    i++
  }
  return null
}

export interface ParsedBlock {
  before: string[]
  base: string[]
  after: string[]
  nextIndex: number
}

export function readBlock(lines: string[], start: number): ParsedBlock | null {
  const before = takeUntil(lines, start + 1, BASE_MARKER)
  if (before === null) return null
  const base = takeUntil(lines, before.nextIndex, SEP_MARKER)
  if (base === null) return null
  const after = takeUntil(lines, base.nextIndex, AFTER_MARKER)
  if (after === null) return null
  return {
    before: before.taken,
    base: base.taken,
    after: after.taken,
    nextIndex: after.nextIndex,
  }
}
