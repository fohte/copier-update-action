import * as core from '@actions/core'

import { detectConflicts } from '@/conflicts'
import type { Exec } from '@/exec'
import { getChangedFiles } from '@/git'

export type { Exec } from '@/exec'

export async function writeOutputs(exec: Exec): Promise<void> {
  const changedFiles = await getChangedFiles(exec)
  core.setOutput('changed', changedFiles.length > 0 ? 'true' : 'false')

  const unresolved = await detectConflicts(exec, changedFiles)
  core.setOutput('unresolved-files', unresolved.join('\n'))
}
