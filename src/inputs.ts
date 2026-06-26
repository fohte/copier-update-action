import * as core from '@actions/core'

export interface Inputs {
  templateRepo: string
  targetVersion: string
  githubToken: string
  copierVersion: string
}

const OWNER_REPO_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/

export function readInputs(): Inputs {
  return {
    templateRepo: core.getInput('template-repo'),
    targetVersion: core.getInput('target-version'),
    githubToken: core.getInput('github-token'),
    copierVersion: core.getInput('copier-version'),
  }
}

export function validateInputs(inputs: Inputs): void {
  if (inputs.templateRepo === '') {
    throw new Error('`template-repo` input is required')
  }
  if (!OWNER_REPO_PATTERN.test(inputs.templateRepo)) {
    throw new Error(
      `\`template-repo\` must be in \`owner/repo\` form (got: ${inputs.templateRepo})`,
    )
  }
  if (inputs.targetVersion === '' && inputs.githubToken === '') {
    throw new Error(
      '`github-token` is required when `target-version` is empty (needed to resolve the latest release via gh)',
    )
  }
}
