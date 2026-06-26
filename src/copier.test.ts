import { describe, expect, it } from 'vitest'

import { configureDiff3, type Exec, runCopierUpdate } from '@/copier'

interface ExecCall {
  commandLine: string
  args: string[] | undefined
}

const recordingExec =
  (calls: ExecCall[]): Exec =>
  (commandLine, args) => {
    calls.push({ commandLine, args })
    return Promise.resolve(0)
  }

describe('configureDiff3', () => {
  it('runs git config merge.conflictStyle diff3', async () => {
    const calls: ExecCall[] = []

    await configureDiff3(recordingExec(calls))

    expect(calls).toEqual([
      {
        commandLine: 'git',
        args: ['config', 'merge.conflictStyle', 'diff3'],
      },
    ])
  })
})

describe('runCopierUpdate', () => {
  it('invokes pipx run copier without pin when copierVersion is empty', async () => {
    const calls: ExecCall[] = []

    await runCopierUpdate(
      { targetVersion: 'v1.2.3', copierVersion: '' },
      recordingExec(calls),
    )

    expect(calls).toEqual([
      {
        commandLine: 'pipx',
        args: [
          'run',
          'copier',
          'update',
          '--trust',
          '--defaults',
          '--vcs-ref',
          'v1.2.3',
        ],
      },
    ])
  })

  it('pins copier version with == when copierVersion is set', async () => {
    const calls: ExecCall[] = []

    await runCopierUpdate(
      { targetVersion: 'v1.2.3', copierVersion: '9.0.0' },
      recordingExec(calls),
    )

    expect(calls).toEqual([
      {
        commandLine: 'pipx',
        args: [
          'run',
          'copier==9.0.0',
          'update',
          '--trust',
          '--defaults',
          '--vcs-ref',
          'v1.2.3',
        ],
      },
    ])
  })

  it('propagates non-zero exit from copier as a thrown error', async () => {
    const exec: Exec = () =>
      Promise.reject(new Error('copier failed with exit code 1'))

    await expect(
      runCopierUpdate({ targetVersion: 'v1.2.3', copierVersion: '' }, exec),
    ).rejects.toThrow('copier failed with exit code 1')
  })
})
