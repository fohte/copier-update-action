import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type Block,
  buildIsolatedInput,
  extractBlocks,
  resolveFile,
  type Solver,
} from '@/per-block-resolve'

const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test',
  'fixtures',
  'conflicts',
)

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8')
}

const SINGLE_BLOCK = `head
<<<<<<< before updating
ours-1
ours-2
||||||| ancestor
anc-1
=======
theirs-1
>>>>>>> updated
tail
`

const NO_CONFLICTS = `just a file
no markers here
done
`

function recordingSolver(responses: (string | null)[]): {
  solver: Solver
  calls: string[]
} {
  const calls: string[] = []
  let i = 0
  return {
    calls,
    solver: {
      solve(input) {
        if (i >= responses.length) {
          throw new Error(
            `unexpected solver.solve call #${String(i + 1)} (only ${String(responses.length)} responses configured)`,
          )
        }
        calls.push(input)
        const response = responses[i] ?? null
        i++
        return response
      },
    },
  }
}

describe('extractBlocks', () => {
  it('parses a single conflict block', () => {
    expect(extractBlocks(SINGLE_BLOCK)).toEqual<Block[]>([
      {
        startLine: 1,
        endLine: 8,
        beforeLines: ['ours-1', 'ours-2'],
      },
    ])
  })

  it('parses multiple conflict blocks, including one with an empty ancestor', () => {
    expect(extractBlocks(readFixture('multi-block.txt'))).toEqual<Block[]>([
      {
        startLine: 1,
        endLine: 8,
        beforeLines: ['A-before-1', 'A-before-2'],
      },
      {
        startLine: 10,
        endLine: 16,
        beforeLines: ['B-before'],
      },
    ])
  })

  it('ignores marker-like substrings that are not full lines', () => {
    expect(extractBlocks(readFixture('marker-like-text.txt'))).toEqual<Block[]>(
      [
        {
          startLine: 3,
          endLine: 8,
          beforeLines: ['real-before'],
        },
      ],
    )
  })

  it('returns an empty array when there are no markers', () => {
    expect(extractBlocks(NO_CONFLICTS)).toEqual<Block[]>([])
  })

  it('preserves a single empty line in the before side', () => {
    const text = `head
<<<<<<< before updating

|||||||
=======
theirs
>>>>>>> updated
tail
`
    expect(extractBlocks(text)).toEqual<Block[]>([
      {
        startLine: 1,
        endLine: 6,
        beforeLines: [''],
      },
    ])
  })
})

describe('buildIsolatedInput', () => {
  it('returns the input unchanged when only one block exists', () => {
    const blocks = extractBlocks(SINGLE_BLOCK)
    expect(buildIsolatedInput(SINGLE_BLOCK, blocks, 0)).toEqual(SINGLE_BLOCK)
  })

  it('replaces the other block with its before text when isolating the first', () => {
    const text = readFixture('multi-block.txt')
    const blocks = extractBlocks(text)
    expect(buildIsolatedInput(text, blocks, 0)).toEqual(
      `prelude
<<<<<<< before updating
A-before-1
A-before-2
||||||| ancestor
A-anc
=======
A-theirs
>>>>>>> updated
middle
B-before
tail
`,
    )
  })

  it('replaces the other block with its before text when isolating the second', () => {
    const text = readFixture('multi-block.txt')
    const blocks = extractBlocks(text)
    expect(buildIsolatedInput(text, blocks, 1)).toEqual(
      `prelude
A-before-1
A-before-2
middle
<<<<<<< before updating
B-before
|||||||
=======
B-theirs-1
B-theirs-2
>>>>>>> updated
tail
`,
    )
  })
})

describe('resolveFile', () => {
  let tmpDir: string
  let tmpFile: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'per-block-resolve-test-'))
    tmpFile = join(tmpDir, 'conflict.txt')
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rewrites the file with each block replaced when every block is resolved', () => {
    const text = readFixture('multi-block.txt')
    writeFileSync(tmpFile, text)

    // Each isolated input contains exactly one conflict block. The fake solver
    // replaces every line spanning that block with a deterministic marker so
    // we can assert on the exact rewritten file.
    const solveByMarker: Solver = {
      solve(input) {
        return input.replace(
          /<<<<<<< before updating\n[\s\S]*?\n>>>>>>> updated\n/,
          'RESOLVED\n',
        )
      },
    }

    const result = resolveFile(tmpFile, solveByMarker)

    expect(result).toEqual({
      resolved: true,
      resolvedCount: 2,
      skippedCount: 0,
    })
    expect(readFileSync(tmpFile, 'utf8')).toEqual(
      `prelude
RESOLVED
middle
RESOLVED
tail
`,
    )
  })

  it('rewrites only the resolved block and leaves skipped markers intact', () => {
    const text = readFixture('multi-block.txt')
    writeFileSync(tmpFile, text)

    // Block index 0 fails; block index 1 succeeds. For the successful call,
    // hand-craft the output: the isolated input for block 1 has block 0
    // replaced with its before text, and our fake "resolves" the remaining
    // marker block to `RESOLVED-1`.
    const { solver, calls } = recordingSolver([
      null,
      `prelude
A-before-1
A-before-2
middle
RESOLVED-1
tail
`,
    ])

    const result = resolveFile(tmpFile, solver)

    expect(result).toEqual({
      resolved: false,
      resolvedCount: 1,
      skippedCount: 1,
    })
    expect(readFileSync(tmpFile, 'utf8')).toEqual(
      `prelude
<<<<<<< before updating
A-before-1
A-before-2
||||||| ancestor
A-anc
=======
A-theirs
>>>>>>> updated
middle
RESOLVED-1
tail
`,
    )
    expect(calls).toEqual([
      buildIsolatedInput(text, extractBlocks(text), 0),
      buildIsolatedInput(text, extractBlocks(text), 1),
    ])
  })

  it('leaves the file unchanged when every block fails', () => {
    const text = readFixture('multi-block.txt')
    writeFileSync(tmpFile, text)

    const { solver } = recordingSolver([null, null])
    const result = resolveFile(tmpFile, solver)

    expect(result).toEqual({
      resolved: false,
      resolvedCount: 0,
      skippedCount: 2,
    })
    expect(readFileSync(tmpFile, 'utf8')).toEqual(text)
  })

  it('returns a no-op result when the file has no conflict markers', () => {
    writeFileSync(tmpFile, NO_CONFLICTS)
    const { solver, calls } = recordingSolver([])

    const result = resolveFile(tmpFile, solver)

    expect(result).toEqual({
      resolved: true,
      resolvedCount: 0,
      skippedCount: 0,
    })
    expect(calls).toEqual([])
    expect(readFileSync(tmpFile, 'utf8')).toEqual(NO_CONFLICTS)
  })
})
