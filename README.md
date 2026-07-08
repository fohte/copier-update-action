# copier-update-action

> **Status: pre-release (`v0.x`).** The action's runtime is still being built out in follow-up commits; the inputs, outputs, and bundled `dist/` referenced below describe the target shape. Until `v1.0.0` is cut, the floating major tag is `v0` and breaking changes can land between minor versions.

A reusable GitHub Action that runs `copier update` against a [copier](https://copier.readthedocs.io/) template and resolves the resulting conflict blocks with [mergiraf](https://mergiraf.org/) so that the updated working tree is as close to mergeable as possible.

The action is **scoped narrowly**: it only updates the working tree. Checkout, branch creation, commit, push, and PR creation are the caller workflow's responsibility. This keeps the action reusable across repositories with different branching and PR conventions.

## Why this action exists

Renovate ships a [Copier manager](https://docs.renovatebot.com/modules/manager/copier/) that opens PRs when the template moves. In practice those PRs frequently land with unresolved conflict markers when the consumer has diverged from the template, because Renovate runs `copier update` with a 2-way merge driver and surfaces every conflict as-is.

This action narrows that gap with three changes:

1. It configures `git config merge.conflictStyle diff3` before running `copier update`, so each conflict block carries the common ancestor (`|||||||` section). This is what mergiraf needs to perform a 3-way merge.
2. It hands each conflicted file to `mergiraf solve`. mergiraf's structured merger works at the key level, so a JSON conflict that previously left a 12-line marker around four keys can come back as a 4-line marker around just the one key that actually collides. Fully resolvable blocks disappear entirely; the rest shrink to the still-unresolved regions.
3. For conflicts mergiraf still leaves behind, it compares the `before updating` and `after updating` sides as versions. When both sides parse as a comparable version, it keeps whichever is semantically newer — following the template's bump, or keeping the repository's own newer value instead of downgrading it. Conflicts that aren't a clean version-only difference are left for manual resolution.

The net effect is that PRs which previously needed manual conflict resolution often merge cleanly, and the ones that don't have a strictly smaller surface to review.

## Inputs

| name             | required    | default  | description                                                                                                |
| ---------------- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `template-repo`  | yes         | —        | copier template repo in `owner/repo` form (e.g. `fohte/generic-boilerplate`).                              |
| `target-version` | no          | (latest) | ref passed to `copier update --vcs-ref`. When empty, the action resolves the latest release via `gh`.      |
| `github-token`   | conditional | —        | token used by `gh release view` when `target-version` is empty. Needs `contents: read` on `template-repo`. |
| `copier-version` | no          | (latest) | passed to `pipx run copier==<version>`. Empty means use the latest copier from PyPI.                       |

`github-token` is only required when `target-version` is unset. If you always pin `target-version` from the caller side (e.g. driven by Renovate), the token can be omitted entirely.

## Outputs

| name               | type                                       | description                                                                                                                      |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `target-version`   | string (e.g. `v0.8.10`)                    | the ref that was actually applied. Same as the input when set; otherwise the resolved latest tag.                                |
| `changed`          | `'true'` \| `'false'`                      | whether tracked files differ from `HEAD` after the update.                                                                       |
| `unresolved-files` | newline-separated string (empty when none) | paths of files that still contain conflict markers after mergiraf and the version-based resolver have attempted to resolve them. |

`unresolved-files` uses newlines because `$GITHUB_OUTPUT` values are strings. Convert to a JSON array for downstream steps with:

```bash
echo "$UNRESOLVED" | jq -R -s -c 'split("\n") | map(select(length>0))'
```

## Usage

The action does not touch git history or remote state. A minimal caller workflow looks like this:

```yaml
name: copier update

on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  copier-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Run copier update
        id: copier
        uses: fohte/copier-update-action@v0
        with:
          template-repo: your-org/your-template
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Create branch, commit, and open PR
        if: steps.copier.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TARGET: ${{ steps.copier.outputs.target-version }}
          UNRESOLVED: ${{ steps.copier.outputs.unresolved-files }}
        run: |
          branch="copier-update/${TARGET}"
          git switch -c "$branch"
          git add -A
          git -c user.name='github-actions[bot]' \
              -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
              commit -m "chore: copier update to ${TARGET}"
          git push -u origin "$branch"

          body="Updates the template to \`${TARGET}\`."
          if [ -n "$UNRESOLVED" ]; then
            files=$(echo "$UNRESOLVED" | jq -R -s -c 'split("\n") | map(select(length>0))')
            body=$(printf '%s\n\nUnresolved conflict files: `%s`' "$body" "$files")
          fi
          gh pr create --base main --head "$branch" \
            --title "chore: copier update to ${TARGET}" \
            --body "$body"
```

### Caller responsibilities (out of scope for this action)

The action intentionally does **not** do any of the following. The caller workflow must handle them:

- `actions/checkout` (and choosing a token with `contents: write` if it intends to push)
- Branch creation, commit, push
- PR creation (`gh pr create`, `peter-evans/create-pull-request`, etc.)
- Authentication minting (octo-sts, GitHub App, PAT, etc.)
- **Restoring executable bits on scripts** under e.g. `scripts/bootstrap`. Git tracks executable bits, but copier renders files with default permissions; if the template ships executable scripts, restore them in the caller step (`chmod +x scripts/bootstrap`) before committing.

## Security considerations

- **`--trust` is always passed to copier.** copier templates can execute arbitrary jinja, `_tasks`, and pre/post update hooks. The action passes `--trust` unconditionally because the consumer is presumed to have already chosen to trust the template (they reference it in `.copier-answers.yml`). If you reference a template you do not control, do not use this action.
- **`target-version` is not validated.** Any ref accepted by `copier update --vcs-ref` is accepted here, including arbitrary commits and branches — not just release tags. If you want to restrict to release tags, do so in the caller workflow (e.g. validate the input before calling this action).
- **`github-token` scope.** When `target-version` is empty the action calls `gh release view` against `template-repo`. A token with `contents: read` on that repo is sufficient.
- **mergiraf binary.** The action downloads the mergiraf release tarball from GitHub. The version is hardcoded in the action's source and updated via Renovate. There is no checksum verification today; this will follow upstream once mergiraf publishes checksums.

## Development

This is a JavaScript action. Source lives under `src/`; the bundled `dist/index.js` (built with [`@vercel/ncc`](https://github.com/vercel/ncc)) is gitignored on `main` and attached only to release tags (`vX.Y.Z` and the floating `vN`) by `.github/workflows/release-please.yml`, so `runs.using: node24` can load it from any released ref. Pull requests verify the bundle still builds; pin to a release tag rather than `main` when consuming the action.

```bash
pnpm install
pnpm test         # tsc --noEmit + vitest run
pnpm build        # ncc build src/index.ts -o dist
```

## License

MIT
