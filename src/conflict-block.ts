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

// Shared scan for callers that resolve each `<<<<<<< before updating` ...
// `>>>>>>> after updating` block independently: walks the file line by line,
// hands each parsed block (plus the line immediately following it) to
// `resolve`, and splices in its return value — or, when `resolve` returns
// null (block left unresolved) or the block fails to parse, the original
// marker text verbatim. Also normalizes CRLF to LF for the scan and restores
// it on output, since mergiraf always emits LF but the source file may be
// CRLF.
export function forEachConflictBlock(
  content: string,
  resolve: (
    block: ParsedBlock,
    nextLine: string | undefined,
  ) => string[] | null,
): string {
  const hasCrlf = content.includes('\r\n')
  const normalized = hasCrlf ? content.replace(/\r\n/g, '\n') : content

  const lines = normalized.split('\n')
  const output: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line === undefined) break
    if (line !== BEFORE_MARKER) {
      output.push(line)
      i++
      continue
    }
    const block = readBlock(lines, i)
    if (block === null) {
      output.push(line)
      i++
      continue
    }
    output.push(
      ...(resolve(block, lines[block.nextIndex]) ?? [
        BEFORE_MARKER,
        ...block.before,
        BASE_MARKER,
        ...block.base,
        SEP_MARKER,
        ...block.after,
        AFTER_MARKER,
      ]),
    )
    i = block.nextIndex
  }
  const resolved = output.join('\n')
  return hasCrlf ? resolved.replace(/\n/g, '\r\n') : resolved
}
