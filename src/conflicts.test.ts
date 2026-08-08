import { err, ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import { detectConflicts, type Exec } from '#conflicts'
import { recordingExec } from '#test/exec'

const fakeExec = (exitCode: number, stdout: string): Exec => {
  return (_commandLine, _args, options) => {
    options?.listeners?.stdout?.(Buffer.from(stdout))
    return Promise.resolve(exitCode)
  }
}

const fakeExecChunks = (exitCode: number, chunks: Buffer[]): Exec => {
  return (_commandLine, _args, options) => {
    for (const chunk of chunks) {
      options?.listeners?.stdout?.(chunk)
    }
    return Promise.resolve(exitCode)
  }
}

describe('detectConflicts', () => {
  it('returns empty array without invoking git when there are no paths to scan', async () => {
    const { exec, calls } = recordingExec(0, '')

    expect(await detectConflicts(exec, [])).toEqual(ok([]))
    expect(calls).toEqual([])
  })

  it('scopes git grep to the given paths via a literal pathspec', async () => {
    const { exec, calls } = recordingExec(1, '')

    await detectConflicts(exec, ['src/foo.ts', 'docs/readme.md'])

    expect(calls).toEqual([
      {
        commandLine: 'git',
        args: [
          '-c',
          'core.quotePath=false',
          '--literal-pathspecs',
          'grep',
          '--untracked',
          '-I',
          '-E',
          '-lz',
          '^<<<<<<< before updating\r?$',
          '--',
          'src/foo.ts',
          'docs/readme.md',
        ],
      },
    ])
  })

  it('returns empty array when git grep finds no matches (exit code 1)', async () => {
    expect(await detectConflicts(fakeExec(1, ''), ['src/foo.ts'])).toEqual(
      ok([]),
    )
  })

  it('returns each NUL-separated entry as a separate element', async () => {
    expect(
      await detectConflicts(
        fakeExec(0, 'src/foo.ts\0src/bar.ts\0tests/baz.test.ts\0'),
        ['src/foo.ts', 'src/bar.ts', 'tests/baz.test.ts'],
      ),
    ).toEqual(ok(['src/foo.ts', 'src/bar.ts', 'tests/baz.test.ts']))
  })

  it('preserves paths containing newline characters', async () => {
    expect(
      await detectConflicts(fakeExec(0, 'src/weird\nname.ts\0src/ok.ts\0'), [
        'src/weird\nname.ts',
        'src/ok.ts',
      ]),
    ).toEqual(ok(['src/weird\nname.ts', 'src/ok.ts']))
  })

  it('preserves multi-byte characters split across stdout chunks', async () => {
    const full = Buffer.from('src/日本語.ts\0src/ok.ts\0', 'utf8')
    const splitAt = full.indexOf(Buffer.from([0xe6])) + 1
    const chunks = [full.subarray(0, splitAt), full.subarray(splitAt)]
    expect(
      await detectConflicts(fakeExecChunks(0, chunks), [
        'src/日本語.ts',
        'src/ok.ts',
      ]),
    ).toEqual(ok(['src/日本語.ts', 'src/ok.ts']))
  })

  it('returns an error when git grep exits with a non-recoverable code', async () => {
    expect(await detectConflicts(fakeExec(128, ''), ['src/foo.ts'])).toEqual(
      err(new Error('git grep failed with exit code 128')),
    )
  })
})
