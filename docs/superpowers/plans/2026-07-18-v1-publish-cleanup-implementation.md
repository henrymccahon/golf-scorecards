# V1 Publish Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published golf scorecard repository understandable, verifiable, and deployable to GitHub Pages.

**Architecture:** Keep the app implementation unchanged. Add repo-facing documentation, a manual QA checklist, and static-site deployment configuration around the existing Vite PWA. GitHub Pages deployment uses GitHub Actions to build `dist` from `main`; build output is not committed.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright, GitHub Actions, GitHub Pages.

## Global Constraints

- Do not add new app features.
- Do not redesign the UI.
- Do not add native mobile packaging.
- Do not add external course-data integration.
- Do not add paid/pro feature work.
- Use GitHub Pages through GitHub Actions rather than committing build output.
- GitHub Pages production assets must resolve under `/golf-scorecards/`.
- Required verification before publishing: `npm test -- --run` and `npm run build`.
- Optional verification when local Playwright browsers are available: `npm run e2e`.
- README copy must describe the current app honestly as a functional v1 PWA prototype.

---

## File Structure

- `README.md`: Public project overview, setup commands, validation commands, deployment URL, limitations, and roadmap.
- `docs/qa/v1-manual-walkthrough.md`: Manual product walkthrough checklist for the first v1 preview pass.
- `vite.config.ts`: Existing Vite config; add `base: '/golf-scorecards/'`.
- `.github/workflows/deploy-pages.yml`: GitHub Actions workflow that tests, builds, uploads `dist`, and deploys to GitHub Pages.

---

### Task 1: README and Manual QA Checklist

**Files:**
- Modify: `README.md`
- Create: `docs/qa/v1-manual-walkthrough.md`

**Interfaces:**
- Consumes: Existing npm scripts from `package.json`: `dev`, `build`, `test`, `e2e:install`, `e2e`.
- Produces: Human-readable setup and QA instructions used by contributors and by Task 2's deployment documentation.

- [ ] **Step 1: Replace README with useful v1 project documentation**

Replace `README.md` with:

```markdown
# Golf Scorecards

Golf Scorecards is a functional v1 PWA prototype for recording golf rounds on stored scorecards. It supports seeded courses, custom course scorecards, basic stroke scoring, autosaved in-progress rounds, completed round summaries, and local round history.

Live preview: https://henrymccahon.github.io/golf-scorecards/

## Current V1 Features

- Search seeded course scorecards.
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

- Course data is currently seeded or manually entered; there is no live course database integration yet.
- Scores are local to the device/browser.
- Scoring is stroke-only; detailed stats such as putts, penalties, fairways, and greens are planned later.
- There is no account system, cloud sync, or paid/pro model yet.
- Native mobile packaging has not been added yet.

## Roadmap

- Add real course-data search/import with custom scorecard fallback.
- Polish the scoring flow after hands-on mobile testing.
- Add richer scoring and round analytics as a later pro-feature candidate.
- Evaluate native mobile packaging with Capacitor once the PWA flow feels right.
```

- [ ] **Step 2: Create the manual QA checklist**

Create `docs/qa/v1-manual-walkthrough.md` with:

```markdown
# V1 Manual Walkthrough

Use this checklist after deploying the GitHub Pages preview. The goal is to find product rough edges that automated tests do not catch.

Preview URL: https://henrymccahon.github.io/golf-scorecards/

## Device Coverage

- [ ] Open on desktop width.
- [ ] Open on a narrow mobile width, around 320-390px.
- [ ] Confirm the app loads without broken icons, blank screens, or missing styles.

## Seeded Course Flow

- [ ] Search for `Lakeview`.
- [ ] Open `Lakeview Nine`.
- [ ] Start a round.
- [ ] Enter valid stroke values for every hole.
- [ ] Confirm the finish button is usable and not hidden by bottom navigation.
- [ ] Finish the round.
- [ ] Confirm the summary shows total score, par, score to par, played date, and hole scores.
- [ ] Open history and confirm the completed round appears with score versus par.

## Custom Course Flow

- [ ] Open Courses.
- [ ] Create a custom 9-hole course.
- [ ] Enter a course name and valid par values.
- [ ] Save the course and confirm it appears in the course list.
- [ ] Open the custom course and start a round.
- [ ] Return to the course later and edit it.
- [ ] Confirm the edit warning appears once the course has prior rounds.

## Resume and Recovery Flow

- [ ] Start a round and enter at least one score.
- [ ] Refresh the browser.
- [ ] Resume the in-progress round.
- [ ] Confirm the previously entered score is still present.

## Notes

Record anything that feels slow, confusing, cramped, or awkward. Prioritize issues that block a real golfer from starting, scoring, finishing, or finding a round.
```

- [ ] **Step 3: Run documentation sanity checks**

Run:

```powershell
git --git-dir='work\golf-scorecard-design.git' --work-tree='.' diff --check
```

Expected: exit code `0`; Windows line-ending warnings are acceptable.

- [ ] **Step 4: Commit documentation changes**

Run:

```powershell
git --git-dir='work\golf-scorecard-design.git' --work-tree='.' add README.md docs/qa/v1-manual-walkthrough.md
git --git-dir='work\golf-scorecard-design.git' --work-tree='.' commit -m "docs: add v1 publish documentation"
```

Expected: commit succeeds with the README and QA checklist.

---

### Task 2: GitHub Pages Deployment Configuration

**Files:**
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Existing Vite build command `npm run build`.
- Produces: A production bundle that resolves static assets under `/golf-scorecards/` and a GitHub Actions workflow that deploys `dist`.

- [ ] **Step 1: Configure Vite base path**

Update `vite.config.ts` to:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/golf-scorecards/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts']
  }
});
```

- [ ] **Step 2: Add GitHub Pages workflow**

Create `.github/workflows/deploy-pages.yml` with:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --run

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Run required verification**

Run:

```powershell
npm test -- --run
npm run build
```

Expected:

- Tests pass with all current test files green.
- Build succeeds and emits `dist`.

- [ ] **Step 4: Run optional e2e if local browsers are installed**

Run:

```powershell
npm run e2e
```

Expected: mobile scoring workflow passes. If local Playwright browsers are missing, run `npm run e2e:install` once, then retry.

- [ ] **Step 5: Commit deployment configuration**

Run:

```powershell
git --git-dir='work\golf-scorecard-design.git' --work-tree='.' add vite.config.ts .github/workflows/deploy-pages.yml
git --git-dir='work\golf-scorecard-design.git' --work-tree='.' commit -m "ci: deploy app to github pages"
```

Expected: commit succeeds with Vite and workflow changes.

- [ ] **Step 6: Push to GitHub**

Run:

```powershell
git --git-dir='work\golf-scorecard-design.git' --work-tree='.' push
```

Expected: `main` pushes to `origin/main`. GitHub Actions starts the Pages workflow.

If GitHub Pages does not publish after the workflow succeeds, open repository settings and set Pages source to GitHub Actions.
