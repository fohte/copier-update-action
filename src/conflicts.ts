import { err, ok, type Result } from 'neverthrow'

import type { Exec } from '#exec'

export type { Exec } from '#exec'

const CONFLICT_MARKER = '<<<<<<< before updating'

export async function detectConflicts(
  exec: Exec,
): Promise<Result<string[], Error>> {
  const chunks: Buffer[] = []
  const exitCode = await exec(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'grep',
      '--untracked',
      '-I',
      '-F',
      '-lz',
      CONFLICT_MARKER,
    ],
    {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          chunks.push(data)
        },
      },
    },
  )

  if (exitCode === 1) {
    return ok([])
  }
  if (exitCode !== 0) {
    return err(new Error(`git grep failed with exit code ${String(exitCode)}`))
  }

  return ok(
    Buffer.concat(chunks)
      .toString('utf8')
      .split('\0')
      .filter((line) => line.length > 0),
  )
}
