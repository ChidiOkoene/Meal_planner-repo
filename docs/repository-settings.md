# Repository settings

These GitHub settings cannot be set from files in the repository. An admin sets them once in the GitHub web UI.

## Branch protection for `main`

Settings → Rules → Rulesets → New branch ruleset:

- **Target:** the default branch (`main`)
- **Require a pull request before merging:** on
  - Required approvals: **1**. GitHub does not let authors approve their own PRs, so while only one person can review, either add a second reviewer or allow repository admins to bypass the rule.
- **Require status checks to pass:** on
  - Add the check **"Lint, typecheck, test and build"** (from the CI workflow). It appears in the list after the workflow has run once.
  - Require branches to be up to date before merging: on
- **Block force pushes:** on
- **Restrict deletions:** on

## Security

Settings → Code security:

- **Dependabot alerts:** on
- **Dependabot security updates:** on (version updates are configured in `.github/dependabot.yml`)
- **Secret scanning:** on
- **Push protection:** on (blocks pushes that contain recognised secrets)

## Merging

Settings → General → Pull Requests:

- Allow squash merging, with the default commit message set to the PR title. PR titles follow `type(scope): title`, so `main` history follows the same convention.
- Automatically delete head branches: on
