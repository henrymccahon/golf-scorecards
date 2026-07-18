# Mobile Scoring Flow Design

Date: 2026-07-18

## Summary

Replace the current all-holes active round screen with a mobile-first single-hole scoring flow. The scorer should focus on one hole at a time, adjust strokes with plus/minus controls, move through holes with previous/next navigation, jump with a compact hole navigator, review the full scorecard before finishing, and preserve space for richer hole details later.

The scoring data contract remains intentionally simple: unplayed holes display as `0` in the scoring UI, but round data stores unplayed strokes as `null`, `undefined`, or an omitted value, never as numeric `0`. Inside the current TypeScript domain model, the write form should remain `undefined`. A round can only be completed after every hole has a positive stroke count.

## Goals

- Make mobile score entry fast enough to use during a round without fighting small numeric inputs.
- Show one hole as the primary scoring surface.
- Use plus/minus controls for score entry, with direct prevention of invalid negative or fractional scores.
- Display unplayed holes as `0` while keeping domain state as `undefined` and serialized unplayed values nullish or omitted.
- Let users move with previous and next controls.
- Provide a compact hole navigator for quick jumps and progress scanning.
- Require a full scorecard review step before completing the round.
- Preserve the current local-first round persistence, immutable course snapshot behavior, and completion rules.
- Leave layout room for future pro hole details such as distance, handicap/stroke index, notes, shot prompts, or richer score context.

## Non-Goals

- Do not add putts, penalties, fairways hit, greens in regulation, or match play scoring in this package.
- Do not add GPS, maps, shot tracking, or live course-position features.
- Do not change course search, provider loading, course storage, or custom course editing.
- Do not change completed round history beyond whatever is necessary to open the existing summary screen.
- Do not require accounts, sync, or backend services.
- Do not store `0` as a played score.

## Recommended Approach

Use a focused active-round state machine inside the active round UI:

- `scoring`: single-hole entry view.
- `review`: full scorecard review before finish.
- Existing summary view after completion remains outside `ActiveRound`, as it is today.

Alternatives considered:

- Keep the all-holes list and improve numeric inputs: smallest code change, but it keeps the weakest part of the mobile experience.
- Use a scorecard-grid-first screen with inline plus/minus buttons: better than inputs, but still splits attention across too many holes and leaves less room for future hole details.
- Single-hole scoring with a review gate: best fit for in-round mobile use. It makes the next action obvious, supports quick correction through the navigator, and gives a deliberate final check before completion.

## User Experience

When a round starts or resumes, the active round screen opens to a single hole.

The single-hole view should show:

- Course name and current round progress.
- Current hole number.
- Par and any existing hole metadata already available, such as stroke index and tee distance.
- A large displayed score value.
- Minus and plus controls.
- Previous and next controls.
- A compact hole navigator.

Score display rules:

- If `strokes` is missing for the selected hole, display `0`.
- Pressing plus on an unplayed hole changes stored strokes from `undefined` to `1`.
- Pressing plus on a played hole increments the positive stroke count by one.
- Pressing minus decrements the score until it reaches `0`.
- Pressing minus from `1` clears stored strokes back to `undefined`.
- Pressing minus at `0` does nothing.

Navigation rules:

- Previous moves to the previous hole and is disabled or visually unavailable on hole 1.
- Next moves to the next hole until the last hole.
- On the last hole, the primary next action becomes review, not finish.
- The hole navigator can jump directly to any hole.
- Navigator items should show played versus unplayed state at a glance.
- Navigation must not automatically assign scores to unplayed holes.

Review rules:

- Review shows every hole with hole number, par, strokes, and score-to-par for that hole.
- Unplayed holes display as `0`, optionally with supporting styling or copy that distinguishes them from played scores, but still map to missing or nullish `strokes` in data.
- The total, completed-hole count, and score-to-par are visible.
- Finish is disabled until all holes have valid positive stroke counts.
- If holes are missing, the review screen should make it easy to return to the first missing hole.
- Completing the round uses the existing `completeRound` path and then shows the existing summary screen.

## Data Model

Do not introduce a new score value for unplayed holes.

The current domain model already supports the required storage semantics:

```ts
interface ScoreEntry {
  holeNumber: number;
  strokes?: number;
  putts?: number;
  penalties?: number;
  fairwayHit?: boolean;
  greenInRegulation?: boolean;
}
```

Use `undefined` for unplayed strokes in React/domain state and allow JSON persistence to omit the field. Treat loaded entries with missing `strokes`, `null`, or invalid non-positive values as unplayed for UI display, while the domain setter should continue accepting only positive integers or `undefined`. If a future persistence or API boundary needs explicit `null`, normalize it before calling the domain setter.

The existing `setHoleStrokes(round, holeNumber, strokes)` rule remains the write boundary for score changes. The UI should convert between display value and domain value:

- Display `0` means domain `undefined`.
- Display `1` or greater means domain positive integer.
- Domain `undefined` means display `0`.

## Component Boundaries

Keep the implementation centered on `ActiveRound`.

Recommended component split:

- `ActiveRound`: owns selected hole index and active mode, delegates score updates through existing callbacks.
- `HoleScoreEntry`: renders one hole, score controls, and hole metadata.
- `HoleNavigator`: compact jump control with played/unplayed state.
- `ScorecardReview`: full pre-finish review and disabled/enabled finish action.

This split is not required if the first implementation remains small, but it is the preferred direction if `ActiveRound` starts mixing navigation, scoring controls, and review rendering in one large component.

`App` should not gain scoring UI knowledge. It should continue passing `round`, `onChangeStrokes`, and `onFinishRound` into `ActiveRound`.

## Future Pro Hole Details

The single-hole surface should reserve a compact metadata area under the hole title or around the score controls. V1 should populate it only with data already present on the course snapshot:

- Par.
- Stroke index when present.
- Tee distance and unit when present.

The layout should be able to grow later without changing scoring behavior. Examples include pro tips, recommended miss, elevation, notes, playing handicap, or shot-planning prompts. Those are future features and should not be implemented in this package.

## Error Handling

- Invalid score changes should be prevented by controls before they reach the domain layer.
- If a callback rejects an invalid score through `setHoleStrokes`, leave the visible score unchanged on the next render.
- Storage failures should keep using the existing app-level storage error behavior.
- Finish should stay disabled until `canCompleteRound(round)` is true.
- If the user navigates back from an active round, the round remains in progress exactly as it does today.

## Accessibility And Mobile Interaction

- Plus and minus controls must be buttons with accessible names that include the hole number.
- The current score should be announced as text, not only color or shape.
- Hole navigator buttons should expose hole number and played/unplayed state.
- The selected hole should be distinguishable without relying only on color.
- Controls should be large enough for touch use on narrow mobile screens.
- The flow should remain usable with keyboard navigation in component tests.

## Testing Strategy

Unit tests:

- Incrementing from an unplayed hole stores a positive stroke value.
- Decrementing from `1` clears strokes to `undefined`.
- Decrementing at displayed `0` does not store `0`.
- `canCompleteRound` remains false while any hole is unplayed.
- Totals continue counting only positive integer strokes.

Component tests:

- Active round opens to hole 1.
- Plus/minus controls update the displayed score and call `onChangeStrokes` with the correct domain value.
- Previous and next navigation move between holes and respect bounds.
- Hole navigator jumps to selected holes and marks played state.
- Last-hole navigation opens review rather than completing directly.
- Review finish button is disabled until all holes are played.
- Review can return the user to a missing hole.
- Completing from review calls `onFinishRound`.

E2E test:

- Start a seeded 9-hole round on a mobile viewport, score holes through previous/next and at least one navigator jump, review the scorecard, finish, and verify the summary/history total.

## Implementation Boundaries

Expected files for the implementation plan:

- `src/components/ActiveRound.tsx`
- Possible new files under `src/components/` for `HoleScoreEntry`, `HoleNavigator`, and `ScorecardReview`
- `src/domain/rounds.test.ts`
- `src/components/RoundDetails.test.tsx` or a dedicated active-round test file
- `e2e/score-round.spec.ts`
- `src/styles.css`

Avoid broad app refactors. The feature should improve active round scoring without changing course selection, provider search, storage shape, or completed round history behavior.

## Success Criteria

- A mobile user can score a round one hole at a time without numeric inputs.
- Unplayed holes visibly show `0` in the scoring UI.
- No persisted or domain score entry stores `0` as strokes.
- Users can move sequentially and jump directly to any hole.
- Users must see a full scorecard review before finishing.
- Finish remains blocked until all holes are played.
- Existing summary, history, round snapshot, and local persistence behavior continue to work.
- The single-hole screen has a clear place for future pro hole details without implementing those details now.

## Open Decisions For Later

- Whether plus from `0` should start at `1` or at par for the hole in a future preference.
- Whether review should show net score, handicap-aware scoring, or side-game details.
- Whether the hole navigator should support swipe gestures.
- Whether future stat fields should appear in the same single-hole flow or behind an advanced scoring mode.
