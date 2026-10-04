import { exec as actionsExec } from '@actions/exec'
import { getOctokit } from '@actions/github'

import { detectConflicts as defaultDetectConflicts } from '#conflicts'
import {
  configureDiff3 as defaultConfigureDiff3,
  runCopierUpdate as defaultRunCopierUpdate,
} from '#copier'
import type { Exec } from '#exec'
import { getChangedFiles as defaultGetChangedFiles } from '#git'
import {
  readInputs as defaultReadInputs,
  validateInputs as defaultValidateInputs,
} from '#inputs'
import { installMergiraf as defaultInstallMergiraf } from '#mergiraf'
import { writeOutputs as defaultWriteOutputs } from '#outputs'
import { resolveConflicts as defaultResolveConflicts } from '#per-block-resolve'
import { runWithDeps } from '#run-with-deps'
import {
  type GetLatestRelease,
  resolveTargetVersion as defaultResolveTargetVersion,
} from '#target-version'

const defaultGetLatestReleaseFactory =
  (token: string): GetLatestRelease =>
  ({ owner, repo }) =>
    getOctokit(token).rest.repos.getLatestRelease({ owner, repo })

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
