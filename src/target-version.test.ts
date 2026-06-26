import { describe, expect, it } from 'vitest'

import { type Exec, resolveTargetVersion } from '@/target-version'

interface NormalizedCall {
  commandLine: string
  args: string[] | undefined
  env: Record<string, string | undefined>
}

type ExecBehavior =
  | { kind: 'ok'; exitCode: number; stdout?: string }
  | { kind: 'reject'; error: Error }

const recordingExec = (
  behavior: () => ExecBehavior,
): { exec: Exec; calls: NormalizedCall[] } => {
  const calls: NormalizedCall[] = []
  const exec: Exec = (commandLine, args, options) => {
    const env = options?.env ?? {}
    calls.push({
      commandLine,
      args,
      env: { GH_TOKEN: env['GH_TOKEN'] },
    })

    const result = behavior()
    if (result.kind === 'reject') {
      return Promise.reject(result.error)
    }
    if (result.stdout !== undefined && options?.listeners?.stdout) {
      options.listeners.stdout(Buffer.from(result.stdout))
    }
    return Promise.resolve(result.exitCode)
  }
  return { exec, calls }
}

describe('resolveTargetVersion', () => {
  it('returns the input as-is when targetVersion is non-empty and does not invoke exec', async () => {
    const { exec, calls } = recordingExec(() => ({ kind: 'ok', exitCode: 0 }))

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
      kind: 'ok',
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
        },
      ],
    })
  })

  it('propagates the error when exec rejects', async () => {
    const error = new Error('gh: command failed')
    const { exec } = recordingExec(() => ({ kind: 'reject', error }))

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

  it('throws when gh exits successfully with empty stdout', async () => {
    const { exec } = recordingExec(() => ({
      kind: 'ok',
      exitCode: 0,
      stdout: '',
    }))

    const captured = await resolveTargetVersion(
      {
        templateRepo: 'owner/repo',
        targetVersion: '',
        githubToken: 'token',
      },
      exec,
    ).then(
      (value) => ({ kind: 'resolved' as const, value }),
      (error: unknown) => ({ kind: 'rejected' as const, error }),
    )

    expect(captured).toEqual({
      kind: 'rejected',
      error: new Error(
        'Failed to resolve latest release tag for owner/repo: gh returned empty output',
      ),
    })
  })
})
