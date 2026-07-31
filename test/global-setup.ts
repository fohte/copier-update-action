import { ensureMergirafInstalled } from '#test/mergiraf-bin'

export default function setup(): void {
  const result = ensureMergirafInstalled()
  if (result.isErr()) {
    // eslint-disable-next-line no-restricted-syntax -- interop boundary: vitest's globalSetup contract only understands a thrown error, not a Result
    throw result.error
  }
}
