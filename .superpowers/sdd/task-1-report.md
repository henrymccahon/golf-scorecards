# Task 1 Report: Project Scaffold And Course Domain

## Status

DONE_WITH_CONCERNS

## Work completed

- Created the required Vite/React scaffold, PWA manifest, app shell, course domain types and helpers, seed courses, and Vitest setup.
- Kept the supplied test file and configuration content aligned with `task-1-brief.md`.
- Added `@types/react` (`^18.3.3`) and `@types/react-dom` (`^18.3.0`) as development dependencies. This is a plan-gap resolution: the brief's package manifest omitted the declarations required by its strict TypeScript JSX build.

## TDD evidence

- RED: controller evidence recorded `npm test -- --run src/domain/courses.test.ts` failing before implementation because `src/test/setup.ts` was missing; controller also recorded `npm run build` failing before implementation because `src/domain/courses.ts` and `src/domain/types.ts` were missing.
- GREEN: controller verification after the React declaration packages were installed recorded `npm test -- --run src/domain/courses.test.ts` passing with 3/3 tests and `npm run build` passing.

## Self-review and concerns

- The brief's exact dependency list was incomplete for the stated `tsc && vite build` requirement. The two React declaration packages above were added solely to make that required build type-check.
- After controller GREEN verification, this sandbox intermittently failed both verification commands while Vite/esbuild bundled `vite.config.ts`, reporting `Cannot read directory "../../../..": Access is denied` and then `Could not resolve` the existing absolute config path. This is an environment access issue, not a TypeScript or application failure; the controller's subsequent verification passed.

## Commits

- `d0cf81e feat: scaffold scorecard app and course domain`

## Review finding fix

- Added self-contained golf scorecard PWA icons at `public/icon-192.svg` and `public/icon-512.svg`.
- Updated `public/manifest.webmanifest` to reference both icons with explicit sizes, `image/svg+xml` types, and `purpose: "any maskable"`.
- Kept the reserved `ScoreEntry` fields unchanged per the approved design decision.

## Fix verification

- `npm test -- --run src/domain/courses.test.ts`: BLOCKED before test execution by esbuild/Vite environment error: `Cannot read directory "../../../..": Access is denied.` and `Could not resolve "...\\vite.config.ts"`.
- `npm run build`: BLOCKED during Vite build after TypeScript completed by the same esbuild/Vite environment error: `Cannot read directory "../../../..": Access is denied.` and `Could not resolve "...\\vite.config.ts"`.
- Manifest JSON parsing confirmed both icon entries and SVG headers confirmed explicit `192x192` and `512x512` dimensions.

## Controller verification after fix

- `npm test -- --run src/domain/courses.test.ts`: PASS, 3/3 tests passing.
- `npm run build`: PASS, production build completed and wrote assets to `dist/`.
