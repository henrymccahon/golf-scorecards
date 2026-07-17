# Task 5 Report: End-To-End Workflow, Build Verification, And Mobile Polish

## What I Implemented

- Added `e2e/score-round.spec.ts` covering search, start round, enter nine scores, finish round, and verify history.
- Added `.gitignore` for generated dependencies, build output, Playwright browser binaries, test output, and workflow scratch files.
- Added `scripts/run-e2e.cjs` so `npm run e2e` uses a project-local Playwright browser cache, starts/stops Vite reliably, and exits cleanly on Windows.
- Updated `package.json` with `e2e:install` and a reliable `e2e` script.
- Updated `playwright.config.ts` so Playwright can skip its own web-server wrapper when the Node runner owns server lifecycle.
- Scoped Vitest to `src/**/*.test.ts(x)` so Playwright E2E specs are not loaded by Vitest.
- Applied mobile polish: active round hides bottom nav to avoid content overlap, and 320px media rules tighten score rows and nav sizing.

## Verification

- Initial `npm run e2e` failed because Playwright Chromium was not installed in the default user cache.
- Default `npx playwright install chromium` failed because `C:\Users\f810863\AppData\Local\ms-playwright` was not writable from this session.
- Installed Chromium into the project-local `.ms-playwright` cache with `PLAYWRIGHT_BROWSERS_PATH`.
- Initial E2E spec failed because `getByText('Total 36')` matched two visible summary elements. Tightened it to `getByText('Total 36', { exact: true })`.
- Initial `npm run e2e` passed the test but hung while Playwright cleaned up the dev server. Replaced that path with `scripts/run-e2e.cjs`.
- Initial `npm run build` failed because `playwright.config.ts` used `process.env` without Node typings. Added a local declaration for the minimal `process.env` shape.
- `npm test -- --run`: PASS, 4 test files passed, 17 tests passed.
- `npm run build`: PASS.
- `npm run e2e`: PASS, 1 Playwright test passed.

## Second review findings fix

- Added Vite `--strictPort` to the custom E2E runner.
- Changed E2E readiness to wait for the spawned Vite process to report `http://127.0.0.1:5173/`, after stripping ANSI color codes, before polling the app URL.
- Verified an intermediate readiness issue failed fast when the ready output was not detected.
- `npm run e2e`: PASS, 1 Playwright test passed.
- `npm test -- --run`: PASS, 4 test files passed, 17 tests passed.
- `npm run build`: PASS.
- Mobile 320px layout check: PASS. Confirmed no horizontal overflow, visible search input, bottom navigation fits on the Play screen, active score rows and numeric inputs are readable, Finish round is reachable, and active scoring no longer has bottom-nav overlap.

## Files Changed

- `.gitignore`
- `e2e/score-round.spec.ts`
- `package.json`
- `playwright.config.ts`
- `scripts/run-e2e.cjs`
- `src/App.tsx`
- `src/styles.css`
- `vite.config.ts`

## Self-Review Findings

- The E2E runner avoids committing browser binaries and keeps generated Playwright output ignored.
- The E2E spec verifies the required user workflow through the real browser UI.
- The mobile polish is scoped to layout only and does not change scoring data flow.

## Issues Or Concerns

- Npm still prints a machine-level `always-auth` config warning before/after commands. Direct app/test output is otherwise clean, and this warning comes from the user's npm configuration rather than the project.

## Review findings fix

- Restored bottom navigation during active rounds and solved active-round overlap with CSS-only spacing, as required by the Task 5 brief.
- Hardened `scripts/run-e2e.cjs` so it fails if the Vite server exits before E2E starts, preventing false positives against a stale or unrelated server.
- Mobile 320px bottom-state check: PASS. Confirmed no horizontal overflow, Hole 9 input and Finish round are above the fixed nav, score input is readable, and the fixed nav remains available.
- `npm test -- --run`: PASS, 4 test files passed, 17 tests passed.
- `npm run build`: PASS.
- `npm run e2e`: PASS, 1 Playwright test passed.
