import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MERGIRAF_BIN_PATH } from '@test/mergiraf-bin'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveConflicts } from '@/per-block-resolve'

// Every input uses copier's real conflict-marker labels
// (`<<<<<<< before updating` / `||||||| last update` / `=======` /
// `>>>>>>> after updating`). Mergiraf ignores blocks whose labels it does not
// recognize, so a label-recognition regression would fail the resolvable-case
// tests (fully / partial) while leaving the unchanged-file tests passing
// spuriously — check both groups when this file starts flaking.

describe('resolveConflicts (real mergiraf binary)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'per-block-resolve-integration-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('fully resolves every block when both sides agree on the new value', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
  "name": "demo",
<<<<<<< before updating
  "version": "2.0.0",
||||||| last update
  "version": "1.0.0",
=======
  "version": "2.0.0",
>>>>>>> after updating
  "dependencies": {
<<<<<<< before updating
    "@types/node": "24.13.2",
    "vitest": "4.1.9"
||||||| last update
    "@types/node": "24.10.0",
    "vitest": "4.1.5"
=======
    "@types/node": "24.13.2",
    "vitest": "4.1.9"
>>>>>>> after updating
  }
}
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(
      `{
  "name": "demo",
  "version": "2.0.0",
  "dependencies": {
    "@types/node": "24.13.2",
    "vitest": "4.1.9"
  }
}
`,
    )
  })

  it('shrinks a single block down to the one key with a real conflict (per-key partial resolve)', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
<<<<<<< before updating
  "name": "@fohte/eslint-config",
  "description": "ESLint config for fohte",
  "version": "0.3.4",
  "packageManager": "pnpm@11.5.3",
||||||| last update
  "name": "eslint-config",
  "private": true,
  "packageManager": "pnpm@11.5.2",
=======
  "name": "eslint-config",
  "private": true,
  "packageManager": "pnpm@11.7.0",
>>>>>>> after updating
  "type": "module"
}
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(
      `{
  "name": "@fohte/eslint-config",
  "description": "ESLint config for fohte",
  "version": "0.3.4",
<<<<<<< before updating
  "packageManager": "pnpm@11.5.3",
||||||| last update
  "packageManager": "pnpm@11.5.2",
=======
  "packageManager": "pnpm@11.7.0",
>>>>>>> after updating
  "type": "module"
}
`,
    )
  })

  it('per-key resolves each block independently when multiple blocks contain a mix of resolvable and unresolvable keys', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
<<<<<<< before updating
  "name": "@fohte/demo",
  "version": "0.3.4",
  "packageManager": "pnpm@11.5.3",
||||||| last update
  "name": "demo",
  "packageManager": "pnpm@11.5.2",
=======
  "name": "demo",
  "packageManager": "pnpm@11.7.0",
>>>>>>> after updating
  "type": "module",
  "dependencies": {
<<<<<<< before updating
    "@types/node": "24.13.2",
    "eslint": "9.20.0",
    "vitest": "4.1.9"
||||||| last update
    "@types/node": "24.10.0",
    "eslint": "9.15.0",
    "vitest": "4.1.5"
=======
    "@types/node": "24.10.0",
    "eslint": "9.30.0",
    "vitest": "4.1.9"
>>>>>>> after updating
  }
}
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(
      `{
  "name": "@fohte/demo",
  "version": "0.3.4",
<<<<<<< before updating
  "packageManager": "pnpm@11.5.3",
||||||| last update
  "packageManager": "pnpm@11.5.2",
=======
  "packageManager": "pnpm@11.7.0",
>>>>>>> after updating
  "type": "module",
  "dependencies": {
    "@types/node": "24.13.2",
<<<<<<< before updating
    "eslint": "9.20.0",
||||||| last update
    "eslint": "9.15.0",
=======
    "eslint": "9.30.0",
>>>>>>> after updating
    "vitest": "4.1.9"
  }
}
`,
    )
  })

  it('leaves the file byte-identical when no key can be resolved', async () => {
    const file = join(tmpDir, 'package.json')
    const input = `{
  "name": "demo",
<<<<<<< before updating
  "version": "2.0.0"
||||||| last update
  "version": "1.0.0"
=======
  "version": "3.0.0"
>>>>>>> after updating
}
`
    writeFileSync(file, input)

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(input)
  })

  it('does not corrupt the file when mergiraf cannot select a language parser for the extension', async () => {
    // mergiraf falls back to giving up entirely (exit 1) when the file
    // extension does not map to a supported language parser. The file must
    // survive intact so the downstream PR still shows the original conflict
    // for a human to resolve.
    const file = join(tmpDir, 'notes.txt')
    const input = `# demo

<<<<<<< before updating
new content
||||||| last update
old content
=======
alt content
>>>>>>> after updating
`
    writeFileSync(file, input)

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(input)
  })
})
