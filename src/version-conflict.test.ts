import { describe, expect, it } from 'vitest'

import { resolveVersionConflicts } from '@/version-conflict'

describe('resolveVersionConflicts', () => {
  it('adopts the after-updating version when it is newer than before-updating', () => {
    const input = `{
<<<<<<< before updating
  "version": "2.0.0"
||||||| last update
  "version": "1.0.0"
=======
  "version": "3.0.0"
>>>>>>> after updating
}
`
    expect(resolveVersionConflicts(input)).toEqual(
      `{
  "version": "3.0.0"
}
`,
    )
  })

  it('keeps the before-updating version when it is newer than after-updating (no downgrade)', () => {
    const input = `{
<<<<<<< before updating
  "node": "26.1.0"
||||||| last update
  "node": "24.17.0"
=======
  "node": "24.18.0"
>>>>>>> after updating
}
`
    expect(resolveVersionConflicts(input)).toEqual(
      `{
  "node": "26.1.0"
}
`,
    )
  })

  it('adopts the after-updating line when both sides resolve to the same version', () => {
    const input = `<<<<<<< before updating
  "version": "2.0.0",
||||||| last update
  "version": "1.0.0",
=======
  "version": "2.0.0"
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(`  "version": "2.0.0"
`)
  })

  it('resolves a line by its version even when unrelated content (e.g. a SHA pin) also differs', () => {
    const input = `<<<<<<< before updating
        uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v6.0.2
||||||| last update
        uses: actions/checkout@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # v6.0.3
=======
        uses: actions/checkout@cccccccccccccccccccccccccccccccccccccccc # v7.0.0
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(
      `        uses: actions/checkout@cccccccccccccccccccccccccccccccccccccccc # v7.0.0
`,
    )
  })

  it('leaves the block untouched when the differing values are not valid versions', () => {
    const input = `<<<<<<< before updating
  "description": "foo"
||||||| last update
  "description": "baz"
=======
  "description": "bar"
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(input)
  })

  it('leaves the block untouched when a line contains more than one version-like token', () => {
    const input = `<<<<<<< before updating
  "range": "1.2.3 - 4.5.6"
||||||| last update
  "range": "1.0.0 - 4.0.0"
=======
  "range": "1.2.3 - 5.0.0"
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(input)
  })

  it('keeps the stable before-updating version instead of downgrading to an equal-looking after-updating prerelease', () => {
    const input = `<<<<<<< before updating
  "version": "2.0.0"
||||||| last update
  "version": "1.9.0"
=======
  "version": "2.0.0-rc.1"
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(`  "version": "2.0.0"
`)
  })

  it('leaves the block untouched when a differing value has more segments than semver can represent (e.g. an IP address)', () => {
    const input = `<<<<<<< before updating
  "gateway": "10.0.0.254"
||||||| last update
  "gateway": "10.0.0.1"
=======
  "gateway": "10.0.0.2"
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(input)
  })

  it('leaves a multi-line replaced run untouched rather than risk pairing reordered fields by position', () => {
    const input = `<<<<<<< before updating
b_key: 2.0.0
a_key: 1.0.0
||||||| last update
b_key: 1.5.0
a_key: 1.5.0
=======
a_key: 2.0.0
b_key: 1.0.0
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(input)
  })

  it('leaves the whole hunk untouched when a resolvable line has no common anchor to separate it from an unrelated added line', () => {
    const input = `<<<<<<< before updating
alpha: 1.0.0
extra-line: value
||||||| last update
alpha: 0.9.0
=======
alpha: 2.0.0
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(input)
  })

  it('resolves only the version-only line while leaving an unrelated repo-only addition conflicted', () => {
    const input = `<<<<<<< before updating
version: 2.0.0
shared: unchanged
extra: repo-only-line
||||||| last update
version: 1.0.0
shared: unchanged
=======
version: 3.0.0
shared: unchanged
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(
      `version: 3.0.0
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

  it('resolves multiple independent blocks in the same file', () => {
    const input = `a:
<<<<<<< before updating
version: 1.0.0
||||||| last update
version: 0.9.0
=======
version: 2.0.0
>>>>>>> after updating
b:
<<<<<<< before updating
version: 5.0.0
||||||| last update
version: 4.0.0
=======
version: 4.5.0
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(
      `a:
version: 2.0.0
b:
version: 5.0.0
`,
    )
  })

  it('reuses the whole base section for each separate unresolved slice within one block', () => {
    const input = `<<<<<<< before updating
extra-front
anchor1
version: 2.0.0
anchor2
extra-back
||||||| last update
anchor1
version: 1.0.0
anchor2
=======
anchor1
version: 3.0.0
anchor2
>>>>>>> after updating
`
    expect(resolveVersionConflicts(input)).toEqual(
      `<<<<<<< before updating
extra-front
||||||| last update
anchor1
version: 1.0.0
anchor2
=======
>>>>>>> after updating
anchor1
version: 3.0.0
anchor2
<<<<<<< before updating
extra-back
||||||| last update
anchor1
version: 1.0.0
anchor2
=======
>>>>>>> after updating
`,
    )
  })

  it('resolves a well-formed block and preserves an unclosed trailing marker sequence untouched', () => {
    const input = `<<<<<<< before updating
version: 1.0.0
||||||| last update
version: 0.9.0
=======
version: 2.0.0
>>>>>>> after updating
<<<<<<< before updating
truncated, no closing markers
`
    expect(resolveVersionConflicts(input)).toEqual(
      `version: 2.0.0
<<<<<<< before updating
truncated, no closing markers
`,
    )
  })

  it('returns content unchanged when it has no conflict markers', () => {
    const input = `{
  "version": "1.0.0"
}
`
    expect(resolveVersionConflicts(input)).toEqual(input)
  })
})
