import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { exec as actionsExec } from '@actions/exec'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { detectConflicts } from '@/conflicts'
import type { Exec } from '@/exec'

let tmpDir: string
let exec: Exec

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'conflicts-integration-'))
  execFileSync('git', ['init', '-q'], { cwd: tmpDir })
  exec = (commandLine, args, options) =>
    actionsExec(commandLine, args, { ...options, cwd: tmpDir })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('detectConflicts (real git)', () => {
  it('treats a deleted file among the scanned paths as no match instead of failing', async () => {
    const file = join(tmpDir, 'a.txt')
    writeFileSync(file, 'hello\n')
    execFileSync('git', ['add', 'a.txt'], { cwd: tmpDir })
    execFileSync(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '-q',
        '-m',
        'add a.txt',
      ],
      { cwd: tmpDir },
    )
    execFileSync('git', ['rm', '-q', 'a.txt'], { cwd: tmpDir })

    await expect(detectConflicts(exec, ['a.txt'])).resolves.toEqual([])
  })
})
