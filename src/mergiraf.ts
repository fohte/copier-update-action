import { chmod, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import * as cache from '@actions/cache'
import * as core from '@actions/core'
import { err, ok, type Result, ResultAsync } from 'neverthrow'

import type { Exec } from '#exec'

export type { Exec } from '#exec'

// renovate: datasource=github-releases depName=mergiraf/mergiraf
export const MERGIRAF_VERSION = 'v0.17.0'

const ASSET = 'mergiraf_x86_64-unknown-linux-gnu.tar.gz'

function describeCaught(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught)
}

// The cache service can throw (e.g. a transient service outage); caching is
// an optimization, so any failure here must fall back to a normal download
// rather than failing the whole action.
async function warnOnCacheFailure<T>(
  promise: Promise<T>,
  failureMessage: string,
): Promise<Result<T, unknown>> {
  const result = await ResultAsync.fromPromise(
    promise,
    (caught: unknown) => caught,
  )

  if (result.isErr()) {
    core.warning(`mergiraf: ${failureMessage}: ${describeCaught(result.error)}`)
  }

  return result
}

async function restoreMergirafCache(
  binPath: string,
  cacheKey: string,
): Promise<boolean> {
  const result = await warnOnCacheFailure(
    cache.restoreCache([binPath], cacheKey),
    'failed to restore cache, falling back to download',
  )

  return result.isOk() && result.value !== undefined
}

async function saveMergirafCache(
  binPath: string,
  cacheKey: string,
): Promise<void> {
  await warnOnCacheFailure(
    cache.saveCache([binPath], cacheKey),
    'failed to save cache',
  )
}

export async function installMergiraf(
  exec: Exec,
): Promise<Result<string, Error>> {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    return err(
      new Error(
        `mergiraf: unsupported platform ${process.platform}/${process.arch} (only linux/x64 is supported)`,
      ),
    )
  }

  const binDir = join(homedir(), '.local', 'bin')
  const binPath = join(binDir, 'mergiraf')
  const url = `https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/${ASSET}`
  const cacheKey = `mergiraf-${MERGIRAF_VERSION}-${process.platform}-${process.arch}`

  await mkdir(binDir, { recursive: true })

  const cacheHit = await restoreMergirafCache(binPath, cacheKey)
  if (!cacheHit) {
    await exec('bash', [
      '-c',
      `set -euo pipefail; curl -fsSL "${url}" | tar -xz -C "${binDir}"`,
    ])
    await saveMergirafCache(binPath, cacheKey)
  }
  await chmod(binPath, 0o755)
  core.addPath(binDir)

  return ok(binPath)
}
