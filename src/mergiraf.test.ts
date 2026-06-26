import * as os from 'node:os'
import * as path from 'node:path'

import * as core from '@actions/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Exec, installMergiraf, MERGIRAF_VERSION } from '@/mergiraf'

vi.mock('@actions/core', () => ({
  addPath: vi.fn(),
}))

interface ExecCall {
  commandLine: string
  args: string[]
}

const createFakeExec = (): { exec: Exec; calls: ExecCall[] } => {
  const calls: ExecCall[] = []
  const exec: Exec = (commandLine, args = []) => {
    calls.push({ commandLine, args })
    return Promise.resolve(0)
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

describe('installMergiraf', () => {
  const home = os.homedir()
  const binDir = path.join(home, '.local', 'bin')
  const binPath = path.join(binDir, 'mergiraf')
  const url = `https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/mergiraf_x86_64-unknown-linux-gnu.tar.gz`

  const originalPlatform = process.platform
  const originalArch = process.arch

  beforeEach(() => {
    vi.mocked(core.addPath).mockClear()
  })

  afterEach(() => {
    stubPlatform(originalPlatform, originalArch)
  })

  it('installs mergiraf into ~/.local/bin and exposes the directory on PATH', async () => {
    stubPlatform('linux', 'x64')
    const { exec, calls } = createFakeExec()

    const result = await installMergiraf(exec)

    expect({
      result,
      calls,
      addPathArgs: vi.mocked(core.addPath).mock.calls,
    }).toEqual({
      result: binPath,
      calls: [
        { commandLine: 'mkdir', args: ['-p', binDir] },
        {
          commandLine: 'bash',
          args: [
            '-c',
            `set -euo pipefail; curl -fsSL "${url}" | tar -xz -C "${binDir}"`,
          ],
        },
        { commandLine: 'chmod', args: ['+x', binPath] },
      ],
      addPathArgs: [[binDir]],
    })
  })

  it('rejects on unsupported platform without invoking exec or PATH side effects', async () => {
    stubPlatform('darwin', 'arm64')
    const { exec, calls } = createFakeExec()

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
      addPathArgs: vi.mocked(core.addPath).mock.calls,
    }).toEqual({
      result: {
        ok: false,
        message:
          'mergiraf: unsupported platform darwin/arm64 (only linux/x64 is supported)',
      },
      calls: [],
      addPathArgs: [],
    })
  })
})
