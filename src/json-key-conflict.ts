import { Result } from 'neverthrow'

import {
  AFTER_MARKER,
  BASE_MARKER,
  BEFORE_MARKER,
  forEachConflictBlock,
  SEP_MARKER,
} from '#conflict-block'

// Parses a single conflict-block line, already comma-stripped by the caller
// (parseKeyLines), as a one-key JSON object fragment (e.g.
// `  "foo": "1.0.0"` -> { foo: "1.0.0" }), so keys can be matched across
// before/base/after independently of line position. Multi-line values
// (nested objects/arrays spanning several lines) fail to parse this way and
// correctly fall through to leaving the block untouched.
const parseLineAsEntry = Result.fromThrowable(
  (line: string) => JSON.parse(`{${line}}`) as unknown,
  () => null,
)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
    )
  }
  return false
}

interface LineEntry {
  line: string
  value: unknown
}

// Returns null (block ineligible) unless every line is a standalone
// `"key": value[,]` fragment — the shape a prettier-formatted flat JSON
// object (package.json dependencies, scripts, ...) produces one property
// per line.
function parseKeyLines(lines: string[]): Map<string, LineEntry> | null {
  const map = new Map<string, LineEntry>()
  for (const line of lines) {
    const trimmed = line.trim()
    const withoutTrailingComma = trimmed.endsWith(',')
      ? trimmed.slice(0, -1)
      : trimmed
    const parsed = parseLineAsEntry(withoutTrailingComma)
    if (parsed.isErr()) return null
    const entry = parsed.value
    if (!isPlainObject(entry)) return null
    const keys = Object.keys(entry)
    const key = keys[0]
    if (keys.length !== 1 || key === undefined) return null
    map.set(key, { line, value: entry[key] })
  }
  return map
}

function entriesEqual(
  a: LineEntry | undefined,
  b: LineEntry | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b
  return deepEqual(a.value, b.value)
}

// ponytail: after-only keys are appended at the end rather than at their
// true relative position in `after`; upgrade to a proper LCS-based key-order
// merge (like resolveBlockLines's diffArrays approach) if template-inserted
// keys ever need to land at a specific position instead of the end.
function orderedKeys(
  beforeMap: Map<string, LineEntry>,
  afterMap: Map<string, LineEntry>,
): string[] {
  const keys = [...beforeMap.keys()]
  const seen = new Set(keys)
  for (const key of afterMap.keys()) {
    if (!seen.has(key)) {
      keys.push(key)
      seen.add(key)
    }
  }
  return keys
}

type KeyResolution =
  { kind: 'keep'; line: string } | { kind: 'omit' } | { kind: 'conflict' }

function resolveKey(
  base: LineEntry | undefined,
  before: LineEntry | undefined,
  after: LineEntry | undefined,
): KeyResolution {
  if (entriesEqual(before, after)) {
    return before !== undefined
      ? { kind: 'keep', line: before.line }
      : { kind: 'omit' }
  }
  if (entriesEqual(base, before)) {
    return after !== undefined
      ? { kind: 'keep', line: after.line }
      : { kind: 'omit' }
  }
  if (entriesEqual(base, after)) {
    return before !== undefined
      ? { kind: 'keep', line: before.line }
      : { kind: 'omit' }
  }
  return { kind: 'conflict' }
}

// Kept lines always get their comma forced on push (see the 'keep' branch
// below); only the last line of a fully-resolved block gets its comma
// corrected against what follows the block in the file, stripped if the
// block is immediately followed by an object/array close.
function endsEnclosure(nextLine: string | undefined): boolean {
  if (nextLine === undefined) return true
  const trimmed = nextLine.trim()
  return trimmed.startsWith('}') || trimmed.startsWith(']')
}

function withTrailingComma(line: string, want: boolean): string {
  const stripped = line.replace(/,\s*$/, '')
  return want ? `${stripped},` : stripped
}

function resolveBlock(
  before: string[],
  base: string[],
  after: string[],
  nextLine: string | undefined,
): string[] | null {
  const beforeMap = parseKeyLines(before)
  if (beforeMap === null) return null
  const baseMap = parseKeyLines(base)
  if (baseMap === null) return null
  const afterMap = parseKeyLines(after)
  if (afterMap === null) return null

  const output: string[] = []
  let hasConflict = false
  for (const key of orderedKeys(beforeMap, afterMap)) {
    const beforeEntry = beforeMap.get(key)
    const baseEntry = baseMap.get(key)
    const afterEntry = afterMap.get(key)
    const resolution = resolveKey(baseEntry, beforeEntry, afterEntry)

    if (resolution.kind === 'keep') {
      output.push(withTrailingComma(resolution.line, true))
    } else if (resolution.kind === 'conflict') {
      hasConflict = true
      output.push(BEFORE_MARKER)
      if (beforeEntry !== undefined) output.push(beforeEntry.line)
      output.push(BASE_MARKER)
      if (baseEntry !== undefined) output.push(baseEntry.line)
      output.push(SEP_MARKER)
      if (afterEntry !== undefined) output.push(afterEntry.line)
      output.push(AFTER_MARKER)
    }
  }

  const lastIndex = output.length - 1
  const lastLine = output[lastIndex]
  if (!hasConflict && lastLine !== undefined) {
    output[lastIndex] = withTrailingComma(lastLine, !endsEnclosure(nextLine))
  }

  return output
}

/**
 * Resolves leftover mergiraf conflict blocks that are flat JSON
 * `"key": value` maps (package.json dependencies, scripts, ...) by merging
 * key-by-key: a key changed on only one side (added, removed, or modified)
 * is adopted from that side; a key changed differently on both sides is
 * left as its own isolated marker block. Blocks whose lines aren't
 * standalone single-key JSON fragments (non-JSON files, multi-line nested
 * values) are left untouched.
 */
export function resolveJsonKeyConflicts(content: string): string {
  return forEachConflictBlock(content, (block, nextLine) =>
    resolveBlock(block.before, block.base, block.after, nextLine),
  )
}
