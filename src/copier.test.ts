import { describe, expect, it } from 'vitest'

import { configureDiff3, type Exec, runCopierUpdate } from '#copier'

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
      { targetVersion: 'v1.2.3', copierVersion: '', extraData: '' },
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
      { targetVersion: 'v1.2.3', copierVersion: '9.0.0', extraData: '' },
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

  it('passes each extraData line as a repeated --data flag', async () => {
    const calls: ExecCall[] = []

    await runCopierUpdate(
      {
        targetVersion: 'v1.2.3',
        copierVersion: '',
        extraData: 'repo_id=999999\nfoo=bar',
      },
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
          '--data',
          'repo_id=999999',
          '--data',
          'foo=bar',
        ],
      },
    ])
  })

  it('ignores blank lines in extraData', async () => {
    const calls: ExecCall[] = []

    await runCopierUpdate(
      {
        targetVersion: 'v1.2.3',
        copierVersion: '',
        extraData: '\n\nrepo_id=999999\n\n',
      },
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
          '--data',
          'repo_id=999999',
        ],
      },
    ])
  })

  it('trims surrounding whitespace from each extraData line', async () => {
    const calls: ExecCall[] = []

    await runCopierUpdate(
      {
        targetVersion: 'v1.2.3',
        copierVersion: '',
        extraData: '  repo_id=999999  ',
      },
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
          '--data',
          'repo_id=999999',
        ],
      },
    ])
  })

  it('propagates non-zero exit from copier as a thrown error', async () => {
    const exec: Exec = () =>
      Promise.reject(new Error('copier failed with exit code 1'))

    await expect(
      runCopierUpdate(
        { targetVersion: 'v1.2.3', copierVersion: '', extraData: '' },
        exec,
      ),
    ).rejects.toEqual(new Error('copier failed with exit code 1'))
  })
})
