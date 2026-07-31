import { mkdtempSync, rmSync } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { restoreCache, saveCache } from '@actions/cache'
import { addPath, warning } from '@actions/core'
import { ok, type Result } from 'neverthrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Exec, installMergiraf, MERGIRAF_VERSION } from '#mergiraf'

vi.mock('@actions/core', () => ({
  addPath: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@actions/cache', () => ({
  restoreCache: vi.fn(),
  saveCache: vi.fn(),
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
  vi.mocked(warning).mockClear()
  vi.mocked(restoreCache).mockReset().mockResolvedValue(undefined)
  vi.mocked(saveCache).mockReset().mockResolvedValue(0)
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
  let result: Result<string, Error>

  beforeEach(async () => {
    stubPlatform('linux', 'x64')
    binDir = join(fakeHome, '.local', 'bin')
    binPath = join(binDir, 'mergiraf')
    vi.mocked(restoreCache).mockResolvedValue(undefined)
    const fake = createFakeExec(binPath)
    calls = fake.calls
    result = await installMergiraf(fake.exec)
  })

  it('returns the installed binary path', () => {
    expect(result).toEqual(ok(binPath))
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

  it('looks up the cache using a version- and platform-scoped key', () => {
    expect(vi.mocked(restoreCache).mock.calls).toEqual([
      [[binPath], `mergiraf-${MERGIRAF_VERSION}-linux-x64`],
    ])
  })

  it('saves the downloaded binary to the cache', () => {
    expect(vi.mocked(saveCache).mock.calls).toEqual([
      [[binPath], `mergiraf-${MERGIRAF_VERSION}-linux-x64`],
    ])
  })
})

describe('installMergiraf with a cache hit', () => {
  let binDir: string
  let binPath: string
  let calls: ExecCall[]
  let result: Result<string, Error>

  beforeEach(async () => {
    stubPlatform('linux', 'x64')
    binDir = join(fakeHome, '.local', 'bin')
    binPath = join(binDir, 'mergiraf')
    await mkdir(binDir, { recursive: true })
    await writeFile(binPath, '')
    vi.mocked(restoreCache).mockResolvedValue(
      `mergiraf-${MERGIRAF_VERSION}-linux-x64`,
    )
    const fake = createFakeExec(binPath)
    calls = fake.calls
    result = await installMergiraf(fake.exec)
  })

  it('returns the installed binary path', () => {
    expect(result).toEqual(ok(binPath))
  })

  it('does not run the download command', () => {
    expect(calls).toEqual([])
  })

  it('does not save to the cache again', () => {
    expect(vi.mocked(saveCache).mock.calls).toEqual([])
  })
})

describe('installMergiraf when restoreCache fails', () => {
  let binDir: string
  let binPath: string
  let calls: ExecCall[]
  let result: Result<string, Error>

  beforeEach(async () => {
    stubPlatform('linux', 'x64')
    binDir = join(fakeHome, '.local', 'bin')
    binPath = join(binDir, 'mergiraf')
    vi.mocked(restoreCache).mockRejectedValue(
      new Error('cache service unavailable'),
    )
    const fake = createFakeExec(binPath)
    calls = fake.calls
    result = await installMergiraf(fake.exec)
  })

  it('falls back to downloading the binary', () => {
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

  it('returns the installed binary path', () => {
    expect(result).toEqual(ok(binPath))
  })

  it('logs a warning naming the cache failure', () => {
    expect(vi.mocked(warning).mock.calls).toEqual([
      [
        'mergiraf: failed to restore cache, falling back to download: cache service unavailable',
      ],
    ])
  })
})

describe('installMergiraf when saveCache fails', () => {
  let binPath: string
  let result: Result<string, Error>

  beforeEach(async () => {
    stubPlatform('linux', 'x64')
    const binDir = join(fakeHome, '.local', 'bin')
    binPath = join(binDir, 'mergiraf')
    vi.mocked(saveCache).mockRejectedValue(new Error('cache upload rejected'))
    const fake = createFakeExec(binPath)
    result = await installMergiraf(fake.exec)
  })

  it('returns the installed binary path', () => {
    expect(result).toEqual(ok(binPath))
  })

  it('logs a warning naming the cache failure', () => {
    expect(vi.mocked(warning).mock.calls).toEqual([
      ['mergiraf: failed to save cache: cache upload rejected'],
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
    const result = await installMergiraf(exec)
    return result.isErr() ? result.error.message : ''
  }

  it('returns an error naming the platform', async () => {
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
