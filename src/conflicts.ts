import type { Exec } from '@/exec'

export type { Exec } from '@/exec'

const CONFLICT_MARKER = '<<<<<<< before updating'

export async function detectConflicts(
  exec: Exec,
  paths: string[],
): Promise<string[]> {
  if (paths.length === 0) {
    return []
  }

  const chunks: Buffer[] = []
  const exitCode = await exec(
    'git',
    [
      '-c',
      'core.quotePath=false',
      '--literal-pathspecs',
      'grep',
      '--untracked',
      '-I',
      '-F',
      '-lz',
      CONFLICT_MARKER,
      '--',
      ...paths,
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
    return []
  }
  if (exitCode !== 0) {
    throw new Error(`git grep failed with exit code ${String(exitCode)}`)
  }

  return Buffer.concat(chunks)
    .toString('utf8')
    .split('\0')
    .filter((line) => line.length > 0)
}
