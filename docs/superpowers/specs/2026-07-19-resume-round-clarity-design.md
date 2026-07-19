# Resume Round Clarity Design

Date: 2026-07-19

## Summary

Polish the Play screen resume experience for in-progress rounds. The current resume action only says `Resume <course name>`, which is technically correct but not very useful when a player returns mid-round. The next slice should make the card tell the player where they left off and resume them into the most useful point in the scoring flow.

The recommended scope is:

- Show each in-progress round as a compact resume card above course search.
- Include round progress, current total, score to par, and the next useful action.
- Resume directly to the first unplayed hole when one exists.
- Resume directly to scorecard review when every hole has a score but the round has not been finished.

## Goals

- Make in-progress rounds easier to understand before tapping resume.
- Reduce friction when returning to a partially scored round.
- Keep the resume experience useful when more than one in-progress round exists.
- Preserve the existing local-first persistence, scoring model, review gate, and completion rules.
- Keep the change small enough for a focused polish branch.

## Non-Goals

- No delete, archive, or abandon-round flow.
- No round naming or player-management work.
- No changes to completed round history.
- No backend sync, account, or multi-device resume behavior.
- No changes to score calculation or storage shape.
- No broad Play screen redesign.

## Recommended Approach

Replace the plain resume banner content with a compact, information-rich resume card. Keep the card as a button so the interaction remains simple and accessible.

Each in-progress round card should show:

- Course name.
- Progress, for example `8/9 holes`.
- Current total and score to par, for example `Total 32 · E`.
- A next-action label:
  - `Next: Hole 9` when at least one hole is unplayed.
  - `Ready to review` when every hole has a valid stroke count.

Tapping the card should open the active round at the first unplayed hole. If all holes are scored, tapping should open the pre-finish scorecard review screen.

Alternatives considered:

- Text-only banner: fastest, but it still resumes to hole 1 and does not make the progress information actionable.
- Full resume dashboard: useful later, especially if abandoning rounds is added, but too large for this polish slice.
- Keep current behavior: acceptable for a first version, but it makes the new mobile scoring flow feel less helpful after autosave and reload.

## User Experience

The Play screen should continue to prioritize in-progress rounds above course search. A returning player should be able to scan the card and understand the round state without opening it first.

Examples:

- A partially played round:
  - `Lakeview Nine`
  - `8/9 holes · Total 32 · E`
  - `Next: Hole 9`
- A fully scored but unfinished round:
  - `Lakeview Nine`
  - `9/9 holes · Total 36 · E`
  - `Ready to review`

The card should remain compact and readable at 320px. It should not compete visually with the main single-hole scoring surface; its job is orientation and quick re-entry.

## Resume Targeting

The resume target should be derived from existing round data:

1. Find the first score entry whose stroke value is not a valid positive integer.
2. If a missing score exists, open `ActiveRound` in scoring mode with that hole selected.
3. If no missing score exists, open `ActiveRound` in review mode.

This behavior should apply when resuming from the Play screen. Starting a new round should continue to open on hole 1 in scoring mode.

If loaded data is unusual, the UI should be defensive:

- If the round has no holes, fall back to the existing first-hole behavior rather than throwing.
- If score entries are missing or malformed, treat affected holes as unplayed, matching the current `normalizeStrokes` semantics.
- Never write a score value while computing the resume target.

## Component Boundaries

Expected code changes:

- `src/components/CourseList.tsx`: render richer resume card content for each in-progress round.
- `src/domain/rounds.ts`: add small pure helpers if useful, such as `getFirstUnplayedHoleNumber(round)` or `getRoundResumeTarget(round)`.
- `src/components/ActiveRound.tsx`: accept an optional initial scoring hole and optional initial mode so `App` can request a resume target without taking ownership of scoring UI state.
- `src/App.tsx`: derive the resume target when `resumeRound(roundId)` runs and pass it into `ActiveRound`.
- `src/styles.css`: tune resume card layout and narrow-screen wrapping.

`App` should not gain score-entry rendering knowledge. `ActiveRound` should continue to own scoring/review mode transitions after it mounts. Domain helpers should stay pure and should not mutate round data.

## Accessibility

The resume card remains a button. Its accessible name should include enough information to distinguish multiple in-progress rounds, for example course name plus progress and next action.

The visible text can be split across lines for layout, but it should remain coherent when read by assistive technology. Do not add layout-only ARIA labels to generic wrappers.

## Testing Strategy

Automated tests should cover:

- Resume cards show course name, progress, total, score to par, and next action.
- A partially played resumed round opens on the first unplayed hole.
- A fully scored in-progress round resumes to the scorecard review screen.
- Existing start-new-round behavior still opens hole 1.
- Existing autosave/remount resume behavior still works.
- Multiple in-progress rounds remain distinguishable and individually resumable.

Suggested verification:

- `npm test -- --run src/App.test.tsx`
- `npm test -- --run src/components/ActiveRound.test.tsx`
- `npm test -- --run`
- `npm run build`
- `npm run e2e`

Rendered QA:

- Check the Play screen with one and two in-progress rounds at mobile width.
- Resume a partial round and confirm the selected hole matches the first unplayed hole.
- Resume a fully scored unfinished round and confirm review appears before finish.
- Check console warnings and errors during the resume flow.

## Risks

- Initial mode and initial hole props could reset user navigation unexpectedly if they are reapplied after every score change. They should be used as mount or round-change defaults, not continuous controlled state.
- Resume targeting must not silently create strokes for unplayed holes.
- Richer resume cards can become visually crowded on narrow screens if too many metrics are shown with equal weight.
- Existing tests may rely on the old `Resume <course>` text and need more precise accessible queries.

## Success Criteria

- A player can see in-progress round progress and next action before resuming.
- Partial rounds resume to the first unplayed hole.
- Fully scored unfinished rounds resume to scorecard review.
- New rounds still start on hole 1.
- No scoring model, persistence, completion, summary, or history behavior regresses.
- The resume card remains readable at 320px.
