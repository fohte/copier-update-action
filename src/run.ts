import * as core from '@actions/core'
import { exec as actionsExec, type ExecOptions } from '@actions/exec'
import { getOctokit } from '@actions/github'

import { detectConflicts as defaultDetectConflicts } from '@/conflicts'
import {
  configureDiff3 as defaultConfigureDiff3,
  runCopierUpdate as defaultRunCopierUpdate,
} from '@/copier'
import {
  type Inputs,
  readInputs as defaultReadInputs,
  validateInputs as defaultValidateInputs,
} from '@/inputs'
import { installMergiraf as defaultInstallMergiraf } from '@/mergiraf'
import { writeOutputs as defaultWriteOutputs } from '@/outputs'
import { resolveConflicts as defaultResolveConflicts } from '@/per-block-resolve'
import {
  type GetLatestRelease,
  resolveTargetVersion as defaultResolveTargetVersion,
} from '@/target-version'

export type Exec = (
  commandLine: string,
  args?: string[],
  options?: ExecOptions,
) => Promise<number>

export interface RunDeps {
  exec: Exec
  readInputs: () => Inputs
  validateInputs: (inputs: Inputs) => void
  getLatestReleaseFactory: (token: string) => GetLatestRelease
  resolveTargetVersion: (
    inputs: Pick<Inputs, 'templateRepo' | 'targetVersion'>,
    getLatestRelease: GetLatestRelease,
  ) => Promise<string>
  installMergiraf: (exec: Exec) => Promise<string>
  configureDiff3: (exec: Exec) => Promise<void>
  runCopierUpdate: (
    args: { targetVersion: string; copierVersion: string },
    exec: Exec,
  ) => Promise<void>
  detectConflicts: (exec: Exec) => Promise<string[]>
  resolveConflicts: (filePaths: string[], mergirafBin: string) => Promise<void>
  writeOutputs: (exec: Exec) => Promise<void>
}

const defaultGetLatestReleaseFactory =
  (token: string): GetLatestRelease =>
  ({ owner, repo }) =>
    getOctokit(token).rest.repos.getLatestRelease({ owner, repo })

export async function runWithDeps(deps: RunDeps): Promise<void> {
  core.startGroup('Read inputs')
  let inputs: Inputs
  try {
    inputs = deps.readInputs()
    deps.validateInputs(inputs)
  } finally {
    core.endGroup()
  }

  core.startGroup('Resolve target version')
  let targetVersion: string
  try {
    const getLatestRelease = deps.getLatestReleaseFactory(inputs.githubToken)
    targetVersion = await deps.resolveTargetVersion(inputs, getLatestRelease)
    core.setOutput('target-version', targetVersion)
  } finally {
    core.endGroup()
  }

  core.startGroup('Install mergiraf')
  let mergirafBin: string
  try {
    mergirafBin = await deps.installMergiraf(deps.exec)
  } finally {
    core.endGroup()
  }

  core.startGroup('Configure git diff3')
  try {
    await deps.configureDiff3(deps.exec)
  } finally {
    core.endGroup()
  }

  core.startGroup('Run copier update')
  try {
    await deps.runCopierUpdate(
      { targetVersion, copierVersion: inputs.copierVersion },
      deps.exec,
    )
  } finally {
    core.endGroup()
  }

  core.startGroup('Detect conflicts')
  let conflictFiles: string[]
  try {
    conflictFiles = await deps.detectConflicts(deps.exec)
    core.info(`detected ${String(conflictFiles.length)} conflict file(s)`)
  } finally {
    core.endGroup()
  }

  if (conflictFiles.length > 0) {
    core.startGroup('Resolve conflicts')
    try {
      await deps.resolveConflicts(conflictFiles, mergirafBin)
    } finally {
      core.endGroup()
    }
  }

  core.startGroup('Write outputs')
  try {
    await deps.writeOutputs(deps.exec)
  } finally {
    core.endGroup()
  }
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
    detectConflicts: defaultDetectConflicts,
    resolveConflicts: defaultResolveConflicts,
    writeOutputs: defaultWriteOutputs,
  })
}
