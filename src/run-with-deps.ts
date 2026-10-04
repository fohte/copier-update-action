import * as core from '@actions/core'
import type { Result } from 'neverthrow'

import type { CopierUpdateArgs } from '#copier'
import type { Exec } from '#exec'
import type { Inputs } from '#inputs'
import type { GetLatestRelease } from '#target-version'

export interface RunDeps {
  exec: Exec
  readInputs: () => Inputs
  validateInputs: (inputs: Inputs) => Result<void, Error>
  getLatestReleaseFactory: (token: string) => GetLatestRelease
  resolveTargetVersion: (
    inputs: Pick<Inputs, 'templateRepo' | 'targetVersion'>,
    getLatestRelease: GetLatestRelease,
  ) => Promise<Result<string, Error>>
  installMergiraf: (exec: Exec) => Promise<Result<string, Error>>
  configureDiff3: (exec: Exec) => Promise<void>
  runCopierUpdate: (args: CopierUpdateArgs, exec: Exec) => Promise<void>
  getChangedFiles: (exec: Exec) => Promise<Result<string[], Error>>
  detectConflicts: (
    exec: Exec,
    paths: string[],
  ) => Promise<Result<string[], Error>>
  resolveConflicts: (filePaths: string[], mergirafBin: string) => Promise<void>
  writeOutputs: (
    exec: Exec,
    changedFiles: string[],
  ) => Promise<Result<void, Error>>
}

function withGroup<T>(name: string, fn: () => Promise<T>): Promise<T> {
  core.startGroup(name)
  return fn().finally(() => {
    core.endGroup()
  })
}

// Accepts either form so callers don't need an extra `await` just to satisfy
// this function's parameter type before immediately handling the Result.
function unwrapOrReject<T>(
  result: Result<T, Error> | Promise<Result<T, Error>>,
): Promise<T> {
  return Promise.resolve(result).then((r) =>
    r.match(
      (value) => value,
      (error) => Promise.reject<T>(error),
    ),
  )
}

export async function runWithDeps(deps: RunDeps): Promise<void> {
  const inputs = await withGroup('Read inputs', () => {
    const i = deps.readInputs()
    return unwrapOrReject(deps.validateInputs(i)).then(() => i)
  })

  const targetVersion = await withGroup('Resolve target version', async () => {
    const getLatestRelease = deps.getLatestReleaseFactory(inputs.githubToken)
    const v = await unwrapOrReject(
      deps.resolveTargetVersion(inputs, getLatestRelease),
    )
    core.setOutput('target-version', v)
    return v
  })

  const mergirafBin = await withGroup('Install mergiraf', () =>
    unwrapOrReject(deps.installMergiraf(deps.exec)),
  )

  await withGroup('Configure git diff3', () => deps.configureDiff3(deps.exec))

  await withGroup('Run copier update', () =>
    deps.runCopierUpdate(
      {
        targetVersion,
        copierVersion: inputs.copierVersion,
        extraData: inputs.extraData,
      },
      deps.exec,
    ),
  )

  const { changedFiles, conflictFiles } = await withGroup(
    'Detect conflicts',
    async () => {
      const changed = await unwrapOrReject(deps.getChangedFiles(deps.exec))
      const files = await unwrapOrReject(
        deps.detectConflicts(deps.exec, changed),
      )
      core.info(`detected ${String(files.length)} conflict file(s)`)
      return { changedFiles: changed, conflictFiles: files }
    },
  )

  if (conflictFiles.length > 0) {
    await withGroup('Resolve conflicts', () =>
      deps.resolveConflicts(conflictFiles, mergirafBin),
    )
  }

  await withGroup('Write outputs', () =>
    unwrapOrReject(deps.writeOutputs(deps.exec, changedFiles)),
  )
}
