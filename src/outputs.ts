import * as core from '@actions/core'

import { detectConflicts } from '@/conflicts'
import type { Exec } from '@/exec'

export type { Exec } from '@/exec'

export async function writeOutputs(exec: Exec): Promise<void> {
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
    throw new Error(
      `git status --porcelain failed with exit code ${String(statusExitCode)}`,
    )
  }
  const changed = Buffer.concat(chunks).length > 0
  core.setOutput('changed', changed ? 'true' : 'false')

  const unresolved = await detectConflicts(exec)
  core.setOutput('unresolved-files', unresolved.join('\n'))
}
