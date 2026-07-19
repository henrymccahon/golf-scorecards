# Mobile Scoring Polish Design

Date: 2026-07-19

## Summary

Polish the mobile scoring flow after the first deployed QA pass. The scoring model, review gate, plus/minus controls, and persistence rules stay unchanged. This package is limited to small clarity and layout improvements found while testing the deployed app at mobile widths.

The approved scope is:

- Show an accurate top-level page heading while scoring, reviewing, viewing a course, editing a course, or reading a summary.
- Make course detail scorecard rows readable on narrow screens by spacing hole metadata instead of allowing it to run together.
- Keep the last-hole primary action readable at 320px while preserving the accessible action name `Review scorecard`.

## QA Findings

The deployed app was checked at `390x844` and `320x740` mobile viewports.

- The active scoring and review screens still show the app-level heading `Start a round`. This is misleading once a user is already scoring or reviewing a scorecard.
- Course detail rows on mobile visually concatenate metadata, for example `Hole 1Par 4SI 5322 meters`.
- The last-hole primary action can wrap as `Review` / `scorecard` at 320px. It remains usable, but the visual label feels cramped beside the previous button.
- The core scoring controls, compact navigator, review gate, disabled finish state, and bottom navigation remain functional.

## Goals

- Make the current screen context clear without changing navigation behavior.
- Improve course detail row readability on phone-sized screens.
- Keep scoring action labels stable and professional at 320px and above.
- Preserve all existing scoring semantics, tests, and storage behavior.
- Keep the work small enough for a polish branch rather than a redesign.

## Non-Goals

- No scoring model changes.
- No new scoring shortcuts such as set-par, quick scores, or score-to-par chips.
- No change to the scorecard review requirement before finishing.
- No provider search, course import, account, sync, or backend work.
- No bottom navigation redesign.
- No new visual theme.

## Recommended Approach

Use targeted component and CSS changes.

1. Add a small `getPageTitle` decision in `App` based on the current view state. It should prefer concrete screen state over the selected bottom tab:
   - Active round: `Score round`
   - Completed round summary: `Round summary`
   - Editing or creating a course: `Course setup`
   - Selected course detail: `Course scorecard`
   - History tab: `History`
   - Courses tab: `Courses`
   - Default play tab: `Start a round`
2. Update the course detail scorecard row layout so each row uses deliberate inline metadata gaps and wrapping. The markup can stay simple, but the visual layout must not collapse labels together on mobile.
3. Adjust the last-hole navigation button so the visible label is compact on narrow mobile. The accessible label remains `Review scorecard`; visible text may be shortened to `Review` if needed.

Alternatives considered:

- Broader mobile redesign: would also revisit review density, bottom nav spacing, and 18-hole layouts. This is more work than the observed issues require.
- Add scoring convenience features: useful later, but it changes product behavior and should get its own design.
- Leave the UI as-is: the flow is functional, but the stale heading is confusing and the cramped course rows reduce trust.

## User Experience

When a user starts or resumes a round, the app header should say `Score round`, then the active round component continues to show the course name and current hole details.

When a user opens the review screen, the app header should still reflect that the user is in scoring context rather than returning to `Start a round`. The review component heading `Scorecard review` remains the more specific in-screen title.

When a user opens a course detail screen, the app header should say `Course scorecard`. The course name remains the primary title inside the screen. Hole cards should show readable metadata with spacing between `Hole N`, `Par N`, `SI N`, and distance.

At 320px, the previous/review control row should not feel cramped. The last-hole primary button may display `Review` while keeping `aria-label="Review scorecard"` and the existing tests or accessible contracts can continue targeting the full label.

## Component Boundaries

Expected code changes:

- `src/App.tsx`: derive the app header title from current screen state.
- `src/components/CourseDetail.tsx`: optionally group hole card metadata for better styling while preserving visible text.
- `src/components/ActiveRound.tsx`: adjust the visible last-hole primary button label if needed.
- `src/styles.css`: add or tighten layout rules for course detail cards and narrow navigation controls.
- Tests only where they assert screen titles or button labels.

Do not move scoring state out of `ActiveRound`. Do not change `ScorecardReview`, `HoleNavigator`, or domain code unless a test reveals a direct dependency on the polish changes.

## Testing Strategy

Automated tests:

- Update app-level tests if the app header title appears in queries affected by the new contextual title.
- Keep active round component tests passing, especially the accessible `Review scorecard` control.
- Run the focused affected tests first, then full verification:
  - `npm test -- --run src/App.test.tsx src/components/ActiveRound.test.tsx`
  - `npm test -- --run`
  - `npm run build`

Rendered QA:

- Verify the deployed or local app at `390x844` and `320x740`.
- Check course detail rows for readable metadata spacing.
- Check active scoring and review screens for correct top-level heading.
- Check last-hole navigation at 320px for a readable visual action.
- Check console errors and warnings during the flow.

## Risks

- Changing the app-level heading can affect tests that rely on generic heading text. Prefer exact accessible queries where appropriate.
- Shortening the visible review button text must not remove the accessible name used by tests and assistive technology.
- Course detail row styling should not make 18-hole scorecards harder to scan.

## Success Criteria

- Mobile scoring and review no longer show `Start a round` as the app-level heading.
- Course detail rows have visible spacing between hole metadata on mobile.
- The last-hole primary action remains readable at 320px.
- Existing scoring behavior, review gate behavior, summaries, history, and persistence continue to pass tests.
- No new console errors or framework overlays appear during mobile QA.
