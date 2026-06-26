import type { ExecOptions } from '@actions/exec'

import type { Inputs } from '@/inputs'

export type Exec = (
  commandLine: string,
  args?: string[],
  options?: ExecOptions,
) => Promise<number>

export async function resolveTargetVersion(
  inputs: Pick<Inputs, 'templateRepo' | 'targetVersion' | 'githubToken'>,
  exec: Exec,
): Promise<string> {
  if (inputs.targetVersion !== '') {
    return inputs.targetVersion
  }

  let stdout = ''
  await exec(
    'gh',
    [
      'release',
      'view',
      '--repo',
      inputs.templateRepo,
      '--json',
      'tagName',
      '--jq',
      '.tagName',
    ],
    {
      env: { ...process.env, GH_TOKEN: inputs.githubToken },
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
      },
    },
  )

  const resolved = stdout.trim()
  if (resolved === '') {
    throw new Error(
      `Failed to resolve latest release tag for ${inputs.templateRepo}: gh returned empty output`,
    )
  }
  return resolved
}
