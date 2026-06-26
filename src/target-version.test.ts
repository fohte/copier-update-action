import { describe, expect, it } from 'vitest'

import { type GetLatestRelease, resolveTargetVersion } from '@/target-version'

interface RecordedCall {
  owner: string
  repo: string
}

type ClientBehavior =
  | { kind: 'ok'; tagName: string }
  | { kind: 'reject'; error: Error }

const recordingClient = (
  behavior: () => ClientBehavior,
): { client: GetLatestRelease; calls: RecordedCall[] } => {
  const calls: RecordedCall[] = []
  const client: GetLatestRelease = ({ owner, repo }) => {
    calls.push({ owner, repo })
    const result = behavior()
    if (result.kind === 'reject') {
      return Promise.reject(result.error)
    }
    return Promise.resolve({ data: { tag_name: result.tagName } })
  }
  return { client, calls }
}

describe('resolveTargetVersion', () => {
  it('returns the input as-is when targetVersion is non-empty and does not call the client', async () => {
    const { client, calls } = recordingClient(() => ({
      kind: 'ok',
      tagName: 'v0.0.0',
    }))

    const result = await resolveTargetVersion(
      { templateRepo: 'owner/repo', targetVersion: 'v9.9.9' },
      client,
    )

    expect({ result, calls }).toEqual({
      result: 'v9.9.9',
      calls: [],
    })
  })

  it('resolves the latest tag via the release client', async () => {
    const { client, calls } = recordingClient(() => ({
      kind: 'ok',
      tagName: 'v1.2.3',
    }))

    const result = await resolveTargetVersion(
      { templateRepo: 'owner/repo', targetVersion: '' },
      client,
    )

    expect({ result, calls }).toEqual({
      result: 'v1.2.3',
      calls: [{ owner: 'owner', repo: 'repo' }],
    })
  })

  it('propagates the error when the client rejects', async () => {
    const error = new Error('Not Found')
    const { client } = recordingClient(() => ({ kind: 'reject', error }))

    await expect(
      resolveTargetVersion(
        { templateRepo: 'owner/repo', targetVersion: '' },
        client,
      ),
    ).rejects.toBe(error)
  })

  it('throws when the client returns an empty tag_name', async () => {
    const { client } = recordingClient(() => ({ kind: 'ok', tagName: '' }))

    const captured = await resolveTargetVersion(
      { templateRepo: 'owner/repo', targetVersion: '' },
      client,
    ).then(
      (value) => ({ kind: 'resolved' as const, value }),
      (error: unknown) => ({ kind: 'rejected' as const, error }),
    )

    expect(captured).toEqual({
      kind: 'rejected',
      error: new Error(
        'Failed to resolve latest release tag for owner/repo: empty tag_name',
      ),
    })
  })
})
