import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

import * as core from '@actions/core'
import { Result } from 'neverthrow'

import { resolveVersionConflicts } from '#version-conflict'

const CONFLICT_MARKER = '<<<<<<< before updating'

// mergiraf defaults --keep-backup to true, writing a `<file>.orig` copy of
// the pre-resolution content that is never cleaned up and ends up committed
// by the workflow's `git add -A` step.
const runMergiraf = Result.fromThrowable(
  (mergirafBin: string, filePath: string) =>
    execFileSync(mergirafBin, ['solve', filePath, '--keep-backup=false'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    }),
  (caught: unknown) => caught,
)

const readConflictFile = Result.fromThrowable(
  (filePath: string) => readFileSync(filePath, 'utf8'),
  (caught: unknown) => caught,
)

const writeConflictFile = Result.fromThrowable(
  (filePath: string, content: string) => {
    writeFileSync(filePath, content)
  },
  (caught: unknown) => caught,
)

function resolveFile(filePath: string, mergirafBin: string): void {
  let exitStatus = 0
  const solveResult = runMergiraf(mergirafBin, filePath)
  if (solveResult.isErr()) {
    const caught = solveResult.error
    const status =
      caught !== null &&
      typeof caught === 'object' &&
      'status' in caught &&
      typeof caught.status === 'number'
        ? caught.status
        : undefined
    // Exit 1 = mergiraf could not process the file (e.g. unsupported language
    // for the file extension). Exit 2 = partial resolution; mergiraf rewrote
    // the file in place with conflict markers still surrounding the regions
    // it could not solve. Both are expected outcomes — the marker-presence
    // check below decides whether the file is resolved.
    if (status !== 1 && status !== 2) {
      const stderr =
        caught !== null && typeof caught === 'object' && 'stderr' in caught
          ? String(caught.stderr).trim()
          : ''
      const detail = caught instanceof Error ? caught.message : String(caught)
      core.warning(
        stderr === ''
          ? `mergiraf solve failed: ${detail}`
          : `mergiraf solve failed: ${detail}\n${stderr}`,
      )
    }
    exitStatus = status ?? -1
  }

  // Any I/O failure here (permissions changed, file removed, etc.) must stay
  // local to this file so the caller can keep processing the rest of the
  // conflict list. Surface it as a warning annotation and move on.
  const readResult = readConflictFile(filePath)
  if (readResult.isErr()) {
    const caught = readResult.error
    const detail = caught instanceof Error ? caught.message : String(caught)
    core.warning(`failed to read ${filePath} after mergiraf: ${detail}`)
    return
  }
  let content = readResult.value

  if (content.includes(CONFLICT_MARKER)) {
    const { content: resolved, resolvedCount } =
      resolveVersionConflicts(content)
    if (resolved !== content) {
      const writeResult = writeConflictFile(filePath, resolved)
      if (writeResult.isErr()) {
        // Same rationale as the read above: keep the failure local to this
        // file rather than aborting the rest of the conflict list. `content`
        // is left at its pre-write value since the file on disk was not
        // actually updated.
        const caught = writeResult.error
        const detail = caught instanceof Error ? caught.message : String(caught)
        core.warning(
          `failed to write ${filePath} after version-conflict resolution: ${detail}`,
        )
      } else {
        content = resolved
        if (resolvedCount > 0) {
          core.info('resolved a version-only conflict via semver comparison')
        }
      }
    }
  }

  if (content.includes(CONFLICT_MARKER)) {
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
    resolveFile(filePath, mergirafBin)
    core.endGroup()
  }
  return Promise.resolve()
}
