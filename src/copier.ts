import type { Exec } from '@/exec'

export type { Exec } from '@/exec'

export async function configureDiff3(exec: Exec): Promise<void> {
  await exec('git', ['config', 'merge.conflictStyle', 'diff3'])
}

export async function runCopierUpdate(
  args: { targetVersion: string; copierVersion: string },
  exec: Exec,
): Promise<void> {
  const copierSpec = args.copierVersion
    ? `copier==${args.copierVersion}`
    : 'copier'
  await exec('pipx', [
    'run',
    copierSpec,
    'update',
    '--trust',
    '--defaults',
    '--vcs-ref',
    args.targetVersion,
  ])
}
