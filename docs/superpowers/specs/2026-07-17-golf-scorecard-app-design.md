# Golf Scorecard App V1 Design

## Summary

Build a mobile-first progressive web app for golf scorecards. The v1 goal is pure functionality: users can find a stored course scorecard, create custom scorecards, start a round, record scores, autosave progress, finish the round, and review prior completed rounds.

The app should be designed as a local-first product for v1, with data models and boundaries that can later support native mobile, account sync, external course imports, deeper scoring stats, and paid pro features.

## Goals

- Provide a fast mobile scoring workflow for one primary player.
- Support both seeded sample courses and user-created custom courses.
- Support 9-hole and 18-hole scorecards.
- Store par, stroke index, and optional tee distances per hole.
- Allow a user to start a round from a course scorecard and record strokes per hole.
- Autosave in-progress rounds so scores survive app reloads or accidental closure.
- Save completed rounds to local history with useful summaries.
- Preserve historical round accuracy even if a course is edited later.

## Non-Goals For V1

- Native App Store release.
- User accounts, sign-in, cloud sync, or cross-device storage.
- External course database lookup/import.
- Multi-player scoring.
- Handicap/net scoring.
- Detailed stats, analytics, trends, charts, or pro-tier scoring features.
- Payments or subscription management.

## Recommended Approach

Use a mobile-first PWA for v1.

This is the fastest path to a functional scorecard app while keeping the core architecture portable. It can feel app-like on phones, persist local data, and validate the product flow before committing to native mobile distribution. The domain and storage boundaries should be clean enough that the scoring model can later move into a native app, backend-backed app, or shared package.

Alternatives considered:

- Expo/React Native local-first app: closer to the desired native end-state, but slower to set up, test, and distribute for an early functionality-focused v1.
- Backend-backed app from day one: better for accounts, sync, shared course data, and monetisation infrastructure, but too much scope for the first functional version.

## Architecture

The app should separate responsibilities into three main layers:

- Domain logic: course scorecards, holes, rounds, score entries, validation, and calculated totals.
- Storage layer: local-first persistence behind small repository-style functions, so sync can be added later without rewriting the UI.
- UI layer: phone-first screens for finding courses, creating scorecards, entering scores, and reviewing history.

Course data and round data must remain separate. A course scorecard defines the current editable version of a course. A round stores a snapshot of the selected scorecard at the time the round starts. This duplication is intentional: if a custom course is edited later, prior rounds still show the scorecard that was actually played.

## Data Model

### Course

A course represents a reusable scorecard.

Fields:

- `id`: stable local identifier.
- `name`: required display name.
- `source`: `seeded`, `custom`, or later `imported`.
- `holeCount`: `9` or `18`.
- `holes`: ordered list of hole definitions.
- `createdAt`: timestamp for custom courses.
- `updatedAt`: timestamp for custom course edits.

### Hole

A hole defines scorecard metadata.

Fields:

- `number`: 1-based hole number.
- `par`: required positive integer, normally 3, 4, or 5.
- `strokeIndex`: optional positive integer. When provided across a scorecard, values must be unique within that scorecard.
- `teeDistance`: optional numeric distance.
- `teeDistanceUnit`: optional unit, expected to be `meters` or `yards`.

### Round

A round records play against a scorecard snapshot.

Fields:

- `id`: stable local identifier.
- `status`: `in_progress` or `completed`.
- `courseId`: source course identifier when available.
- `courseSnapshot`: copied course name, hole count, source, and hole definitions.
- `startedAt`: timestamp.
- `completedAt`: timestamp when finished.
- `player`: primary player label or default local player.
- `scores`: ordered list of per-hole score entries.

### Score Entry

A score entry records the player's result for one hole.

Fields:

- `holeNumber`: 1-based hole number.
- `strokes`: optional while in progress, required for a hole to count as completed.
- `putts`: reserved future-friendly field, not required in the v1 UI.
- `penalties`: reserved future-friendly field, not required in the v1 UI.
- `fairwayHit`: reserved future-friendly field, not required in the v1 UI.
- `greenInRegulation`: reserved future-friendly field, not required in the v1 UI.

V1 scoring should require strokes only. Additional scoring details can be added later as optional or paid pro features without changing how core round totals are calculated.

## Main Screens

### Play / Start Round

The default entry point for on-course use. It shows a searchable list of courses from seeded and custom sources together. It should also show an in-progress round resume action when one exists.

Primary actions:

- Search courses.
- Open course detail.
- Start a round.
- Resume an in-progress round.

### Course Detail

Shows the selected scorecard before starting a round.

Content:

- Course name.
- Source label.
- 9-hole or 18-hole format.
- Total par.
- Hole-by-hole par, stroke index, and tee distance when present.

Primary actions:

- Start round.
- Edit course when it is custom.

### Create/Edit Custom Course

Allows users to create and maintain custom scorecards.

Inputs:

- Course name.
- Hole count: 9 or 18.
- Per-hole par.
- Per-hole stroke index.
- Optional per-hole tee distance.

Validation:

- Course name is required.
- Hole count must be 9 or 18.
- Par is required for every hole.
- Stroke indexes, when provided, must be positive and unique within the scorecard.
- Tee distances, when provided, must be positive numbers.

If a course has prior rounds, editing it should be allowed but the app should warn that previous rounds keep their original scorecard snapshot.

### Active Round

Optimized for quick phone use during play.

Content:

- Current hole number.
- Hole par, stroke index, and distance when present.
- Required stroke entry.
- Running total strokes.
- Running score vs par.
- Completed-hole count.
- Front/back totals for 18-hole rounds.

Behavior:

- Each score change autosaves the round draft.
- The user can move between holes freely.
- Blank holes are allowed while the round is in progress.
- A round can only be completed when all holes have valid strokes.

### Round Summary

Shown after finishing a round and available from history.

Content:

- Course name.
- Date played.
- Total strokes.
- Score vs par.
- Front/back totals for 18-hole rounds.
- Hole-by-hole scores.

### Round History

Lists completed rounds.

Content:

- Date.
- Course name.
- Total strokes.
- Score vs par.

Primary actions:

- Open round summary.

## Navigation

Use simple mobile navigation with three top-level areas:

- Play: search courses, start rounds, and resume in-progress rounds.
- Courses: manage seeded and custom scorecards.
- History: review completed rounds.

The navigation should remain compact and predictable. V1 should not include marketing pages or account settings because those do not support the functional goal.

## Data Flow

The recommended v1 flow is:

1. The app loads seeded courses and locally saved custom courses into one searchable course list.
2. The user selects a course and starts a round.
3. Starting a round creates an in-progress draft with a snapshot of the selected scorecard.
4. Every score entry updates and autosaves that draft.
5. The app continuously calculates total strokes, score vs par, completed holes, and front/back totals where applicable.
6. Finishing a round changes its status from `in_progress` to `completed`.
7. Completed rounds appear in round history.
8. In-progress rounds can be resumed from the Play screen.
9. Course edits after a round starts do not change the round snapshot.

External course imports can later use the same course list and course data structure with `source` set to `imported`.

## Error Handling And Validation

The app should directly handle these cases:

- Course creation cannot save without a name, valid hole count, and par for every hole.
- Stroke indexes, when used, must be positive and unique within the course.
- Tee distances, when used, must be positive.
- Score entries cannot use zero or negative strokes.
- Holes can remain blank while a round is in progress.
- A round cannot be completed until every hole has a valid stroke value.
- Autosave should preserve in-progress rounds across reloads.
- If local storage fails or is unavailable, the app should show a clear message that scores cannot be saved.
- Editing a custom course with prior rounds should warn the user that old rounds preserve their original scorecard snapshots.

## Testing Strategy

Prioritize tests around behavior that could silently corrupt score data.

Unit tests:

- Course validation for 9-hole and 18-hole scorecards.
- Required par values.
- Optional tee distances.
- Valid and unique stroke indexes.
- Round creation with course snapshots.
- Score total calculations.
- Score vs par calculations.
- Front/back totals.
- Completed-hole counts.
- Course edits not mutating previous round snapshots.

Workflow tests:

- Search a course.
- Start a round.
- Enter scores.
- Verify autosave/resume.
- Finish the round.
- View the completed round in history.

## Future Expansion

The design intentionally leaves space for:

- Native mobile app implementation.
- External course database lookup/import.
- User accounts and cloud sync.
- Multi-player scorecards.
- Handicap and net scoring.
- Stableford, match play, and other game formats.
- Deeper stats and trends as pro-tier features.
- Monetisation through paid analytics or advanced scoring features.

These should not be built in v1 unless the product goal changes.
