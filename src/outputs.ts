import * as core from '@actions/core'

import { detectConflicts } from '@/conflicts'
import type { Exec } from '@/exec'

export type { Exec } from '@/exec'

export async function writeOutputs(
  exec: Exec,
  changedFiles: string[],
): Promise<void> {
  core.setOutput('changed', changedFiles.length > 0 ? 'true' : 'false')

  const unresolved = await detectConflicts(exec, changedFiles)
  core.setOutput('unresolved-files', unresolved.join('\n'))
}
