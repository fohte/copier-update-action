import type { Inputs } from '@/inputs'

export interface GetLatestRelease {
  (params: {
    owner: string
    repo: string
  }): Promise<{ data: { tag_name: string } }>
}

export async function resolveTargetVersion(
  inputs: Pick<Inputs, 'templateRepo' | 'targetVersion'>,
  getLatestRelease: GetLatestRelease,
): Promise<string> {
  if (inputs.targetVersion !== '') {
    return inputs.targetVersion
  }

  const slash = inputs.templateRepo.indexOf('/')
  const owner = inputs.templateRepo.slice(0, slash)
  const repo = inputs.templateRepo.slice(slash + 1)
  const { data } = await getLatestRelease({ owner, repo })
  if (data.tag_name === '') {
    throw new Error(
      `Failed to resolve latest release tag for ${inputs.templateRepo}: empty tag_name`,
    )
  }
  return data.tag_name
}
