# V1 Publish Cleanup Design

Date: 2026-07-18

## Goal

Make the v1 golf scorecard app easy to understand, run, verify, and share from GitHub. This package does not change the core scoring product. It prepares the existing app for a public preview and creates a small manual QA checklist for the first hands-on walkthrough.

## Scope

- Expand `README.md` from a placeholder into useful project documentation.
- Configure Vite so production assets load correctly from the GitHub Pages repository path `/golf-scorecards/`.
- Add a GitHub Actions workflow that builds and deploys the app to GitHub Pages from `main`.
- Add a lightweight manual QA checklist for the v1 user walkthrough.
- Verify the package with the existing unit tests and production build.

## Non-Goals

- No new app features.
- No UI redesign.
- No native mobile packaging.
- No external course-data integration.
- No paid/pro feature work.

## README Design

The README should be written for a person landing on the GitHub repo for the first time. It should include:

- A short product summary.
- Current v1 feature list.
- Local setup commands: install, dev server, tests, build, and e2e.
- Deployment note for GitHub Pages.
- Known limitations of v1.
- Practical roadmap items for the next phase.

The README should avoid over-selling the project. It should describe the current app honestly as a functional v1 PWA prototype.

## GitHub Pages Design

Use GitHub Pages through GitHub Actions rather than committing build output. The workflow should:

- Run on pushes to `main`.
- Allow manual dispatch.
- Install dependencies with `npm ci`.
- Run `npm test -- --run`.
- Run `npm run build`.
- Upload `dist`.
- Deploy the uploaded artifact to GitHub Pages.

Vite should use `base: '/golf-scorecards/'` for production builds so static assets resolve under `https://henrymccahon.github.io/golf-scorecards/`.

## Manual QA Checklist

Add a short checklist under `docs/qa/` covering:

- Open the live preview.
- Search for a seeded course.
- Start a round.
- Enter scores across all holes.
- Finish the round and inspect the summary.
- Check round history.
- Create a custom course.
- Edit a custom course.
- Confirm mobile layout at narrow width.

This checklist is intentionally manual. It is for product feel and usability notes, not a replacement for automated tests.

## Testing

Required verification before publishing:

- `npm test -- --run`
- `npm run build`

Optional but preferred when local Playwright browsers are available:

- `npm run e2e`

## Risks

- GitHub Pages must be enabled for the repository. The workflow can be committed, but the Pages setting may need to be selected in GitHub if it is not already configured for Actions.
- The live URL may take a few minutes to appear after the first successful deployment.
- If the repo name changes, the Vite base path and README preview URL must change with it.
