import { err, ok, type Result } from 'neverthrow'

import type { Exec } from '#exec'

export type { Exec } from '#exec'

const CONFLICT_MARKER = '<<<<<<< before updating'

// git grep has no --line-regexp flag, so line-anchoring requires a regex
// pattern instead of -F. CONFLICT_MARKER has no ERE metacharacters, so it's
// safe to interpolate directly. The trailing \r tolerates a CRLF working
// tree: git's regex engine, unlike JS, doesn't treat \r as a line terminator
// for $, so a bare $ would miss CRLF-terminated marker lines.
const CONFLICT_MARKER_LINE_PATTERN = `^${CONFLICT_MARKER}\r?$`

export async function detectConflicts(
  exec: Exec,
  paths: string[],
): Promise<Result<string[], Error>> {
  if (paths.length === 0) {
    return ok([])
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
      '-E',
      '-lz',
      CONFLICT_MARKER_LINE_PATTERN,
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
