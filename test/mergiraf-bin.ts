import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { err, ok, type Result } from 'neverthrow'

import { MERGIRAF_VERSION } from '#mergiraf'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = resolve(
  REPO_ROOT,
  'node_modules',
  '.cache',
  'mergiraf',
  MERGIRAF_VERSION,
)

/** Absolute path to the mergiraf binary downloaded for tests. */
export const MERGIRAF_BIN_PATH = resolve(CACHE_DIR, 'mergiraf')

function assetForPlatform(): Result<string, Error> {
  const { platform, arch } = process
  if (platform === 'linux' && arch === 'x64') {
    return ok('mergiraf_x86_64-unknown-linux-gnu.tar.gz')
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return ok('mergiraf_aarch64-apple-darwin.tar.gz')
  }
  if (platform === 'darwin' && arch === 'x64') {
    return ok('mergiraf_x86_64-apple-darwin.tar.gz')
  }
  return err(
    new Error(`mergiraf test setup: unsupported platform ${platform}/${arch}`),
  )
}

/**
 * Download the mergiraf binary if it is not yet cached.
 *
 * Idempotent: a present binary at MERGIRAF_BIN_PATH is taken as-is.
 */
export function ensureMergirafInstalled(): Result<void, Error> {
  if (existsSync(MERGIRAF_BIN_PATH)) return ok(undefined)
  const assetResult = assetForPlatform()
  if (assetResult.isErr()) {
    return err(assetResult.error)
  }
  mkdirSync(CACHE_DIR, { recursive: true })
  const url = `https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/${assetResult.value}`
  execFileSync(
    'bash',
    [
      '-c',
      `set -euo pipefail; curl -fsSL "${url}" | tar -xz -C "${CACHE_DIR}"`,
    ],
    { stdio: 'inherit' },
  )
  chmodSync(MERGIRAF_BIN_PATH, 0o755)
  return ok(undefined)
}
