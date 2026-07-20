# Scoring Context Polish Design

Date: 2026-07-20

## Summary

Improve the active scoring and scorecard review screens with clearer per-hole context while keeping scoring behavior unchanged.

The active mobile scoring screen already shows hole metadata such as par, stroke index, and tee distance. This slice should build on that foundation by making the current hole's score-to-par easier to understand, making unplayed state clearer, and bringing compact metadata into scorecard review cards where it helps scanning.

This is a focused polish pass. It should not introduce advanced scoring fields, scoring shortcuts, persistence changes, or a broader redesign.

## Goals

- Show a clear current-hole score-to-par readout on the active scoring screen.
- Make the unplayed active-hole state clearer without changing the displayed score of `0`.
- Keep Par, SI, and tee distance visible as read-only context on the active hole.
- Add compact SI and distance metadata to scorecard review cards where available.
- Preserve the existing plus/minus controls, previous/next navigation, hole navigator, review gate, finish behavior, totals, and persistence.
- Keep the mobile layout readable at 320px.

## Non-Goals

- Do not change the scoring model.
- Do not store `0` for unplayed holes.
- Do not add putts, penalties, fairways, greens, notes, shot prompts, or pro features.
- Do not add quick-score actions such as set-par, bogey, birdie, or pickup.
- Do not change resume, abandon, history, provider search, custom course editing, or round completion behavior.
- Do not redesign the bottom navigation, page shell, or app theme.

## Recommended Approach

Use small component and CSS changes in the scoring surface.

1. Add a current-hole score-to-par label to `HoleScoreEntry`.
   - Unplayed: `No score yet`
   - At par: `Even on this hole`
   - Over par: `+1 on this hole`
   - Under par: `-1 on this hole`
2. Keep the displayed score output as-is. Unplayed holes still display `0`, the decrement button remains disabled at `0`, and the domain setter continues to receive `undefined` when a score is cleared.
3. Keep the existing active-hole metadata chips, but adjust layout only if needed so the score-to-par label and metadata do not compete on 320px screens.
4. Extend scorecard review cards with compact metadata below the existing score information:
   - `SI 4` when stroke index is present.
   - `372 yards` or `340 meters` when tee distance is present.
   - Use wrapping text or stacked small text so cards do not overflow.

Alternatives considered:

- Minimal active-hole copy only: lowest risk, but review remains less informative for 18-hole scanning.
- Bigger scoring context with notes and stats: useful later, but it changes the product surface and is too much for this slice.
- Full review redesign: may be worthwhile later, but the current review grid is already functional and should not be replaced for this small pass.

## User Experience

On the active scoring screen, the user still sees one hole at a time with the same plus/minus scoring controls. Below or near the large score value, the screen should explain what that score means relative to par.

Examples:

- Hole 1, Par 4, no strokes entered: displayed score `0`, context `No score yet`.
- Hole 1, Par 4, score 4: displayed score `4`, context `Even on this hole`.
- Hole 1, Par 4, score 5: displayed score `5`, context `+1 on this hole`.
- Hole 1, Par 4, score 3: displayed score `3`, context `-1 on this hole`.

On scorecard review, each hole remains tappable for editing. The current score and score-to-par stay prominent, while SI and distance provide enough context to identify and compare holes without opening each one.

## Component Boundaries

Expected code changes:

- `src/components/HoleScoreEntry.tsx`: receive or derive current-hole score-to-par display text and render it near the score output.
- `src/components/ActiveRound.tsx`: pass enough data into `HoleScoreEntry` to format the active-hole context without moving scoring state out of `ActiveRound`.
- `src/components/ScorecardReview.tsx`: render optional SI and tee distance metadata in each review card.
- `src/components/ActiveRound.test.tsx`: add focused tests for unplayed, even, over-par, and under-par active-hole context.
- `src/styles.css`: add compact styles for the score context label and review metadata.

Avoid domain changes unless implementation reveals duplicated score-to-par formatting that is better expressed as a tiny shared helper. If a helper is added, it should be presentation-oriented and should not change round totals or persistence.

## Data Behavior

No data shape changes are planned.

Unplayed holes continue to be represented by missing or `undefined` `strokes` values in React/domain state and JSON persistence. The UI may display `0` and `No score yet`, but abandon, resume, complete, totals, and local storage behavior must remain unchanged.

Review metadata comes from each round's `courseSnapshot.holes`, not the editable current course definition. This preserves historical accuracy if a course is edited after a round starts.

## Accessibility

- The large score output keeps its existing accessible label, such as `Hole 1 displayed score`.
- The new current-hole context should be visible text and available to assistive technology.
- Review cards remain buttons with clear hole names and score information.
- Metadata must not rely only on color or iconography.
- Text must wrap or stack at 320px rather than overflow.

## Testing Strategy

Automated tests should cover:

- Active scoring shows `No score yet` for an unplayed hole while the displayed score remains `0`.
- Active scoring shows `Even on this hole` for a score equal to par.
- Active scoring shows positive and negative score-to-par labels for over-par and under-par scores.
- Scorecard review shows SI and tee distance metadata when those fields exist.
- Existing navigation, review, finish, and persistence tests continue to pass.

Suggested commands:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx
npm test -- --run
npm run build
```

Rendered QA:

- Check the active scoring screen at 320px with unplayed, even, and over-par states.
- Check scorecard review at 320px for a 9-hole and 18-hole round.
- Confirm no horizontal overflow, overlapping text, console errors, or framework overlays.

## Risks

- Adding too much text near the large score could crowd the primary scoring control.
- Review cards are already dense on 320px screens; metadata must stay compact.
- Score-to-par copy must not imply that an unplayed `0` is an actual score.
- Shared formatting should not accidentally change total score-to-par formatting elsewhere.

## Success Criteria

- The active hole clearly distinguishes `0` as unplayed with `No score yet`.
- Played holes show an easy-to-read current-hole score-to-par label.
- Review cards include useful SI and distance context without becoming cramped or overflowing.
- Existing scoring behavior and persistence remain unchanged.
- The app remains readable and usable at 320px.
