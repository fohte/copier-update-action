import { err, ok, type Result } from 'neverthrow'

import type { Inputs } from '#inputs'

export interface GetLatestRelease {
  (params: {
    owner: string
    repo: string
  }): Promise<{ data: { tag_name: string } }>
}

export async function resolveTargetVersion(
  inputs: Pick<Inputs, 'templateRepo' | 'targetVersion'>,
  getLatestRelease: GetLatestRelease,
): Promise<Result<string, Error>> {
  if (inputs.targetVersion !== '') {
    return ok(inputs.targetVersion)
  }

  const slash = inputs.templateRepo.indexOf('/')
  const owner = inputs.templateRepo.slice(0, slash)
  const repo = inputs.templateRepo.slice(slash + 1)
  const { data } = await getLatestRelease({ owner, repo })
  if (data.tag_name === '') {
    return err(
      new Error(
        `Failed to resolve latest release tag for ${inputs.templateRepo}: empty tag_name`,
      ),
    )
  }
  return ok(data.tag_name)
}
