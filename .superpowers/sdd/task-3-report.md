# Task 3 Report: Course Search And Custom Course UI

## What I Implemented

- Added bottom navigation for Play, Courses, and History.
- Added searchable seeded/custom course lists, course detail views, and a temporary history screen with `No completed rounds yet.`
- Added custom course create/edit forms with controlled course name, hole count, par, stroke index, and tee-distance fields.
- Validates courses before save, renders validation failures in `.error-list`, preserves custom course IDs when editing, and creates new IDs as `custom-${Date.now()}`.
- Loads persisted custom courses and rounds once, and saves custom course changes through `createLocalScorecardStore(window.localStorage)`.
- Added the requested application tests and render helpers.

## TDD Evidence

### RED

Command:

```powershell
npm test -- --run src/App.test.tsx
```

Result: Vitest did not start. Esbuild failed before loading the tests with:

```text
Cannot read directory "../../../..": Access is denied.
Could not resolve "...\\vite.config.ts"
```

This is the documented deep-mirror-path startup blocker, so no application test assertions could execute locally.

### GREEN

Command:

```powershell
npm test -- --run src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts src/storage/localStore.test.ts
```

Result: blocked by the same Vitest/esbuild startup error above before tests loaded.

TypeScript fallback command:

```powershell
npx tsc --noEmit
```

Result: passed with exit code 0.

## Files Changed

- `src/App.tsx`
- `src/App.test.tsx`
- `src/components/BottomNav.tsx`
- `src/components/CourseDetail.tsx`
- `src/components/CourseForm.tsx`
- `src/components/CourseList.tsx`
- `src/styles.css`
- `src/test/render.tsx`

## Self-Review Findings

- No Task 3 implementation defects found in the final diff.
- `git diff --check` reported no whitespace errors before commit.
- Custom course editing preserves the existing ID; creation uses the required deterministic local ID shape.
- Invalid course data remains in the form and is not persisted.

## Issues Or Concerns

- Vitest cannot initialize under this deep mirror workspace because esbuild receives an access-denied error while resolving the Vite config. The controller should run the specified test command from `C:\Dev\Projects\golf`.
- `npx tsc --noEmit` succeeds in this workspace.

## Controller verification and warning fix

- After copying the Task 3 implementation to `C:\Dev\Projects\golf`, `npm test -- --run src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts src/storage/localStore.test.ts` passed but emitted a React controlled/uncontrolled input warning from `CourseForm`.
- RED: strengthened the app course-creation test to fail on `console.error`; `npm test -- --run src/App.test.tsx` failed on the existing controlled/uncontrolled warning.
- GREEN: changed the par input to render blank as `''` instead of `undefined`; `npm test -- --run src/App.test.tsx` passed, 1 file passed, 2 tests passed.
- Final verification: `npm test -- --run src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts src/storage/localStore.test.ts` passed, 4 test files passed, 12 tests passed.

## Controller review response

- Task 3 review raised start/resume/history behavior as Critical, but those workflows are explicitly assigned to Task 4 in the implementation plan. They remain cross-task verification items, not Task 3 blockers.
- Added Task 3-focused app coverage for validation errors, custom-course persistence across remounts, and editing a custom course without changing seeded courses.
- `npm test -- --run src/App.test.tsx`: PASS, 1 test file passed, 5 tests passed.
- `npm test -- --run src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts src/storage/localStore.test.ts`: PASS, 4 test files passed, 15 tests passed.

## Commit

`5d441cd feat: add course search and custom course UI`
