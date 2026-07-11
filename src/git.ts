import type { Exec } from '@/exec'

export type { Exec } from '@/exec'

export async function getChangedFiles(exec: Exec): Promise<string[]> {
  const chunks: Buffer[] = []
  const exitCode = await exec(
    'git',
    ['status', '--porcelain', '-z', '--untracked-files=all', '--no-renames'],
    {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          chunks.push(data)
        },
      },
    },
  )
  if (exitCode !== 0) {
    throw new Error(
      `git status --porcelain failed with exit code ${String(exitCode)}`,
    )
  }

  // Porcelain v1 entries are `XY PATH`; --no-renames guarantees one path per
  // NUL-terminated entry (renames would otherwise emit an extra old-path
  // entry after the new one).
  return Buffer.concat(chunks)
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.slice(3))
}
