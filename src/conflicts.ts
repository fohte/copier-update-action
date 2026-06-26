import type { ExecOptions } from '@actions/exec'

export type Exec = (
  commandLine: string,
  args?: string[],
  options?: ExecOptions,
) => Promise<number>

const CONFLICT_MARKER = '<<<<<<< before updating'

export async function detectConflicts(exec: Exec): Promise<string[]> {
  let stdout = ''
  const exitCode = await exec(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'grep',
      '--untracked',
      '-lz',
      CONFLICT_MARKER,
    ],
    {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
      },
    },
  )

  if (exitCode === 1) {
    return []
  }
  if (exitCode !== 0) {
    throw new Error(`git grep failed with exit code ${String(exitCode)}`)
  }

  return stdout.split('\0').filter((line) => line.length > 0)
}
