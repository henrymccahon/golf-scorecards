# Golf Scorecards

Golf Scorecards is a functional v1 PWA prototype for recording golf rounds on stored scorecards. It supports seeded courses, custom course scorecards, basic stroke scoring, autosaved in-progress rounds, completed round summaries, and local round history.

Live preview: https://henrymccahon.github.io/golf-scorecards/

## Current V1 Features

- Search seeded and provider-backed course scorecards.
- Save selected provided courses locally for scoring.
- Create and edit custom 9-hole or 18-hole courses.
- Store par, stroke index, and tee distance per hole.
- Start a round from a course scorecard.
- Record simple stroke-only scores.
- Autosave and resume in-progress rounds.
- Finish completed rounds and view summaries.
- View completed round history.
- Preserve historical scorecards when custom courses are edited.
- Recover safely from malformed local saved data.

## Local Development

Install dependencies:

```powershell
npm install
```

Start the local dev server:

```powershell
npm run dev
```

Run unit and component tests:

```powershell
npm test -- --run
```

Build the production bundle:

```powershell
npm run build
```

Install the local Playwright browser once:

This command is Windows-only because it invokes PowerShell and `playwright.cmd`.

```powershell
npm run e2e:install
```

Run the mobile browser workflow:

```powershell
npm run e2e
```

## Deployment

The app is configured for GitHub Pages at:

https://henrymccahon.github.io/golf-scorecards/

Deployment is handled by GitHub Actions on pushes to `main`. The workflow runs tests, builds the Vite app, uploads `dist`, and deploys it to Pages.

If the first deployment does not appear, check the repository Pages settings and confirm the source is set to GitHub Actions.

## Manual QA

Use `docs/qa/v1-manual-walkthrough.md` for the first product walkthrough after deployment.

## Known V1 Limitations

- Provider-backed course search currently uses deterministic demo data; live course database integration is the next provider step.
- Scores are local to the device/browser.
- Scoring is stroke-only; detailed stats such as putts, penalties, fairways, and greens are planned later.
- There is no account system, cloud sync, or paid/pro model yet.
- Native mobile packaging has not been added yet.

## Roadmap

- Add real course-data search/import with custom scorecard fallback.
- Polish the scoring flow after hands-on mobile testing.
- Add richer scoring and round analytics as a later pro-feature candidate.
- Evaluate native mobile packaging with Capacitor once the PWA flow feels right.
