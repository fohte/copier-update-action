import type { Exec } from '@/exec'

export interface ExecCall {
  commandLine: string
  args: string[] | undefined
}

export const recordingExec = (
  exitCode: number,
  stdout: string,
): { exec: Exec; calls: ExecCall[] } => {
  const calls: ExecCall[] = []
  const exec: Exec = (commandLine, args, options) => {
    calls.push({ commandLine, args })
    options?.listeners?.stdout?.(Buffer.from(stdout))
    return Promise.resolve(exitCode)
  }
  return { exec, calls }
}
