# V1 Manual Walkthrough

Use this checklist after deploying the GitHub Pages preview. The goal is to find product rough edges that automated tests do not catch.

Preview URL: https://henrymccahon.github.io/golf-scorecards/

## Device Coverage

- [ ] Open on desktop width.
- [ ] Open on a narrow mobile width, around 320-390px.
- [ ] Confirm the app loads without broken icons, blank screens, or missing styles.

## Seeded Course Flow

- [ ] Search for `Lakeview`.
- [ ] Open `Lakeview Nine`.
- [ ] Start a round.
- [ ] Enter valid stroke values for every hole.
- [ ] Confirm the finish button is usable and not hidden by bottom navigation.
- [ ] Finish the round.
- [ ] Confirm the summary shows total score, par, score to par, played date, and hole scores.
- [ ] Open history and confirm the completed round appears with score versus par.

## Provided Course Flow

- [ ] Search for `Augusta`.
- [ ] Confirm `Augusta National` appears under provided courses.
- [ ] Open `Augusta National`.
- [ ] Confirm the course shows as an 18-hole scorecard from the demo provider.
- [ ] Start a round.
- [ ] Enter valid stroke values for every hole.
- [ ] Finish the round.
- [ ] Confirm history shows `Augusta National` and the total.
- [ ] Reload the app and confirm `Augusta National` remains available locally.

## Custom Course Flow

- [ ] Open Courses.
- [ ] Create a custom 9-hole course.
- [ ] Enter a course name and valid par values.
- [ ] Save the course and confirm it appears in the course list.
- [ ] Open the custom course and start a round.
- [ ] Return to the course later and edit it.
- [ ] Confirm the edit warning appears once the course has prior rounds.

## Resume and Recovery Flow

- [ ] Start a round and enter at least one score.
- [ ] Refresh the browser.
- [ ] Resume the in-progress round.
- [ ] Confirm the previously entered score is still present.

## Notes

Record anything that feels slow, confusing, cramped, or awkward. Prioritize issues that block a real golfer from starting, scoring, finishing, or finding a round.
