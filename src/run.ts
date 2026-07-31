import * as core from '@actions/core'
import { exec as actionsExec } from '@actions/exec'
import { getOctokit } from '@actions/github'
import type { Result } from 'neverthrow'

import { detectConflicts as defaultDetectConflicts } from '#conflicts'
import {
  configureDiff3 as defaultConfigureDiff3,
  runCopierUpdate as defaultRunCopierUpdate,
} from '#copier'
import type { Exec } from '#exec'
import { getChangedFiles as defaultGetChangedFiles } from '#git'
import {
  type Inputs,
  readInputs as defaultReadInputs,
  validateInputs as defaultValidateInputs,
} from '#inputs'
import { installMergiraf as defaultInstallMergiraf } from '#mergiraf'
import { writeOutputs as defaultWriteOutputs } from '#outputs'
import { resolveConflicts as defaultResolveConflicts } from '#per-block-resolve'
import {
  type GetLatestRelease,
  resolveTargetVersion as defaultResolveTargetVersion,
} from '#target-version'

export type { Exec } from '#exec'

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
  runCopierUpdate: (
    args: { targetVersion: string; copierVersion: string },
    exec: Exec,
  ) => Promise<void>
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

const defaultGetLatestReleaseFactory =
  (token: string): GetLatestRelease =>
  ({ owner, repo }) =>
    getOctokit(token).rest.repos.getLatestRelease({ owner, repo })

function withGroup<T>(name: string, fn: () => Promise<T>): Promise<T> {
  core.startGroup(name)
  return fn().finally(() => {
    core.endGroup()
  })
}

function unwrapOrReject<T>(result: Result<T, Error>): Promise<T> {
  return result.isErr()
    ? Promise.reject(result.error)
    : Promise.resolve(result.value)
}

export async function runWithDeps(deps: RunDeps): Promise<void> {
  const inputs = await withGroup('Read inputs', () => {
    const i = deps.readInputs()
    return unwrapOrReject(deps.validateInputs(i)).then(() => i)
  })

  const targetVersion = await withGroup('Resolve target version', async () => {
    const getLatestRelease = deps.getLatestReleaseFactory(inputs.githubToken)
    const v = await unwrapOrReject(
      await deps.resolveTargetVersion(inputs, getLatestRelease),
    )
    core.setOutput('target-version', v)
    return v
  })

  const mergirafBin = await withGroup('Install mergiraf', async () =>
    unwrapOrReject(await deps.installMergiraf(deps.exec)),
  )

  await withGroup('Configure git diff3', () => deps.configureDiff3(deps.exec))

  await withGroup('Run copier update', () =>
    deps.runCopierUpdate(
      { targetVersion, copierVersion: inputs.copierVersion },
      deps.exec,
    ),
  )

  const { changedFiles, conflictFiles } = await withGroup(
    'Detect conflicts',
    async () => {
      const changed = await unwrapOrReject(
        await deps.getChangedFiles(deps.exec),
      )
      const files = await unwrapOrReject(
        await deps.detectConflicts(deps.exec, changed),
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

  await withGroup('Write outputs', async () =>
    unwrapOrReject(await deps.writeOutputs(deps.exec, changedFiles)),
  )
}

export async function run(exec?: Exec): Promise<void> {
  await runWithDeps({
    exec: exec ?? actionsExec,
    readInputs: defaultReadInputs,
    validateInputs: defaultValidateInputs,
    getLatestReleaseFactory: defaultGetLatestReleaseFactory,
    resolveTargetVersion: defaultResolveTargetVersion,
    installMergiraf: defaultInstallMergiraf,
    configureDiff3: defaultConfigureDiff3,
    runCopierUpdate: defaultRunCopierUpdate,
    getChangedFiles: defaultGetChangedFiles,
    detectConflicts: defaultDetectConflicts,
    resolveConflicts: defaultResolveConflicts,
    writeOutputs: defaultWriteOutputs,
  })
}
