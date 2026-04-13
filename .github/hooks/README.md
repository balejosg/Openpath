# Legacy Hook Notes

The live local Git hook workflow for OpenPath is implemented in `.husky/`, not in `.github/hooks/`.

Use these files as historical reference only. Do not install them into `.git/hooks/` for current development work.

Current source of truth:

- `.husky/pre-commit`
- `.husky/commit-msg`
- `.husky/pre-push`

Current behavior:

- `pre-commit` checks sensitive files and runs staged verification
- `commit-msg` appends `Verified-by: pre-commit`
- `pre-push` runs `npm run verify:full`

Do not bypass hooks with `--no-verify`.
