import { describe, expect, it } from 'vitest'

import { type Exec, getChangedFiles } from '@/git'

const fakeExec = (exitCode: number, stdout: string): Exec => {
  return (_commandLine, _args, options) => {
    options?.listeners?.stdout?.(Buffer.from(stdout))
    return Promise.resolve(exitCode)
  }
}

interface ExecCall {
  commandLine: string
  args: string[] | undefined
}

const recordingExec = (
  exitCode: number,
  stdout: string,
): { exec: Exec; calls: ExecCall[] } => {
  const calls: ExecCall[] = []
  const exec: Exec = (commandLine, args, options) => {
    calls.push({ commandLine, args })
    options?.listeners?.stdout?.(Buffer.from(stdout))
    return Promise.resolve(exitCode)
  }
  return { exec, calls }
}

describe('getChangedFiles', () => {
  it('returns empty array when there is no diff', async () => {
    expect(await getChangedFiles(fakeExec(0, ''))).toEqual([])
  })

  it('strips the two-letter status prefix from each entry', async () => {
    expect(
      await getChangedFiles(
        fakeExec(0, ' M a.txt\0?? new-file.txt\0D  removed.txt\0'),
      ),
    ).toEqual(['a.txt', 'new-file.txt', 'removed.txt'])
  })

  it('invokes git status with -z and --no-renames for unambiguous parsing', async () => {
    const { exec, calls } = recordingExec(0, '')

    await getChangedFiles(exec)

    expect(calls).toEqual([
      {
        commandLine: 'git',
        args: [
          'status',
          '--porcelain',
          '-z',
          '--untracked-files=all',
          '--no-renames',
        ],
      },
    ])
  })

  it('throws when git status exits with a non-zero code', async () => {
    await expect(getChangedFiles(fakeExec(128, ''))).rejects.toThrow(
      new Error('git status --porcelain failed with exit code 128'),
    )
  })
})
