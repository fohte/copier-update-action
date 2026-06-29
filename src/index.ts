import * as core from '@actions/core'

import { run } from '@/run'

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})
