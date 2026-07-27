import * as core from '@actions/core'
import { err, ok, type Result } from 'neverthrow'

import { detectConflicts } from '#conflicts'
import type { Exec } from '#exec'

export type { Exec } from '#exec'

export async function writeOutputs(exec: Exec): Promise<Result<void, Error>> {
  const chunks: Buffer[] = []
  const statusExitCode = await exec(
    'git',
    ['status', '--porcelain', '-z', '--untracked-files=all'],
    {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          chunks.push(data)
        },
      },
    },
  )
  if (statusExitCode !== 0) {
    return err(
      new Error(
        `git status --porcelain failed with exit code ${String(statusExitCode)}`,
      ),
    )
  }
  const changed = Buffer.concat(chunks).length > 0
  core.setOutput('changed', changed ? 'true' : 'false')

  const unresolvedResult = await detectConflicts(exec)
  if (unresolvedResult.isErr()) {
    return err(unresolvedResult.error)
  }
  core.setOutput('unresolved-files', unresolvedResult.value.join('\n'))
  return ok(undefined)
}
