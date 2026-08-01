import * as core from '@actions/core'
import { err, ok, type Result } from 'neverthrow'

import { detectConflicts } from '#conflicts'
import type { Exec } from '#exec'

export type { Exec } from '#exec'

export async function writeOutputs(
  exec: Exec,
  changedFiles: string[],
): Promise<Result<void, Error>> {
  core.setOutput('changed', changedFiles.length > 0 ? 'true' : 'false')

  const unresolvedResult = await detectConflicts(exec, changedFiles)
  if (unresolvedResult.isErr()) {
    return err(unresolvedResult.error)
  }
  core.setOutput('unresolved-files', unresolvedResult.value.join('\n'))
  return ok(undefined)
}
