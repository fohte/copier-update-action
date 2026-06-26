import { mkdtempSync, rmSync } from 'node:fs'
import { stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { addPath } from '@actions/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Exec, installMergiraf, MERGIRAF_VERSION } from '@/mergiraf'

vi.mock('@actions/core', () => ({
  addPath: vi.fn(),
}))

interface ExecCall {
  commandLine: string
  args: string[]
}

const createFakeExec = (
  binPathToCreate: string,
): { exec: Exec; calls: ExecCall[] } => {
  const calls: ExecCall[] = []
  const exec: Exec = async (commandLine, args = []) => {
    calls.push({ commandLine, args })
    if (commandLine === 'bash') {
      await writeFile(binPathToCreate, '')
    }
    return 0
  }
  return { exec, calls }
}

const stubPlatform = (platform: NodeJS.Platform, arch: string): void => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  })
  Object.defineProperty(process, 'arch', { value: arch, configurable: true })
}

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

describe('installMergiraf', () => {
  const originalHome = process.env['HOME']
  const originalPlatform = process.platform
  const originalArch = process.arch

  let fakeHome: string

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'mergiraf-test-'))
    process.env['HOME'] = fakeHome
    vi.mocked(addPath).mockClear()
  })

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true })
    process.env['HOME'] = originalHome
    stubPlatform(originalPlatform, originalArch)
  })

  it('installs mergiraf into ~/.local/bin and exposes the directory on PATH', async () => {
    stubPlatform('linux', 'x64')
    const binDir = join(fakeHome, '.local', 'bin')
    const binPath = join(binDir, 'mergiraf')
    const url = `https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/mergiraf_x86_64-unknown-linux-gnu.tar.gz`
    const { exec, calls } = createFakeExec(binPath)

    const result = await installMergiraf(exec)

    expect({
      result,
      calls,
      addPathArgs: vi.mocked(addPath).mock.calls,
      binDirExists: await pathExists(binDir),
      binPathMode: (await stat(binPath)).mode & 0o777,
    }).toEqual({
      result: binPath,
      calls: [
        {
          commandLine: 'bash',
          args: [
            '-c',
            `set -euo pipefail; curl -fsSL "${url}" | tar -xz -C "${binDir}"`,
          ],
        },
      ],
      addPathArgs: [[binDir]],
      binDirExists: true,
      binPathMode: 0o755,
    })
  })

  it('rejects on unsupported platform without touching the filesystem or PATH', async () => {
    stubPlatform('darwin', 'arm64')
    const binDir = join(fakeHome, '.local', 'bin')
    const binPath = join(binDir, 'mergiraf')
    const { exec, calls } = createFakeExec(binPath)

    const result = await installMergiraf(exec).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      }),
    )

    expect({
      result,
      calls,
      addPathArgs: vi.mocked(addPath).mock.calls,
      binDirExists: await pathExists(binDir),
    }).toEqual({
      result: {
        ok: false,
        message:
          'mergiraf: unsupported platform darwin/arm64 (only linux/x64 is supported)',
      },
      calls: [],
      addPathArgs: [],
      binDirExists: false,
    })
  })
})
