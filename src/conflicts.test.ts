import { describe, expect, it } from 'vitest'

import { detectConflicts, type Exec } from '@/conflicts'

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
  it('returns empty array when git grep finds no matches (exit code 1)', async () => {
    expect(await detectConflicts(fakeExec(1, ''))).toEqual([])
  })

  it('returns each NUL-separated entry as a separate element', async () => {
    expect(
      await detectConflicts(
        fakeExec(0, 'src/foo.ts\0src/bar.ts\0tests/baz.test.ts\0'),
      ),
    ).toEqual(['src/foo.ts', 'src/bar.ts', 'tests/baz.test.ts'])
  })

  it('preserves paths containing newline characters', async () => {
    expect(
      await detectConflicts(fakeExec(0, 'src/weird\nname.ts\0src/ok.ts\0')),
    ).toEqual(['src/weird\nname.ts', 'src/ok.ts'])
  })

  it('preserves multi-byte characters split across stdout chunks', async () => {
    const full = Buffer.from('src/日本語.ts\0src/ok.ts\0', 'utf8')
    const splitAt = full.indexOf(Buffer.from([0xe6])) + 1
    const chunks = [full.subarray(0, splitAt), full.subarray(splitAt)]
    expect(await detectConflicts(fakeExecChunks(0, chunks))).toEqual([
      'src/日本語.ts',
      'src/ok.ts',
    ])
  })

  it('throws when git grep exits with a non-recoverable code', async () => {
    await expect(detectConflicts(fakeExec(128, ''))).rejects.toThrow(
      new Error('git grep failed with exit code 128'),
    )
  })
})
