import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import * as core from '@actions/core'

const CONFLICT_MARKER = '<<<<<<< before updating'

function resolveFile(filePath: string, mergirafBin: string): void {
  let exitStatus = 0
  try {
    // mergiraf defaults --keep-backup to true, writing a `<file>.orig` copy
    // of the pre-resolution content that is never cleaned up and ends up
    // committed by the workflow's `git add -A` step.
    execFileSync(mergirafBin, ['solve', filePath, '--keep-backup=false'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
  } catch (err) {
    const status =
      err !== null &&
      typeof err === 'object' &&
      'status' in err &&
      typeof err.status === 'number'
        ? err.status
        : undefined
    // Exit 1 = mergiraf could not process the file (e.g. unsupported language
    // for the file extension). Exit 2 = partial resolution; mergiraf rewrote
    // the file in place with conflict markers still surrounding the regions
    // it could not solve. Both are expected outcomes — the marker-presence
    // check below decides whether the file is resolved.
    if (status !== 1 && status !== 2) {
      const stderr =
        err !== null && typeof err === 'object' && 'stderr' in err
          ? String(err.stderr).trim()
          : ''
      const detail = err instanceof Error ? err.message : String(err)
      core.warning(
        stderr === ''
          ? `mergiraf solve failed: ${detail}`
          : `mergiraf solve failed: ${detail}\n${stderr}`,
      )
    }
    exitStatus = status ?? -1
  }

  let hasMarker: boolean
  try {
    hasMarker = readFileSync(filePath, 'utf8').includes(CONFLICT_MARKER)
  } catch (err) {
    // Any I/O failure here (permissions changed, file removed, etc.) must
    // stay local to this file so the caller can keep processing the rest of
    // the conflict list. Surface it as a warning annotation and move on.
    const detail = err instanceof Error ? err.message : String(err)
    core.warning(`failed to read ${filePath} after mergiraf: ${detail}`)
    return
  }
  if (hasMarker) {
    // Include the exit status so callers can distinguish "mergiraf gave up
    // without touching the file" (exit 1) from "mergiraf resolved some blocks
    // but left the rest as smaller markers" (exit 2).
    core.info(
      `unresolved: conflict markers remain (mergiraf exit ${String(exitStatus)})`,
    )
  } else {
    core.info('resolved')
  }
}

export function resolveConflicts(
  filePaths: string[],
  mergirafBin: string,
): Promise<void> {
  for (const filePath of filePaths) {
    core.startGroup(filePath)
    try {
      resolveFile(filePath, mergirafBin)
    } finally {
      core.endGroup()
    }
  }
  return Promise.resolve()
}
