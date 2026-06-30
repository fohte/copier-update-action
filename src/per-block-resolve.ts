import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import * as core from '@actions/core'

export interface Block {
  /** Start marker line (`<<<<<<< before updating`, 0-indexed) */
  startLine: number
  /** End marker line (`>>>>>>> ...`, 0-indexed, inclusive) */
  endLine: number
  /** Lines on the "before updating" side (= left side) */
  beforeLines: string[]
}

export interface ResolveResult {
  resolved: boolean
  resolvedCount: number
  skippedCount: number
}

export interface Solver {
  /**
   * Run the input text through `mergiraf solve` and return the resolved text,
   * or null on failure.
   *
   * `filename` (e.g. `package.json`, `Dockerfile`) is forwarded so mergiraf
   * can pick the right structured parser by extension or well-known name.
   */
  solve(input: string, filename: string): string | null
}

const START_MARKER = '<<<<<<< before updating'
const AFTER_MARKER = '======='

function isAncestorMarker(line: string): boolean {
  return line === '|||||||' || line.startsWith('||||||| ')
}

function isEndMarker(line: string): boolean {
  return line === '>>>>>>>' || line.startsWith('>>>>>>> ')
}

export function extractBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i] !== START_MARKER) {
      i++
      continue
    }
    const startLine = i
    let midLine = -1
    let afterLine = -1
    let endLine = -1
    let j = i + 1
    while (j < lines.length) {
      const line = lines[j]
      if (line === undefined || line === START_MARKER) break
      if (midLine === -1) {
        if (isAncestorMarker(line)) midLine = j
      } else if (afterLine === -1) {
        if (line === AFTER_MARKER) afterLine = j
      } else if (isEndMarker(line)) {
        endLine = j
        break
      }
      j++
    }
    if (midLine !== -1 && afterLine !== -1 && endLine !== -1) {
      const beforeLines = lines.slice(startLine + 1, midLine)
      blocks.push({ startLine, endLine, beforeLines })
      i = endLine + 1
    } else {
      i = startLine + 1
    }
  }
  return blocks
}

export function buildIsolatedInput(
  text: string,
  blocks: Block[],
  i: number,
): string {
  const lines = text.split('\n')
  for (let k = blocks.length - 1; k >= 0; k--) {
    if (k === i) continue
    const b = blocks[k]
    if (b === undefined) continue
    lines.splice(b.startLine, b.endLine - b.startLine + 1, ...b.beforeLines)
  }
  return lines.join('\n')
}

interface SolvedSegment {
  startLine: number
  endLine: number
  resolvedLines: string[]
}

function extractResolvedSegment(
  isolated: string,
  output: string,
  block: Block,
  precedingBlocks: Block[],
): string[] | null {
  const isolatedLines = isolated.split('\n')
  const outputLines = output.split('\n')
  let shift = 0
  for (const b of precedingBlocks) {
    shift += b.endLine - b.startLine + 1 - b.beforeLines.length
  }
  const blockStartInIsolated = block.startLine - shift
  const blockEndInIsolated = block.endLine - shift
  const suffixLen = isolatedLines.length - blockEndInIsolated - 1
  const sliceEnd = outputLines.length - suffixLen
  if (sliceEnd < blockStartInIsolated) return null
  // The math only holds if mergiraf leaves the surrounding context byte-identical.
  // If it normalizes trailing newlines or rewrites context lines, splicing the
  // diff would corrupt the file, so bail out and let the caller treat as skip.
  for (let k = 0; k < blockStartInIsolated; k++) {
    if (outputLines[k] !== isolatedLines[k]) return null
  }
  for (let k = 1; k <= suffixLen; k++) {
    if (
      outputLines[outputLines.length - k] !==
      isolatedLines[isolatedLines.length - k]
    ) {
      return null
    }
  }
  return outputLines.slice(blockStartInIsolated, sliceEnd)
}

export function resolveFile(filePath: string, solver: Solver): ResolveResult {
  const text = readFileSync(filePath, 'utf8')
  const blocks = extractBlocks(text)
  if (blocks.length === 0) {
    return { resolved: true, resolvedCount: 0, skippedCount: 0 }
  }

  const filename = basename(filePath)
  const solved: SolvedSegment[] = []
  let resolvedCount = 0
  let skippedCount = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block === undefined) continue
    const isolated = buildIsolatedInput(text, blocks, i)
    const output = solver.solve(isolated, filename)
    if (output === null) {
      core.info(`block ${String(i + 1)}/${String(blocks.length)}: skipped`)
      skippedCount++
      continue
    }
    const resolvedLines = extractResolvedSegment(
      isolated,
      output,
      block,
      blocks.slice(0, i),
    )
    if (resolvedLines === null) {
      core.info(
        `block ${String(i + 1)}/${String(blocks.length)}: skipped (mergiraf altered surrounding context)`,
      )
      skippedCount++
      continue
    }
    solved.push({
      startLine: block.startLine,
      endLine: block.endLine,
      resolvedLines,
    })
    resolvedCount++
    core.info(`block ${String(i + 1)}/${String(blocks.length)}: resolved`)
  }

  if (solved.length > 0) {
    const lines = text.split('\n')
    for (let k = solved.length - 1; k >= 0; k--) {
      const s = solved[k]
      if (s === undefined) continue
      lines.splice(s.startLine, s.endLine - s.startLine + 1, ...s.resolvedLines)
    }
    writeFileSync(filePath, lines.join('\n'))
  }

  return {
    resolved: skippedCount === 0,
    resolvedCount,
    skippedCount,
  }
}

class MergirafSolver implements Solver {
  constructor(private readonly bin: string) {}

  solve(input: string, filename: string): string | null {
    const dir = mkdtempSync(join(tmpdir(), 'mergiraf-'))
    try {
      // mergiraf picks its structured parser from the file extension or
      // well-known basename (e.g. `Dockerfile`); without a recognized name it
      // falls back to a line-based merge that leaves trivially resolvable
      // blocks marker-intact.
      const tmp = join(dir, filename)
      writeFileSync(tmp, input)
      execFileSync(this.bin, ['solve', tmp], {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      const output = readFileSync(tmp, 'utf8')
      if (output.includes(START_MARKER)) {
        return null
      }
      return output
    } catch (err) {
      const status =
        err !== null && typeof err === 'object' && 'status' in err
          ? err.status
          : undefined
      if (status === 1) {
        // Exit 1 = mergiraf could not resolve the conflict. This is the
        // expected outcome for unresolvable blocks; do not raise a warning
        // annotation for every such block.
        return null
      }
      const stderr =
        err !== null && typeof err === 'object' && 'stderr' in err
          ? String(err.stderr).trim()
          : ''
      const detail = err instanceof Error ? err.message : String(err)
      core.warning(
        stderr === ''
          ? `mergiraf solve failed: ${detail}`
          : `mergiraf solve failed: ${detail}\n${stderr}`,
      )
      return null
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

export function resolveConflicts(
  filePaths: string[],
  mergirafBin: string,
): Promise<void> {
  const solver = new MergirafSolver(mergirafBin)
  for (const filePath of filePaths) {
    core.startGroup(filePath)
    try {
      const result = resolveFile(filePath, solver)
      core.info(
        `resolved=${String(result.resolved)} resolvedCount=${String(result.resolvedCount)} skippedCount=${String(result.skippedCount)}`,
      )
    } finally {
      core.endGroup()
    }
  }
  return Promise.resolve()
}
