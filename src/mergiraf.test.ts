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

describe('installMergiraf on linux/x64', () => {
  let binDir: string
  let binPath: string
  let calls: ExecCall[]
  let result: string

  beforeEach(async () => {
    stubPlatform('linux', 'x64')
    binDir = join(fakeHome, '.local', 'bin')
    binPath = join(binDir, 'mergiraf')
    const fake = createFakeExec(binPath)
    calls = fake.calls
    result = await installMergiraf(fake.exec)
  })

  it('returns the installed binary path', () => {
    expect(result).toBe(binPath)
  })

  it('marks the binary as executable', async () => {
    const mode = (await stat(binPath)).mode & 0o777
    expect(mode).toBe(0o755)
  })

  it('prepends the bin directory to PATH', () => {
    expect(vi.mocked(addPath).mock.calls).toEqual([[binDir]])
  })

  it('fetches the asset via curl piped into tar', () => {
    const url = `https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/mergiraf_x86_64-unknown-linux-gnu.tar.gz`
    expect(calls).toEqual([
      {
        commandLine: 'bash',
        args: [
          '-c',
          `set -euo pipefail; curl -fsSL "${url}" | tar -xz -C "${binDir}"`,
        ],
      },
    ])
  })
})

describe('installMergiraf on an unsupported platform', () => {
  beforeEach(() => {
    stubPlatform('darwin', 'arm64')
  })

  const run = async (): Promise<string> => {
    const binPath = join(fakeHome, '.local', 'bin', 'mergiraf')
    const { exec } = createFakeExec(binPath)
    try {
      await installMergiraf(exec)
      return ''
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  it('rejects with a message naming the platform', async () => {
    expect(await run()).toBe(
      'mergiraf: unsupported platform darwin/arm64 (only linux/x64 is supported)',
    )
  })

  it('does not create the bin directory', async () => {
    await run()
    expect(await pathExists(join(fakeHome, '.local', 'bin'))).toBe(false)
  })

  it('does not modify PATH', async () => {
    await run()
    expect(vi.mocked(addPath).mock.calls).toEqual([])
  })
})
