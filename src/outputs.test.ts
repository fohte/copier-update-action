import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Exec, writeOutputs } from '@/outputs'

interface ExecCall {
  commandLine: string
  args: string[] | undefined
  ignoreReturnCode: boolean | undefined
}

const recordingExec = (
  exitCode: number,
  stdout: string,
): { exec: Exec; calls: ExecCall[] } => {
  const calls: ExecCall[] = []
  const exec: Exec = (commandLine, args, options) => {
    calls.push({
      commandLine,
      args,
      ignoreReturnCode: options?.ignoreReturnCode,
    })
    options?.listeners?.stdout?.(Buffer.from(stdout))
    return Promise.resolve(exitCode)
  }
  return { exec, calls }
}

interface ParsedOutput {
  name: string
  value: string
}

const parseGithubOutput = (path: string): ParsedOutput[] => {
  const content = readFileSync(path, 'utf8')
  const outputs: ParsedOutput[] = []
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const header = lines[i]
    if (header === undefined || header === '') {
      i++
      continue
    }
    const match = /^([^<]+)<<(.+)$/.exec(header)
    if (match === null) {
      i++
      continue
    }
    const name = match[1] ?? ''
    const delimiter = match[2] ?? ''
    const valueLines: string[] = []
    i++
    while (i < lines.length && lines[i] !== delimiter) {
      valueLines.push(lines[i] ?? '')
      i++
    }
    i++ // skip closing delimiter
    outputs.push({ name, value: valueLines.join('\n') })
  }
  return outputs
}

let tmpDir: string
let outputPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'outputs-test-'))
  outputPath = join(tmpDir, 'github_output')
  writeFileSync(outputPath, '')
  process.env['GITHUB_OUTPUT'] = outputPath
})

afterEach(() => {
  delete process.env['GITHUB_OUTPUT']
  rmSync(tmpDir, { recursive: true, force: true })
})

const grepArgs = (...paths: string[]): string[] => [
  '-c',
  'core.quotePath=false',
  '--literal-pathspecs',
  'grep',
  '--untracked',
  '-I',
  '-F',
  '-lz',
  '<<<<<<< before updating',
  '--',
  ...paths,
]

describe('writeOutputs', () => {
  it('emits changed=false and empty unresolved-files, and skips git entirely, when there are no changed files', async () => {
    const { exec, calls } = recordingExec(0, '')

    await writeOutputs(exec, [])

    const actual = { calls, outputs: parseGithubOutput(outputPath) }
    expect(actual).toEqual({
      calls: [],
      outputs: [
        { name: 'changed', value: 'false' },
        { name: 'unresolved-files', value: '' },
      ],
    })
  })

  it('emits changed=true when there are changed files with no remaining conflict markers', async () => {
    const { exec, calls } = recordingExec(1, '')

    await writeOutputs(exec, ['new-file.txt'])

    const actual = { calls, outputs: parseGithubOutput(outputPath) }
    expect(actual).toEqual({
      calls: [
        {
          commandLine: 'git',
          args: grepArgs('new-file.txt'),
          ignoreReturnCode: true,
        },
      ],
      outputs: [
        { name: 'changed', value: 'true' },
        { name: 'unresolved-files', value: '' },
      ],
    })
  })

  it('scopes the unresolved-files check to the given changed files and joins matches with newlines', async () => {
    const { exec, calls } = recordingExec(0, 'a.txt\0sub/b.txt\0')

    await writeOutputs(exec, ['a.txt', 'sub/b.txt'])

    const actual = { calls, outputs: parseGithubOutput(outputPath) }
    expect(actual).toEqual({
      calls: [
        {
          commandLine: 'git',
          args: grepArgs('a.txt', 'sub/b.txt'),
          ignoreReturnCode: true,
        },
      ],
      outputs: [
        { name: 'changed', value: 'true' },
        { name: 'unresolved-files', value: 'a.txt\nsub/b.txt' },
      ],
    })
  })

  it('throws when git grep exits with a non-recoverable code', async () => {
    const exec: Exec = () => Promise.resolve(128)

    await expect(writeOutputs(exec, ['a.txt'])).rejects.toEqual(
      new Error('git grep failed with exit code 128'),
    )
  })
})
