import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MERGIRAF_BIN_PATH } from '@test/mergiraf-bin'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveConflicts } from '@/per-block-resolve'

// When a copier-updated file has multiple conflict blocks where both sides
// bumped to the same new value, mergiraf's structured parser should auto-resolve
// each block. It only does so when it can identify the source language from
// the file extension; a generic `.txt` temp file silently falls back to
// line-based merging, which leaves every block unresolved.
const JSON_WITH_TWO_IDENTICAL_BUMP_BLOCKS = `{
  "name": "demo",
  "version": "2.0.0",
  "dependencies": {
    "@types/node": "24.13.2",
    "vitest": "4.1.9"
  }
}
`

const JSON_RESOLVED = `{
  "name": "demo",
  "version": "2.0.0",
  "dependencies": {
    "@types/node": "24.13.2",
    "vitest": "4.1.9"
  }
}
`

describe('resolveConflicts (real mergiraf binary)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'per-block-resolve-integration-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('resolves every identically-bumped block in a JSON file', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(file, JSON_WITH_TWO_IDENTICAL_BUMP_BLOCKS)

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(JSON_RESOLVED)
  })
})
