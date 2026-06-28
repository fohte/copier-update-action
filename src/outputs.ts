import * as core from '@actions/core'

import { detectConflicts } from '@/conflicts'
import type { Exec } from '@/exec'

export type { Exec } from '@/exec'

export async function writeOutputs(exec: Exec): Promise<void> {
  const diffExitCode = await exec('git', ['diff', '--quiet', 'HEAD', '--'], {
    ignoreReturnCode: true,
  })
  if (diffExitCode !== 0 && diffExitCode !== 1) {
    throw new Error(
      `git diff --quiet HEAD -- failed with exit code ${String(diffExitCode)}`,
    )
  }
  core.setOutput('changed', diffExitCode === 1 ? 'true' : 'false')

  const unresolved = await detectConflicts(exec)
  core.setOutput('unresolved-files', unresolved.join('\n'))
}
