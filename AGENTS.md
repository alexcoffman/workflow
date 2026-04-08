## Git completion rule1

For every code change task in this repository:

1. After implementing and verifying changes, review `git status`.
2. Stage all intended changes with `git add -A`.
3. Create a commit with a clear message in Russian.
4. Push the current branch to origin.
5. Only mark the task complete after a successful push.

If push fails, explain the reason and stop before completion.
Never commit `.env`, secrets, caches, build artifacts, IDE folders, or local databases.

## Version bump rule

For every commit that changes application behavior or UI:

1. Update the app version shown in the UI (`APP_VERSION` in `src/domain/constants.ts`).
2. Use semantic format `1.0.X` and increment `X` by 1 on each new commit.
3. Keep the version text in Inspector in sync with `APP_VERSION`.
