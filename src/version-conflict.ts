import { diffArrays } from 'diff'
import * as semver from 'semver'

const BEFORE_MARKER = '<<<<<<< before updating'
const BASE_MARKER = '||||||| last update'
const SEP_MARKER = '======='
const AFTER_MARKER = '>>>>>>> after updating'

// Matches version-like tokens (e.g. `2.0.0`, `v6.0.2`, `2026.6.11`). The
// segment count is unbounded so a longer dotted run (e.g. an IP address) is
// captured whole rather than silently truncated to its first 3 segments;
// MAX_SEGMENTS_RE below then rejects anything semver.coerce can't represent
// faithfully instead of comparing a truncated prefix.
const VERSION_TOKEN_RE = /v?\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.]+)?/g
const MAX_SEGMENTS_RE = /^v?\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.]+)?$/

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

interface ParsedBlock {
  before: string[]
  base: string[]
  after: string[]
  nextIndex: number
}

function readBlock(lines: string[], start: number): ParsedBlock | null {
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

function extractSingleVersion(line: string): string | null {
  const matches = line.match(VERSION_TOKEN_RE)
  if (matches === null || matches.length !== 1) return null
  const token = matches[0]
  if (!MAX_SEGMENTS_RE.test(token)) return null
  // includePrerelease so a prerelease tag (e.g. `2.0.0-rc.1`) doesn't coerce
  // down to the same value as its stable counterpart (`2.0.0`) and get
  // treated as an equal, tie-broken-to-after version.
  const coerced = semver.coerce(token, { includePrerelease: true })
  return coerced === null ? null : coerced.version
}

/**
 * Picks whichever whole line embeds the semantically newer version, so a
 * winning line's unrelated content (e.g. a SHA pin next to a version
 * comment) travels with it instead of being reconstructed field-by-field.
 * Returns null when either side isn't a single unambiguous version.
 */
function pickNewerLine(before: string, after: string): string | null {
  const beforeVersion = extractSingleVersion(before)
  const afterVersion = extractSingleVersion(after)
  if (beforeVersion === null || afterVersion === null) return null
  return semver.gt(beforeVersion, afterVersion) ? before : after
}

function resolveBlockLines(
  before: string[],
  base: string[],
  after: string[],
): string[] {
  const parts = diffArrays(before, after)
  const output: string[] = []
  let i = 0
  while (i < parts.length) {
    const part = parts[i]
    if (part === undefined) break

    if (!part.added && !part.removed) {
      output.push(...part.value)
      i++
      continue
    }

    const next = parts[i + 1]
    let removedLines: string[]
    let addedLines: string[]
    let consumed: number
    if (part.removed && next?.added === true) {
      removedLines = part.value
      addedLines = next.value
      consumed = 2
    } else if (part.added && next?.removed === true) {
      addedLines = part.value
      removedLines = next.value
      consumed = 2
    } else if (part.removed) {
      removedLines = part.value
      addedLines = []
      consumed = 1
    } else {
      addedLines = part.value
      removedLines = []
      consumed = 1
    }

    // Resolution is restricted to a single removed line paired with a single
    // added line. A multi-line replaced run has no reliable way to tell
    // "these lines are the same field, reordered" from "these are different
    // fields that happen to occupy the same positions" without a common
    // anchor line, and guessing the wrong pairing could silently swap in the
    // wrong value for an unrelated field.
    const removedLine = removedLines.length === 1 ? removedLines[0] : undefined
    const addedLine = addedLines.length === 1 ? addedLines[0] : undefined
    const resolvedLine =
      removedLine !== undefined && addedLine !== undefined
        ? pickNewerLine(removedLine, addedLine)
        : null

    if (resolvedLine !== null) {
      output.push(resolvedLine)
    } else {
      // The unresolved slice reuses the whole original `base` section since
      // the diff against `before`/`after` doesn't track which base lines
      // correspond to it; this may repeat base content across multiple
      // unresolved slices of the same block but never drops data.
      output.push(
        BEFORE_MARKER,
        ...removedLines,
        BASE_MARKER,
        ...base,
        SEP_MARKER,
        ...addedLines,
        AFTER_MARKER,
      )
    }
    i += consumed
  }
  return output
}

/**
 * Resolves leftover mergiraf conflict blocks whose `before updating` /
 * `after updating` sides differ only by a comparable version, adopting
 * whichever side is semantically newer. Lines that aren't a clean
 * version-only change (unparseable values, ambiguous multi-version lines,
 * or lines with no counterpart on the other side) are left conflicted.
 */
export function resolveVersionConflicts(content: string): string {
  // mergiraf always emits LF, but the file it operates on may still be CRLF
  // (e.g. checked out with core.autocrlf or a CRLF gitattributes rule).
  // Splitting on '\n' alone would leave a trailing '\r' on every line,
  // so BEFORE_MARKER and friends would never match.
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
    output.push(...resolveBlockLines(block.before, block.base, block.after))
    i = block.nextIndex
  }
  const resolved = output.join('\n')
  return hasCrlf ? resolved.replace(/\n/g, '\r\n') : resolved
}
