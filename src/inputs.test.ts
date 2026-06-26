import * as core from '@actions/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type Inputs, readInputs, validateInputs } from '@/inputs'

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
}))

const mockInputs = (values: Record<string, string>): void => {
  vi.mocked(core.getInput).mockImplementation(
    (name: string) => values[name] ?? '',
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('readInputs', () => {
  it('reads all inputs into a typed object', () => {
    mockInputs({
      'template-repo': 'fohte/generic-boilerplate',
      'target-version': 'v1.2.3',
      'github-token': 'ghs_token',
      'copier-version': '9.4.1',
    })

    expect(readInputs()).toEqual({
      templateRepo: 'fohte/generic-boilerplate',
      targetVersion: 'v1.2.3',
      githubToken: 'ghs_token',
      copierVersion: '9.4.1',
    })
  })

  it('returns empty strings for unset optional inputs', () => {
    mockInputs({ 'template-repo': 'fohte/generic-boilerplate' })

    expect(readInputs()).toEqual({
      templateRepo: 'fohte/generic-boilerplate',
      targetVersion: '',
      githubToken: '',
      copierVersion: '',
    })
  })
})

describe('validateInputs', () => {
  const base: Inputs = {
    templateRepo: 'fohte/generic-boilerplate',
    targetVersion: 'v1.2.3',
    githubToken: '',
    copierVersion: '',
  }

  const run = (overrides: Partial<Inputs>) => () => {
    validateInputs({ ...base, ...overrides })
  }

  it('passes when all inputs are present', () => {
    expect(
      run({ githubToken: 'ghs_token', copierVersion: '9.4.1' }),
    ).not.toThrow()
  })

  it('passes when only target-version is given', () => {
    expect(run({ targetVersion: 'v1.2.3', githubToken: '' })).not.toThrow()
  })

  it('passes when only github-token is given (target-version resolved at runtime)', () => {
    expect(run({ targetVersion: '', githubToken: 'ghs_token' })).not.toThrow()
  })

  it('throws when template-repo is empty', () => {
    expect(run({ templateRepo: '' })).toThrow(
      new Error('`template-repo` input is required'),
    )
  })

  it('throws when template-repo is not in owner/repo form', () => {
    expect(run({ templateRepo: 'not-a-valid-repo' })).toThrow(
      new Error(
        '`template-repo` must be in `owner/repo` form (got: not-a-valid-repo)',
      ),
    )
  })

  it('throws when both target-version and github-token are empty', () => {
    expect(run({ targetVersion: '', githubToken: '' })).toThrow(
      new Error(
        '`github-token` is required when `target-version` is empty (needed to resolve the latest release via gh)',
      ),
    )
  })
})
