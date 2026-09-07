<<<<<<< before updating
import * as core from '@actions/core'
||||||| last update
export const greet = (name: string): string => {
  return `Hello, ${name}!`
}
=======
import { err, ok, type Result } from 'neverthrow'
>>>>>>> after updating

<<<<<<< before updating
import { run } from '#run'

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})
||||||| last update
export const greet = (name: string): string => {
  return `Hello, ${name}!`
}
=======
export const greet = (name: string): Result<string, Error> => {
  if (!name) return err(new Error('name must not be empty'))
  return ok(`Hello, ${name}!`)
}
>>>>>>> after updating
