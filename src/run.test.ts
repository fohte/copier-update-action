import { describe, expect, it } from 'vitest'

import type { Inputs } from '@/inputs'
import { type Exec, type RunDeps, runWithDeps } from '@/run'
import type { GetLatestRelease } from '@/target-version'

interface CallLog {
  steps: string[]
}

const noopExec: Exec = () => Promise.resolve(0)

const stubGetLatestRelease: GetLatestRelease = () =>
  Promise.resolve({ data: { tag_name: 'v0.0.0' } })

const defaultInputs: Inputs = {
  templateRepo: 'owner/repo',
  targetVersion: 'v1.2.3',
  githubToken: '',
  copierVersion: '',
}

const makeDeps = (log: CallLog, overrides: Partial<RunDeps> = {}): RunDeps => {
  const push = (name: string): void => {
    log.steps.push(name)
  }
  return {
    exec: noopExec,
    readInputs: () => {
      push('readInputs')
      return defaultInputs
    },
    validateInputs: () => {
      push('validateInputs')
    },
    getLatestReleaseFactory: () => stubGetLatestRelease,
    resolveTargetVersion: () => {
      push('resolveTargetVersion')
      return Promise.resolve('v1.2.3')
    },
    installMergiraf: () => {
      push('installMergiraf')
      return Promise.resolve('/usr/local/bin/mergiraf')
    },
    configureDiff3: () => {
      push('configureDiff3')
      return Promise.resolve()
    },
    runCopierUpdate: () => {
      push('runCopierUpdate')
      return Promise.resolve()
    },
    getChangedFiles: () => {
      push('getChangedFiles')
      return Promise.resolve([])
    },
    detectConflicts: () => {
      push('detectConflicts')
      return Promise.resolve([])
    },
    resolveConflicts: () => {
      push('resolveConflicts')
      return Promise.resolve()
    },
    writeOutputs: () => {
      push('writeOutputs')
      return Promise.resolve()
    },
    ...overrides,
  }
}

describe('runWithDeps', () => {
  it('invokes each step in order and skips resolveConflicts when no conflicts', async () => {
    const log: CallLog = { steps: [] }

    await runWithDeps(makeDeps(log))

    expect(log.steps).toEqual([
      'readInputs',
      'validateInputs',
      'resolveTargetVersion',
      'installMergiraf',
      'configureDiff3',
      'runCopierUpdate',
      'getChangedFiles',
      'detectConflicts',
      'writeOutputs',
    ])
  })

  it('invokes resolveConflicts when detectConflicts returns files', async () => {
    const log: CallLog = { steps: [] }
    let resolveArgs: { files: string[]; bin: string } | undefined

    await runWithDeps(
      makeDeps(log, {
        detectConflicts: () => {
          log.steps.push('detectConflicts')
          return Promise.resolve(['a.txt', 'b.txt'])
        },
        resolveConflicts: (files, bin) => {
          log.steps.push('resolveConflicts')
          resolveArgs = { files, bin }
          return Promise.resolve()
        },
      }),
    )

    const actual = { steps: log.steps, resolveArgs }
    expect(actual).toEqual({
      steps: [
        'readInputs',
        'validateInputs',
        'resolveTargetVersion',
        'installMergiraf',
        'configureDiff3',
        'runCopierUpdate',
        'getChangedFiles',
        'detectConflicts',
        'resolveConflicts',
        'writeOutputs',
      ],
      resolveArgs: {
        files: ['a.txt', 'b.txt'],
        bin: '/usr/local/bin/mergiraf',
      },
    })
  })

  it('passes the files getChangedFiles reports to both detectConflicts and writeOutputs', async () => {
    const log: CallLog = { steps: [] }
    let detectPaths: string[] | undefined
    let writeOutputsPaths: string[] | undefined

    await runWithDeps(
      makeDeps(log, {
        getChangedFiles: () => Promise.resolve(['a.txt', 'b.txt']),
        detectConflicts: (_exec, paths) => {
          detectPaths = paths
          return Promise.resolve([])
        },
        writeOutputs: (_exec, paths) => {
          writeOutputsPaths = paths
          return Promise.resolve()
        },
      }),
    )

    const actual = { detectPaths, writeOutputsPaths }
    expect(actual).toEqual({
      detectPaths: ['a.txt', 'b.txt'],
      writeOutputsPaths: ['a.txt', 'b.txt'],
    })
  })

  it('passes resolved target version and copier version into runCopierUpdate', async () => {
    const log: CallLog = { steps: [] }
    let copierArgs: { targetVersion: string; copierVersion: string } | undefined

    await runWithDeps(
      makeDeps(log, {
        readInputs: () => ({
          templateRepo: 'owner/repo',
          targetVersion: '',
          githubToken: 'token',
          copierVersion: '9.0.0',
        }),
        resolveTargetVersion: () => Promise.resolve('v9.9.9'),
        runCopierUpdate: (args) => {
          copierArgs = args
          return Promise.resolve()
        },
      }),
    )

    expect(copierArgs).toEqual({
      targetVersion: 'v9.9.9',
      copierVersion: '9.0.0',
    })
  })

  it('propagates errors from any step', async () => {
    const log: CallLog = { steps: [] }
    const boom = new Error('boom')

    await expect(
      runWithDeps(
        makeDeps(log, {
          runCopierUpdate: () => Promise.reject(boom),
        }),
      ),
    ).rejects.toBe(boom)
  })
})
