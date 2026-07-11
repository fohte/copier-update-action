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

interface ExecResponse {
  exitCode: number
  stdout?: Buffer
}

const recordingExec = (
  responses: ExecResponse[],
): { exec: Exec; calls: ExecCall[] } => {
  const calls: ExecCall[] = []
  let i = 0
  const exec: Exec = (commandLine, args, options) => {
    calls.push({
      commandLine,
      args,
      ignoreReturnCode: options?.ignoreReturnCode,
    })
    const response = responses[i++]
    if (response === undefined) {
      throw new Error(`unexpected exec call #${String(i)}: ${commandLine}`)
    }
    if (response.stdout !== undefined && options?.listeners?.stdout) {
      options.listeners.stdout(response.stdout)
    }
    return Promise.resolve(response.exitCode)
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

const STATUS_ARGS = [
  'status',
  '--porcelain',
  '-z',
  '--untracked-files=all',
  '--no-renames',
]

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
  it('emits changed=false and empty unresolved-files when no diff and no conflicts', async () => {
    const { exec, calls } = recordingExec([
      { exitCode: 0, stdout: Buffer.from('') },
    ])

    await writeOutputs(exec)

    const actual = { calls, outputs: parseGithubOutput(outputPath) }
    expect(actual).toEqual({
      calls: [
        {
          commandLine: 'git',
          args: STATUS_ARGS,
          ignoreReturnCode: true,
        },
      ],
      outputs: [
        { name: 'changed', value: 'false' },
        { name: 'unresolved-files', value: '' },
      ],
    })
  })

  it('emits changed=true when only untracked files are added (no tracked diff)', async () => {
    const { exec, calls } = recordingExec([
      { exitCode: 0, stdout: Buffer.from('?? new-file.txt\0') },
      { exitCode: 1, stdout: Buffer.from('') },
    ])

    await writeOutputs(exec)

    const actual = { calls, outputs: parseGithubOutput(outputPath) }
    expect(actual).toEqual({
      calls: [
        { commandLine: 'git', args: STATUS_ARGS, ignoreReturnCode: true },
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

  it('scopes the unresolved-files check to the files git status reports as changed', async () => {
    const { exec, calls } = recordingExec([
      { exitCode: 0, stdout: Buffer.from(' M a.txt\0M  sub/b.txt\0') },
      { exitCode: 0, stdout: Buffer.from('a.txt\0sub/b.txt\0') },
    ])

    await writeOutputs(exec)

    const actual = { calls, outputs: parseGithubOutput(outputPath) }
    expect(actual).toEqual({
      calls: [
        { commandLine: 'git', args: STATUS_ARGS, ignoreReturnCode: true },
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

  it('throws when git status exits with a non-zero code', async () => {
    const exec: Exec = () => Promise.resolve(128)

    await expect(writeOutputs(exec)).rejects.toEqual(
      new Error('git status --porcelain failed with exit code 128'),
    )
  })
})
