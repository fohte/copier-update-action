import { describe, expect, it, vi } from 'vitest'

import { type Exec, resolveTargetVersion } from '@/target-version'

interface NormalizedCall {
  commandLine: string
  args: string[] | undefined
  env: Record<string, string | undefined>
  envMergesProcessEnv: boolean
  hasStdoutListener: boolean
  optionKeys: string[]
}

const recordingExec = (
  behavior: (commandLine: string) => { exitCode: number; stdout?: string },
): { exec: Exec; calls: NormalizedCall[] } => {
  const calls: NormalizedCall[] = []
  const exec: Exec = (commandLine, args, options) => {
    const env = options?.env ?? {}
    const interestingEnvKeys = ['GH_TOKEN']
    const reducedEnv: Record<string, string | undefined> = {}
    for (const key of interestingEnvKeys) {
      reducedEnv[key] = env[key]
    }

    calls.push({
      commandLine,
      args,
      env: reducedEnv,
      envMergesProcessEnv:
        process.env['PATH'] !== undefined &&
        env['PATH'] === process.env['PATH'],
      hasStdoutListener: typeof options?.listeners?.stdout === 'function',
      optionKeys: options ? Object.keys(options).sort() : [],
    })

    const { exitCode, stdout } = behavior(commandLine)
    if (stdout !== undefined && options?.listeners?.stdout) {
      options.listeners.stdout(Buffer.from(stdout))
    }
    return Promise.resolve(exitCode)
  }
  return { exec, calls }
}

describe('resolveTargetVersion', () => {
  it('returns the input as-is when targetVersion is non-empty without invoking exec', async () => {
    const { exec, calls } = recordingExec(() => ({ exitCode: 0 }))

    const result = await resolveTargetVersion(
      {
        templateRepo: 'owner/repo',
        targetVersion: 'v9.9.9',
        githubToken: 'token',
      },
      exec,
    )

    expect({ result, calls }).toEqual({
      result: 'v9.9.9',
      calls: [],
    })
  })

  it('resolves the latest tag via gh CLI and trims the trailing newline', async () => {
    const { exec, calls } = recordingExec(() => ({
      exitCode: 0,
      stdout: 'v1.2.3\n',
    }))

    const result = await resolveTargetVersion(
      {
        templateRepo: 'owner/repo',
        targetVersion: '',
        githubToken: 'token-abc',
      },
      exec,
    )

    expect({ result, calls }).toEqual({
      result: 'v1.2.3',
      calls: [
        {
          commandLine: 'gh',
          args: [
            'release',
            'view',
            '--repo',
            'owner/repo',
            '--json',
            'tagName',
            '--jq',
            '.tagName',
          ],
          env: { GH_TOKEN: 'token-abc' },
          envMergesProcessEnv: true,
          hasStdoutListener: true,
          optionKeys: ['env', 'listeners'],
        },
      ],
    })
  })

  it('throws when gh exits non-zero', async () => {
    const error = new Error('gh: command failed with exit code 1')
    const exec = vi.fn<Exec>().mockRejectedValue(error)

    await expect(
      resolveTargetVersion(
        {
          templateRepo: 'owner/repo',
          targetVersion: '',
          githubToken: 'token',
        },
        exec,
      ),
    ).rejects.toBe(error)
  })
})
