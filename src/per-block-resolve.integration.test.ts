import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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
  "version": "2.0.0",
  "dependencies": {
    "@types/node": "24.13.2",
    "vitest": "4.1.9"
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
    // The remaining conflict uses a non-version value: a version-parseable
    // value would be resolved by the version-based resolver before this test
    // can observe mergiraf's own per-key shrink in isolation.
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
<<<<<<< before updating
        "name": "@fohte/eslint-config",
        "description": "ESLint config for fohte",
        "version": "0.3.4",
        "packageManager": "corepack",
||||||| last update
        "name": "eslint-config",
        "private": true,
        "packageManager": "npm",
=======
        "name": "eslint-config",
        "private": true,
        "packageManager": "yarn",
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
  "packageManager": "corepack",
||||||| last update
  "packageManager": "npm",
=======
  "packageManager": "yarn",
>>>>>>> after updating
  "type": "module"
}
`,
    )
  })

  it('per-key resolves each block independently when multiple blocks contain a mix of resolvable and unresolvable keys', async () => {
    // Both remaining conflicts use non-version values: version-parseable
    // values would be resolved by the version-based resolver before this
    // test can observe mergiraf's own per-key independent resolution.
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
<<<<<<< before updating
        "name": "@fohte/demo",
        "version": "0.3.4",
        "packageManager": "corepack",
||||||| last update
        "name": "demo",
        "packageManager": "npm",
=======
        "name": "demo",
        "packageManager": "yarn",
>>>>>>> after updating
        "type": "module",
        "dependencies": {
<<<<<<< before updating
          "@types/node": "24.13.2",
          "eslint": "latest",
          "vitest": "4.1.9"
||||||| last update
          "@types/node": "24.10.0",
          "eslint": "stable",
          "vitest": "4.1.5"
=======
          "@types/node": "24.10.0",
          "eslint": "canary",
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
  "packageManager": "corepack",
||||||| last update
  "packageManager": "npm",
=======
  "packageManager": "yarn",
>>>>>>> after updating
  "type": "module",
  "dependencies": {
    "@types/node": "24.13.2",
<<<<<<< before updating
    "eslint": "latest",
||||||| last update
    "eslint": "stable",
=======
    "eslint": "canary",
>>>>>>> after updating
    "vitest": "4.1.9"
  }
}
`,
    )
  })

  it('leaves the file byte-identical when no key can be resolved', async () => {
    // Uses a non-version value: if this were version-parseable, the
    // version-based resolver would resolve it before this test can observe
    // the fallback path (neither mergiraf nor the resolver can resolve it).
    const file = join(tmpDir, 'package.json')
    const input = `{
  "name": "demo",
<<<<<<< before updating
  "description": "foo"
||||||| last update
  "description": "baz"
=======
  "description": "bar"
>>>>>>> after updating
}
`
    writeFileSync(file, input)

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(input)
  })

  it('auto-resolves a leftover version-only conflict by adopting the newer after-updating value', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
<<<<<<< before updating
  "packageManager": "pnpm@11.5.3",
||||||| last update
  "packageManager": "pnpm@11.5.2",
=======
  "packageManager": "pnpm@11.7.0",
>>>>>>> after updating
}
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(
      `{
  "packageManager": "pnpm@11.7.0",
}
`,
    )
  })

  it('keeps the before-updating version instead of downgrading when the repository is already ahead of the template', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
<<<<<<< before updating
  "node": "26.1.0",
||||||| last update
  "node": "24.17.0",
=======
  "node": "24.18.0",
>>>>>>> after updating
}
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(
      `{
  "node": "26.1.0",
}
`,
    )
  })

  it('resolves a version-only line via the version-based fallback while leaving an unrelated repo-only addition unresolved, for a file mergiraf cannot parse', async () => {
    const file = join(tmpDir, 'notes.txt')
    writeFileSync(
      file,
      `# demo

<<<<<<< before updating
version: 2.0.0
||||||| last update
version: 1.0.0
=======
version: 3.0.0
>>>>>>> after updating
shared: unchanged
extra: repo-only-line
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(readFileSync(file, 'utf8')).toEqual(
      `# demo

      version: 3.0.0
      shared: unchanged
<<<<<<< before updating
      extra: repo-only-line
||||||| last update
      version: 1.0.0
      shared: unchanged
=======
>>>>>>> after updating
`,
    )
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

  it('does not leave a mergiraf .orig backup file behind after resolving conflicts', async () => {
    const file = join(tmpDir, 'package.json')
    writeFileSync(
      file,
      `{
  "version": "2.0.0",
}
`,
    )

    await resolveConflicts([file], MERGIRAF_BIN_PATH)

    expect(existsSync(`${file}.orig`)).toBe(false)
  })
})
