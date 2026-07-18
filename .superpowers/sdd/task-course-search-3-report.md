# Task 3 Report: Provider Search UI And Local Course Caching

## Status

Completed and committed.

## Commit

- `8307c00b13b754684025535eff5593afe4c272ab` - `feat: add provided course search flow`

## Files Changed

- `src/providers/staticCourseProvider.ts` (new): deterministic provider implementation behind `CourseProvider`.
- `src/providers/staticCourseProvider.test.ts` (new): provider search and mapping coverage.
- `src/App.tsx`: injectable provider, async search state, validation-backed local caching, duplicate filtering, and provider selection.
- `src/App.test.tsx`: provider search/cache/start flow, fallback, error, duplicate suppression; existing custom-create expectations updated for the required fallback button label.
- `src/components/CourseList.tsx`: provider results, status/error messaging, and custom-course fallback.
- `src/components/CourseDetail.tsx`: provider-friendly source attribution display.
- `src/domain/courses.ts`: `getCourseSourceLabel` helper.
- `src/styles.css`: provider result and fallback styles.

## Tests Run

1. `npm test -- --run src/providers/staticCourseProvider.test.ts`
   - Blocked before test discovery by this mirror's known Vite config access issue.
   - Exact relevant output:
     ```text
     X [ERROR] Cannot read directory "../../../..": Access is denied.
     X [ERROR] Could not resolve "C:\\Users\\f810863\\Documents\\Codex\\2026-07-17\\superpowers-plugin-superpowers-openai-curated-remote\\vite.config.ts"
     failed to load config from C:\Users\f810863\Documents\Codex\2026-07-17\superpowers-plugin-superpowers-openai-curated-remote\vite.config.ts
     Startup Error
     Error: Build failed with 2 errors
     ```
   - Exit code: `1`.

2. `npx tsc --noEmit`
   - Passed. Exit code: `0`.

3. `git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' diff --check`
   - Passed. Exit code: `0`.

4. `npm test -- --run src/providers/staticCourseProvider.test.ts src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts`
   - Blocked before test discovery by the same Vite config access issue above.
   - Exit code: `1`.

## Concerns

- Vitest could not run in this isolated mirror because Vite/esbuild is denied access while loading `vite.config.ts`. TypeScript compilation and whitespace validation passed, but the newly added tests could not be executed here.
- Existing unrelated `.superpowers/sdd` artifacts remain untracked and were intentionally excluded from the Task 3 commit. This report is also intentionally outside the `src`-only commit scope specified by the task brief.

## Self-Review Notes

- The static data provider is provider-agnostic at the App boundary and includes country, region, locality, external ID, attribution, and provider identity.
- Provider-loaded courses are mapped through the existing mapper and then validated again with `validateCourse` before persistence or round creation.
- Imported courses are stored in `savedCourses`; rounds continue to use the existing immutable course snapshot flow.
- Search failures and invalid provider scorecards remain non-blocking and retain custom course creation as the fallback.
- Saved provider keys suppress duplicate provider search results without removing any local or seeded course behavior.

## Fix: Provider Load Race Guard

### Changes

- Added deferred-promise regression coverage for out-of-order provider selections and a query change while a provider course load is pending.
- Added a provider load request token in `src/App.tsx`; only the most recent load may update state, persistence, selection, or provider error state.
- Invalidated pending provider loads synchronously when the search query changes.
- Used a current saved-courses ref when committing an imported course, avoiding stale closure overwrites and preserving any courses saved while a load was pending.

### Test Evidence

1. `npm test -- --run src/App.test.tsx` (RED and post-change verification attempt)
   - Blocked before test discovery by the mirror's known Vite config access issue. Exit code: `1`.
   - Exact relevant output:
     ```text
     X [ERROR] Cannot read directory "../../../..": Access is denied.
     X [ERROR] Could not resolve "C:\\Users\\f810863\\Documents\\Codex\\2026-07-17\\superpowers-plugin-superpowers-openai-curated-remote\\vite.config.ts"
     failed to load config from C:\Users\f810863\Documents\Codex\2026-07-17\superpowers-plugin-superpowers-openai-curated-remote\vite.config.ts
     Startup Error
     Error: Build failed with 2 errors
     ```

2. `npm test -- --run src/providers/staticCourseProvider.test.ts src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts`
   - Blocked before test discovery by the same Vite/esbuild access-denied failure. Exit code: `1`.

3. `npx tsc --noEmit`
   - Passed. Exit code: `0`.

4. `git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' diff --check`
   - Passed. Exit code: `0`.

### Remaining Concern

- Vitest could not execute in this isolated mirror, so the new race-case tests are type-checked but not runtime-verified here.
