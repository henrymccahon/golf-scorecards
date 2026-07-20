# In-Progress Round Guardrails Design

Date: 2026-07-19

## Summary

Make the single in-progress round rule explicit in the UI and add a safe way to abandon an unfinished round.

The current app already behaves as if only one round can be actively started at a time: when a user taps `Start round` for any course while another round is in progress, the app silently resumes the existing round. That protects the app from uncontrolled draft creation, but it is surprising because the button promises a new round on the selected course.

The next slice should keep the one-active-round constraint, remove the silent redirect, and give users a clear escape hatch when the saved draft is no longer wanted.

## Goals

- Stop `Start round` from silently opening a different course's in-progress round.
- Keep the app's current single active round model for now.
- Make same-course resume behavior clear from the course detail screen.
- Block starting a different course while another in-progress round exists.
- Let users abandon an in-progress round after confirmation.
- Remove abandoned in-progress rounds from local persistence.
- Preserve completed round history, score calculation, course storage, provider search, and the mobile scoring flow.
- Keep this as a focused polish and bugfix slice.

## Non-Goals

- Do not support multiple new in-progress rounds from normal course start.
- Do not add an abandoned-round history or audit trail.
- Do not add undo after abandon.
- Do not change completed round deletion or history management.
- Do not add player management, round naming, backend sync, or accounts.
- Do not redesign the Play screen beyond the in-progress round guardrails.

## Recommended Approach

Keep the existing product rule: one round can be in progress through the normal start flow.

Change the UI contract around that rule:

- If no in-progress round exists, course detail shows `Start round`.
- If the selected course already has an in-progress round, course detail shows `Resume round`.
- If a different course has an in-progress round, course detail does not offer a misleading start action. It shows a short blocking message plus direct actions to resume or abandon the existing round.
- In-progress resume cards expose an `Abandon` action behind confirmation.

Alternatives considered:

- Allow multiple active drafts from course detail. This is flexible, but without abandon/delete controls it can create clutter and make accidental rounds easy to accumulate.
- Keep the silent resume behavior and only improve copy. This is the smallest code change, but it still makes the selected course detail screen behave unexpectedly.
- Add an `abandoned` round status. This may be useful later for analytics or audit history, but for the current local-first app it adds storage and history complexity without a user-facing need.

## User Experience

### No In-Progress Round

Course detail behaves as it does today:

- Primary action: `Start round`.
- Tapping it creates a new in-progress round for the selected course and opens Hole 1.

### Same Course Has An In-Progress Round

When the selected course matches an existing in-progress round:

- Primary action: `Resume round`.
- Supporting copy can mention the current progress, such as `1/9 holes complete`.
- Tapping it resumes the existing round using the same resume-target behavior as the Play screen card.

This avoids duplicate drafts for the same course and makes the action truthful.

### Different Course Has An In-Progress Round

When another course has an in-progress round:

- Do not show an enabled `Start round` button for the selected course.
- Show a compact blocking message, for example: `Finish or abandon Lakeview Nine before starting another round.`
- Provide a clear action to `Resume Lakeview Nine`.
- Provide a secondary action to `Abandon Lakeview Nine`.
- Keep the selected course details visible so the user understands why their intended action is unavailable.

The user should never tap a button on `Parklands Championship` and unexpectedly land in `Lakeview Nine`.

### Abandoning A Round

Each in-progress resume card should provide an `Abandon` action separate from the main resume action.

Interaction rules:

- Tapping `Abandon` opens an in-app confirmation panel.
- The confirmation identifies the course and explains that score progress for the unfinished round will be discarded.
- Confirming removes that in-progress round from the saved rounds collection.
- Canceling leaves the round untouched and keeps the user on the current screen.
- After abandon, the Play screen updates immediately. If no other in-progress round exists, users can start a new round from any course.

The confirmation should be implemented in-app rather than with the browser's native confirmation prompt. An inline panel near the abandoned round is enough; this does not need to be a global modal.

## Data Behavior

Abandon should delete the in-progress `Round` from the persisted `rounds` array.

Do not add a new status value in this slice. The current status model remains:

- `in_progress`
- `completed`

Deletion should only apply to rounds whose status is `in_progress`. Completed rounds must not be removed by this flow.

If older or unusual storage data contains multiple in-progress rounds, keep showing all resume cards. Each can be resumed or abandoned individually. The normal `Start round` flow should still be blocked while any in-progress round for another course remains.

## Component Boundaries

Expected code changes:

- `src/App.tsx`: derive course-detail start state from `inProgressRounds`, route same-course resumes explicitly, block different-course starts, coordinate abandon confirmation state, and remove abandoned in-progress rounds from state/storage.
- `src/components/CourseDetail.tsx`: render the correct primary action, blocked state, resume action, and supporting copy based on props from `App`.
- `src/components/CourseList.tsx`: add a secondary abandon action and confirmation panel for each in-progress resume card without making the whole card interaction ambiguous.
- `src/styles.css`: add compact styles for blocked-start messaging, secondary abandon actions, and inline confirmation panels.
- `src/App.test.tsx` and component tests: update the existing silent-redirect test and add coverage for abandon.

Keep scoring UI state inside `ActiveRound`. This slice should not change plus/minus scoring, hole navigation, review, finish behavior, totals, or history rendering.

## Accessibility

- The main resume card must remain a button or equivalent accessible action.
- The abandon action must be independently focusable and have an accessible name that includes the course name.
- The inline confirmation panel must expose both cancel and confirm actions as buttons.
- Confirmation text must be visible and must not rely only on color or iconography.
- Blocked course detail messaging should be visible text, not only disabled-button state.

## Testing Strategy

Automated tests should cover:

- Starting a round with no in-progress rounds still opens a new round on Hole 1.
- Viewing the same course as an in-progress round shows `Resume round` and resumes that round.
- Viewing a different course while an in-progress round exists blocks new start and offers resume for the existing round.
- Tapping the blocked-course resume action opens the existing round rather than creating a new one.
- Tapping the blocked-course abandon action opens confirmation for the blocking round.
- Abandon cancel leaves the in-progress round visible and persisted.
- Abandon confirm removes the in-progress round from the Play screen and local storage.
- Abandon does not remove completed rounds.
- Loaded multiple in-progress rounds remain individually resumable and individually abandonable.

Suggested verification:

- `npm test -- --run src/App.test.tsx`
- `npm test -- --run`
- `npm run build`
- `npm run e2e`

Rendered QA:

- At 320px, verify the Play screen with one in-progress round shows resume and abandon without overlap.
- At 320px, verify course detail for a blocked different course explains the constraint and exposes resume and abandon actions.
- Verify abandon cancel and confirm behavior.
- Check console warnings and errors during blocked-start and abandon flows.

## Risks

- Putting a secondary `Abandon` button inside or near a clickable resume card can create nested-button or accidental-tap problems. The implementation should avoid invalid nested interactive elements.
- Inline confirmation panels can crowd narrow screens if they are too verbose.
- Removing an in-progress round from storage is destructive. The confirmation copy must be clear.
- Existing tests currently assert the silent redirect behavior, so they must be replaced rather than preserved.

## Success Criteria

- Users cannot accidentally start a different course and get silently redirected to an existing round.
- Same-course in-progress rounds are clearly resumable from course detail.
- Different-course starts are clearly blocked until the existing round is finished or abandoned.
- Users can abandon unwanted in-progress rounds without resetting all app data.
- Abandon removes only unfinished rounds and leaves completed history intact.
- The Play screen and course detail remain readable and usable at 320px.
