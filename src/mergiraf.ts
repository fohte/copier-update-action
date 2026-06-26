import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as core from '@actions/core'
import type { ExecOptions } from '@actions/exec'

export type Exec = (
  commandLine: string,
  args?: string[],
  options?: ExecOptions,
) => Promise<number>

// renovate: datasource=github-releases depName=mergiraf/mergiraf
export const MERGIRAF_VERSION = 'v0.17.0'

const ASSET = 'mergiraf_x86_64-unknown-linux-gnu.tar.gz'

export async function installMergiraf(exec: Exec): Promise<string> {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(
      `mergiraf: unsupported platform ${process.platform}/${process.arch} (only linux/x64 is supported)`,
    )
  }

  const binDir = path.join(os.homedir(), '.local', 'bin')
  const binPath = path.join(binDir, 'mergiraf')
  const url = `https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/${ASSET}`

  await fs.mkdir(binDir, { recursive: true })
  await exec('bash', [
    '-c',
    `set -euo pipefail; curl -fsSL "${url}" | tar -xz -C "${binDir}"`,
  ])
  await fs.chmod(binPath, 0o755)
  core.addPath(binDir)

  return binPath
}
