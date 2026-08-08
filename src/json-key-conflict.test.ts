import { describe, expect, it } from 'vitest'

import {
  AFTER_MARKER,
  BASE_MARKER,
  BEFORE_MARKER,
  SEP_MARKER,
} from '#conflict-block'
import { resolveJsonKeyConflicts } from '#json-key-conflict'

describe('resolveJsonKeyConflicts', () => {
  it('auto-resolves a key that only before-updating added, absent from both base and after-updating', () => {
    const input = `{
  "dependencies": {
<<<<<<< before updating
    "@fohte/new-dep": "1.0.0",
||||||| last update
=======
>>>>>>> after updating
    "@fohte/service-kit": "0.1.4"
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "dependencies": {
    "@fohte/new-dep": "1.0.0",
    "@fohte/service-kit": "0.1.4"
  }
}
`,
    )
  })

  it('auto-resolves a key whose value changed only in after-updating, unchanged by before-updating', () => {
    const input = `{
  "dependencies": {
<<<<<<< before updating
    "@fohte/service-kit": "0.1.4",
||||||| last update
    "@fohte/service-kit": "0.1.4",
=======
    "@fohte/service-kit": "0.1.7",
>>>>>>> after updating
    "vitest": "4.1.9"
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "dependencies": {
    "@fohte/service-kit": "0.1.7",
    "vitest": "4.1.9"
  }
}
`,
    )
  })

  it('resolves an added key and an adjacent value-only change bundled in the same block (the crawlers case)', () => {
    const input = `{
  "dependencies": {
    "@fohte/ddr-score-manager-fetcher": "1.0.0",
<<<<<<< before updating
    "@fohte/ddr-score-manager-parser": "github:fohte/ddr-score-manager#path:/parser",
    "@fohte/service-kit": "0.1.4",
||||||| last update
    "@fohte/service-kit": "0.1.4",
=======
    "@fohte/service-kit": "0.1.7",
>>>>>>> after updating
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "dependencies": {
    "@fohte/ddr-score-manager-fetcher": "1.0.0",
    "@fohte/ddr-score-manager-parser": "github:fohte/ddr-score-manager#path:/parser",
    "@fohte/service-kit": "0.1.7"
  }
}
`,
    )
  })

  it('isolates a key changed differently on both sides into its own single-key marker block, leaving a sibling key in the same block resolved', () => {
    const input = `{
<<<<<<< before updating
  "name": "my-repo",
  "description": "foo repo description",
||||||| last update
  "name": "my-repo",
  "description": "original description",
=======
  "name": "my-repo",
  "description": "bar template description",
>>>>>>> after updating
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "name": "my-repo",
<<<<<<< before updating
  "description": "foo repo description",
||||||| last update
  "description": "original description",
=======
  "description": "bar template description",
>>>>>>> after updating
}
`,
    )
  })

  it('keeps a key conflicted when after-updating modified it but before-updating deleted it (a deletion never equals a modification)', () => {
    const input = `{
<<<<<<< before updating
  "name": "my-site",
||||||| last update
  "name": "my-site",
  "homepage": "https://fohte.net",
=======
  "name": "my-site",
  "homepage": "https://blog.fohte.net",
>>>>>>> after updating
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "name": "my-site",
<<<<<<< before updating
||||||| last update
  "homepage": "https://fohte.net",
=======
  "homepage": "https://blog.fohte.net",
>>>>>>> after updating
}
`,
    )
  })

  it('auto-resolves a key deleted only in after-updating to a deletion, omitting the key line with no marker', () => {
    const input = `{
<<<<<<< before updating
  "legacy": "true",
||||||| last update
  "legacy": "true",
=======
>>>>>>> after updating
  "keep": "yes"
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "keep": "yes"
}
`,
    )
  })

  it('leaves the whole block untouched, markers included, when one line spans a multi-line nested object value', () => {
    const input = `{
<<<<<<< before updating
  "name": "my-repo",
  "config": {
    "nested": true
  },
||||||| last update
  "name": "my-repo",
  "config": {
    "nested": false
  },
=======
  "name": "my-repo",
  "config": {
    "nested": false
  },
>>>>>>> after updating
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(input)
  })

  it('strips the trailing comma from a fully-resolved block whose next line closes the enclosing object', () => {
    const input = `{
  "dependencies": {
<<<<<<< before updating
    "@fohte/service-kit": "0.1.4",
||||||| last update
    "@fohte/service-kit": "0.1.4",
=======
    "@fohte/service-kit": "0.1.7",
>>>>>>> after updating
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "dependencies": {
    "@fohte/service-kit": "0.1.7"
  }
}
`,
    )
  })

  it('adds a trailing comma to a fully-resolved block whose source line lacked one but a sibling key follows', () => {
    const input = `{
  "dependencies": {
<<<<<<< before updating
    "@fohte/service-kit": "0.1.4"
||||||| last update
    "@fohte/service-kit": "0.1.4"
=======
    "@fohte/service-kit": "0.1.7"
>>>>>>> after updating
    "vitest": "4.1.9"
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "dependencies": {
    "@fohte/service-kit": "0.1.7",
    "vitest": "4.1.9"
  }
}
`,
    )
  })

  it('resolves multiple independent blocks in the same file, each on its own outcome', () => {
    const input = `{
  "a": {
<<<<<<< before updating
    "@fohte/service-kit": "0.1.4",
||||||| last update
    "@fohte/service-kit": "0.1.4",
=======
    "@fohte/service-kit": "0.1.7",
>>>>>>> after updating
  },
  "b": {
<<<<<<< before updating
    "description": "foo",
||||||| last update
    "description": "original",
=======
    "description": "bar",
>>>>>>> after updating
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(
      `{
  "a": {
    "@fohte/service-kit": "0.1.7"
  },
  "b": {
<<<<<<< before updating
    "description": "foo",
||||||| last update
    "description": "original",
=======
    "description": "bar",
>>>>>>> after updating
  }
}
`,
    )
  })

  it('resolves a conflict and preserves CRLF line endings', () => {
    const input = [
      '<<<<<<< before updating',
      '  "version": "0.1.4",',
      '||||||| last update',
      '  "version": "0.1.4",',
      '=======',
      '  "version": "0.1.7",',
      '>>>>>>> after updating',
      '}',
      '',
    ].join('\r\n')
    expect(resolveJsonKeyConflicts(input)).toEqual(
      ['  "version": "0.1.7"', '}', ''].join('\r\n'),
    )
  })

  it('returns content unchanged when it has no conflict markers', () => {
    const input = `{
  "dependencies": {
    "@fohte/service-kit": "0.1.7"
  }
}
`
    expect(resolveJsonKeyConflicts(input)).toEqual(input)
  })

  it('resolves a conflict block built from the shared #conflict-block marker constants', () => {
    const input = [
      BEFORE_MARKER,
      '  "@fohte/service-kit": "0.1.4",',
      BASE_MARKER,
      '  "@fohte/service-kit": "0.1.4",',
      SEP_MARKER,
      '  "@fohte/service-kit": "0.1.7",',
      AFTER_MARKER,
      '}',
    ].join('\n')

    expect(resolveJsonKeyConflicts(input)).toEqual(
      ['  "@fohte/service-kit": "0.1.7"', '}'].join('\n'),
    )
  })
})
