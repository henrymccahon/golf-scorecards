# In-Progress Round Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the one in-progress round rule explicit, prevent silent redirects from course detail, and let users abandon unwanted unfinished rounds after confirmation.

**Architecture:** Keep `App.tsx` as the owner of saved round state, active round navigation, and abandon confirmation state. Keep `CourseDetail` and `CourseList` presentational: they receive explicit action props and never mutate round state themselves. Add one small reusable confirmation component so Play resume cards and blocked course detail use the same abandon copy and controls.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Playwright e2e, localStorage persistence.

## Global Constraints

- Keep the app's current single active round model for now.
- Do not support multiple new in-progress rounds from normal course start.
- Do not add an abandoned-round history or audit trail.
- Do not add undo after abandon.
- Do not change completed round deletion or history management.
- Do not add player management, round naming, backend sync, or accounts.
- Preserve completed round history, score calculation, course storage, provider search, and the mobile scoring flow.
- Abandon should delete the in-progress `Round` from the persisted `rounds` array.
- Deletion should only apply to rounds whose status is `in_progress`.
- The inline confirmation panel must expose both cancel and confirm actions as buttons.
- Confirmation text must be visible and must not rely only on color or iconography.
- Blocked course detail messaging should be visible text, not only disabled-button state.
- Avoid invalid nested interactive elements when adding `Abandon` near resume cards.
- Use repository git commands beginning with `git --git-dir=work\golf-scorecard-design.git --work-tree=.`
- Do not stage or commit existing untracked `.superpowers/sdd/*` scratch files or the unrelated modified `docs/superpowers/specs/2026-07-19-mobile-scoring-polish-design.md`.

---

## File Structure

- `src/App.tsx`: derive course detail action state from `inProgressRounds`, remove silent start-to-resume redirect, own abandon candidate state, delete only in-progress rounds, persist changes, and pass action props to child components.
- `src/components/CourseDetail.tsx`: render `Start round`, `Resume round`, or blocked-start messaging based on a typed `roundAction` prop. Later tasks add blocked-course abandon confirmation through props.
- `src/components/CourseList.tsx`: keep resume card semantics, but wrap each card in a non-interactive container so a separate `Abandon` button can live beside it without nested buttons.
- `src/components/AbandonRoundConfirmation.tsx`: reusable inline confirmation panel for abandoning an unfinished round.
- `src/App.test.tsx`: app-level integration tests for guardrails, abandon cancel/confirm, persistence, completed-round preservation, and legacy multiple in-progress drafts.
- `src/components/CourseDetail.test.tsx`: component-level tests for new `CourseDetail` action states.
- `src/styles.css`: compact styling for blocked-start panel, resume-card action row, abandon confirmation panel, and destructive button.

---

### Task 1: Explicit Course Detail Guardrails

**Files:**
- Modify: `src/components/CourseDetail.tsx`
- Modify: `src/components/CourseDetail.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces exported type:

```ts
export type CourseDetailRoundAction =
  | { type: 'start' }
  | { type: 'resume'; roundId: string; courseName: string; progressLabel: string }
  | { type: 'blocked'; roundId: string; courseName: string; progressLabel: string };
```

- Produces `CourseDetail` props:

```ts
interface CourseDetailProps {
  course: Course;
  roundAction?: CourseDetailRoundAction;
  onBack(): void;
  onStartRound(courseId: string): void;
  onResumeRound(roundId: string): void;
  onEditCourse(courseId: string): void;
}
```

- Consumes existing `getRoundTotals(round)` from `src/domain/rounds.ts`.
- Later tasks extend `CourseDetailRoundAction` blocked behavior with abandon callbacks, so keep the discriminated union small and explicit.

- [ ] **Step 1: Add failing CourseDetail component tests for start, resume, and blocked states**

In `src/components/CourseDetail.test.tsx`, replace the test named `keeps start and edit callbacks unchanged` with these tests:

```tsx
  it('starts a new round when no in-progress round blocks the course', async () => {
    const onStartRound = vi.fn();
    const onEditCourse = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{ type: 'start' }}
        onBack={() => undefined}
        onStartRound={onStartRound}
        onResumeRound={() => undefined}
        onEditCourse={onEditCourse}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit course' }));

    expect(onStartRound).toHaveBeenCalledWith('course-1');
    expect(onEditCourse).toHaveBeenCalledWith('course-1');
  });

  it('resumes the same course in-progress round from course detail', async () => {
    const onResumeRound = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{
          type: 'resume',
          roundId: 'round-1',
          courseName: 'Polish Nine',
          progressLabel: '1/9 holes complete'
        }}
        onBack={() => undefined}
        onStartRound={() => undefined}
        onResumeRound={onResumeRound}
        onEditCourse={() => undefined}
      />
    );

    expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument();
    expect(screen.getByText('1/9 holes complete')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume round' }));

    expect(onResumeRound).toHaveBeenCalledWith('round-1');
  });

  it('blocks starting a different course while another round is in progress', async () => {
    const onResumeRound = vi.fn();
    const onStartRound = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{
          type: 'blocked',
          roundId: 'round-1',
          courseName: 'Lakeview Nine',
          progressLabel: '1/9 holes complete'
        }}
        onBack={() => undefined}
        onStartRound={onStartRound}
        onResumeRound={onResumeRound}
        onEditCourse={() => undefined}
      />
    );

    expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument();
    expect(screen.getByText('Finish or abandon Lakeview Nine before starting another round.')).toBeInTheDocument();
    expect(screen.getByText('1/9 holes complete')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume Lakeview Nine' }));

    expect(onResumeRound).toHaveBeenCalledWith('round-1');
    expect(onStartRound).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run CourseDetail tests to verify they fail**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx
```

Expected: FAIL because `CourseDetail` does not accept `roundAction` or `onResumeRound`, and still always renders `Start round`.

- [ ] **Step 3: Implement CourseDetail action rendering**

In `src/components/CourseDetail.tsx`, replace the whole file with:

```tsx
import { calculateCoursePar, getCourseSourceLabel } from '../domain/courses';
import type { Course } from '../domain/types';

export type CourseDetailRoundAction =
  | { type: 'start' }
  | { type: 'resume'; roundId: string; courseName: string; progressLabel: string }
  | { type: 'blocked'; roundId: string; courseName: string; progressLabel: string };

interface CourseDetailProps {
  course: Course;
  roundAction?: CourseDetailRoundAction;
  onBack(): void;
  onStartRound(courseId: string): void;
  onResumeRound(roundId: string): void;
  onEditCourse(courseId: string): void;
}

export function CourseDetail({
  course,
  roundAction = { type: 'start' },
  onBack,
  onStartRound,
  onResumeRound,
  onEditCourse
}: CourseDetailProps) {
  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{course.name}</h1>
        <p>{course.holeCount} holes · Par {calculateCoursePar(course)} · {getCourseSourceLabel(course)}</p>
      </header>
      <div className="scorecard-grid">
        {course.holes.map((hole) => (
          <div
            key={hole.number}
            className="hole-card course-detail-hole-card"
            data-testid={`course-detail-hole-${hole.number}`}
          >
            <strong>Hole {hole.number}</strong>
            <div className="course-detail-hole-meta" data-testid={`course-detail-hole-${hole.number}-metadata`}>
              <span>Par {hole.par}</span>
              {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
              {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
            </div>
          </div>
        ))}
      </div>
      {roundAction.type === 'start' ? (
        <button className="primary-button" onClick={() => onStartRound(course.id)}>Start round</button>
      ) : null}
      {roundAction.type === 'resume' ? (
        <div className="round-action-panel">
          <p className="round-action-note">{roundAction.progressLabel}</p>
          <button className="primary-button" onClick={() => onResumeRound(roundAction.roundId)}>Resume round</button>
        </div>
      ) : null}
      {roundAction.type === 'blocked' ? (
        <div className="blocked-round-panel" role="status">
          <p>Finish or abandon {roundAction.courseName} before starting another round.</p>
          <p className="round-action-note">{roundAction.progressLabel}</p>
          <button className="secondary-button" onClick={() => onResumeRound(roundAction.roundId)}>
            Resume {roundAction.courseName}
          </button>
        </div>
      ) : null}
      {course.source === 'custom' ? (
        <button className="secondary-button" onClick={() => onEditCourse(course.id)}>Edit course</button>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run CourseDetail tests to verify they pass**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx
```

Expected: PASS for all `CourseDetail` tests.

- [ ] **Step 5: Add failing App integration tests for same-course resume and different-course blocking**

In `src/App.test.tsx`, replace the test named `routes a new start request to the existing in-progress round` with:

```tsx
  it('resumes a same-course in-progress round from course detail', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    for (let stroke = 0; stroke < 5; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: /Lakeview Nine 9 holes · Par 36 · seeded/ }));

    expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument();
    expect(screen.getByText('1/9 holes complete')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume round' }));

    expect(screen.getByRole('heading', { name: 'Lakeview Nine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hole 2 displayed score')).toHaveTextContent('0');
  });

  it('blocks starting a different course while another course is in progress', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: /Parklands Championship 18 holes · Par 72 · seeded/ }));

    expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument();
    expect(screen.getByText('Finish or abandon Lakeview Nine before starting another round.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume Lakeview Nine' }));

    expect(screen.getByRole('heading', { name: 'Lakeview Nine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hole 18,/ })).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Run the new App guardrail tests to verify they fail**

Run:

```powershell
npm test -- --run src/App.test.tsx -t "same-course|blocks starting"
```

Expected: FAIL because `App` does not pass `roundAction` or `onResumeRound` to `CourseDetail`, and `startRound` still silently resumes the first in-progress round.

- [ ] **Step 7: Wire App round action state and remove silent redirect**

In `src/App.tsx`, change the imports from `./domain/rounds` and `./components/CourseDetail` to:

```tsx
import { completeRound, createRoundFromCourse, getRoundResumeTarget, getRoundTotals, setHoleStrokes } from './domain/rounds';
import { CourseDetail, type CourseDetailRoundAction } from './components/CourseDetail';
```

Keep the rest of the imports unchanged.

After `const summaryRound = rounds.find((round) => round.id === summaryRoundId);`, add:

```tsx
  const selectedCourseRoundAction = selectedCourse ? getCourseDetailRoundAction(selectedCourse) : undefined;
```

Replace `startRound` with:

```tsx
  function startRound(courseId: string): void {
    if (recoveryRequired) return;
    if (inProgressRounds.length > 0) return;

    const course = courses.find((existingCourse) => existingCourse.id === courseId);
    if (!course) return;
    if (validateCourse(course).length > 0) {
      setStorageError('This course has invalid scorecard data and cannot be started.');
      return;
    }

    const round = createRoundFromCourse(course, {
      id: `round-${Date.now()}`,
      startedAt: new Date().toISOString()
    });
    const nextRounds = [...roundsRef.current, round];

    replaceRounds(nextRounds);
    persist(savedCoursesRef.current, nextRounds);
    invalidateProviderLoad();
    setSelectedCourseId(undefined);
    setActiveRoundInitialTarget(undefined);
    setActiveRoundId(round.id);
    setSummaryRoundId(undefined);
    setActiveTab('play');
  }
```

Before `const pageTitle = getPageTitle();`, add these helpers:

```tsx
  function getCourseDetailRoundAction(course: Course): CourseDetailRoundAction {
    const matchingInProgressRound = inProgressRounds.find((round) => isRoundForCourse(round, course));

    if (matchingInProgressRound) {
      return {
        type: 'resume',
        roundId: matchingInProgressRound.id,
        courseName: matchingInProgressRound.courseSnapshot.name,
        progressLabel: getRoundProgressLabel(matchingInProgressRound)
      };
    }

    if (inProgressRound) {
      return {
        type: 'blocked',
        roundId: inProgressRound.id,
        courseName: inProgressRound.courseSnapshot.name,
        progressLabel: getRoundProgressLabel(inProgressRound)
      };
    }

    return { type: 'start' };
  }

  function isRoundForCourse(round: Round, course: Course): boolean {
    return round.courseId === course.id || round.courseSnapshot.id === course.id;
  }
```

After the `App` component closing brace, add:

```tsx
function getRoundProgressLabel(round: Round): string {
  const totals = getRoundTotals(round);
  return `${totals.completedHoles}/${round.courseSnapshot.holeCount} holes complete`;
}
```

Replace the `CourseDetail` render line with:

```tsx
      {!activeRound && !summaryRound && !editingCourseId && selectedCourse ? <CourseDetail course={selectedCourse} roundAction={selectedCourseRoundAction} onBack={() => setSelectedCourseId(undefined)} onStartRound={startRound} onResumeRound={resumeRound} onEditCourse={editCourse} /> : null}
```

- [ ] **Step 8: Run guardrail tests to verify they pass**

Run:

```powershell
npm test -- --run src/App.test.tsx -t "same-course|blocks starting"
```

Expected: PASS for the two guardrail tests.

- [ ] **Step 9: Run focused CourseDetail and App suites**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx src/App.test.tsx
```

Expected: PASS for both files.

- [ ] **Step 10: Commit Task 1**

Run:

```powershell
git --git-dir=work\golf-scorecard-design.git --work-tree=. status --short
git --git-dir=work\golf-scorecard-design.git --work-tree=. add src/App.tsx src/App.test.tsx src/components/CourseDetail.tsx src/components/CourseDetail.test.tsx
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "feat: guard in-progress round starts"
```

Expected: commit includes only the four Task 1 files.

---

### Task 2: Abandon From Play Resume Cards

**Files:**
- Create: `src/components/AbandonRoundConfirmation.tsx`
- Modify: `src/components/CourseList.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes `AbandonRoundConfirmation`:

```tsx
interface AbandonRoundConfirmationProps {
  courseName: string;
  onCancel(): void;
  onConfirm(): void;
}
```

- Produces new `CourseList` props:

```tsx
  abandonCandidateRoundId?: string;
  onRequestAbandonRound(roundId: string): void;
  onCancelAbandonRound(): void;
  onConfirmAbandonRound(roundId: string): void;
```

- Produces `App` functions:

```tsx
function requestAbandonRound(roundId: string): void
function cancelAbandonRound(): void
function confirmAbandonRound(roundId: string): void
```

- `confirmAbandonRound(roundId)` removes only matching rounds with `status === 'in_progress'`.

- [ ] **Step 1: Add failing App tests for abandon cancel and confirm from Play**

In `src/App.test.tsx`, change the domain import to:

```tsx
import { completeRound, createRoundFromCourse } from './domain/rounds';
```

Add these tests after `resumes a fully scored in-progress round to scorecard review`:

```tsx
  it('cancels abandoning an in-progress round from the Play screen', async () => {
    const round = createRoundFromCourse(seedCourses[0], {
      id: 'round-1',
      startedAt: '2026-07-20T01:00:00.000Z'
    });
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [round] }));

    renderAppWithExistingStorage(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine' }));

    expect(screen.getByText('Abandon Lakeview Nine?')).toBeInTheDocument();
    expect(screen.getByText('Score progress for this unfinished round will be discarded.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Keep round' }));

    expect(screen.queryByText('Abandon Lakeview Nine?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume Lakeview Nine, 0\/9 holes, Total 0, E, Next: Hole 1/ })).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
    expect(stored.rounds).toHaveLength(1);
    expect(stored.rounds[0].id).toBe('round-1');
  });

  it('abandons an in-progress round from the Play screen without removing completed history', async () => {
    const inProgressRound = createRoundFromCourse(seedCourses[0], {
      id: 'round-1',
      startedAt: '2026-07-20T01:00:00.000Z'
    });
    const completedDraft = createRoundFromCourse(seedCourses[1], {
      id: 'round-2',
      startedAt: '2026-07-19T01:00:00.000Z'
    });
    const completedRound = completeRound({
      ...completedDraft,
      scores: completedDraft.scores.map((score) => ({ ...score, strokes: 4 }))
    }, '2026-07-19T05:00:00.000Z');
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [inProgressRound, completedRound] }));

    renderAppWithExistingStorage(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine permanently' }));

    expect(screen.queryByRole('button', { name: /Resume Lakeview Nine/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Parklands Championship')).toBeInTheDocument();
    expect(screen.getByText(/Total 72/)).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
    expect(stored.rounds).toHaveLength(1);
    expect(stored.rounds[0]).toMatchObject({ id: 'round-2', status: 'completed' });
  });
```

- [ ] **Step 2: Run abandon tests to verify they fail**

Run:

```powershell
npm test -- --run src/App.test.tsx -t "abandon"
```

Expected: FAIL because no abandon controls or confirmation panel exist.

- [ ] **Step 3: Create reusable abandon confirmation component**

Create `src/components/AbandonRoundConfirmation.tsx`:

```tsx
interface AbandonRoundConfirmationProps {
  courseName: string;
  onCancel(): void;
  onConfirm(): void;
}

export function AbandonRoundConfirmation({ courseName, onCancel, onConfirm }: AbandonRoundConfirmationProps) {
  return (
    <div className="abandon-confirmation" role="status">
      <p><strong>Abandon {courseName}?</strong></p>
      <p>Score progress for this unfinished round will be discarded.</p>
      <div className="confirmation-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Keep round</button>
        <button className="danger-button" type="button" onClick={onConfirm}>
          Abandon {courseName} permanently
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update CourseList props and render separate resume/abandon controls**

In `src/components/CourseList.tsx`, add the import:

```tsx
import { AbandonRoundConfirmation } from './AbandonRoundConfirmation';
```

Update `CourseListProps` with:

```tsx
  abandonCandidateRoundId?: string;
  onRequestAbandonRound(roundId: string): void;
  onCancelAbandonRound(): void;
  onConfirmAbandonRound(roundId: string): void;
```

Update the function destructuring with:

```tsx
  abandonCandidateRoundId,
  onRequestAbandonRound,
  onCancelAbandonRound,
  onConfirmAbandonRound,
```

Replace the existing `return (` block inside the `inProgressRounds.map((round) => {` callback with:

```tsx
        return (
          <div key={round.id} className="resume-card">
            <button
              className="resume-banner"
              aria-label={`Resume ${round.courseSnapshot.name}, ${progress}, ${totalLabel}, ${scoreLabel}, ${nextAction}`}
              onClick={() => onResumeRound(round.id)}
            >
              <span>
                <strong>{round.courseSnapshot.name}</strong>
                <small>{progress} · {totalLabel} · {scoreLabel}</small>
              </span>
              <span className="resume-action">{nextAction}</span>
            </button>
            <div className="resume-card-actions">
              <button
                className="text-button abandon-action"
                type="button"
                aria-label={`Abandon ${round.courseSnapshot.name}`}
                onClick={() => onRequestAbandonRound(round.id)}
              >
                Abandon
              </button>
            </div>
            {abandonCandidateRoundId === round.id ? (
              <AbandonRoundConfirmation
                courseName={round.courseSnapshot.name}
                onCancel={onCancelAbandonRound}
                onConfirm={() => onConfirmAbandonRound(round.id)}
              />
            ) : null}
          </div>
        );
```

- [ ] **Step 5: Add abandon state and deletion behavior to App**

In `src/App.tsx`, add state after `summaryRoundId`:

```tsx
  const [abandonCandidateRoundId, setAbandonCandidateRoundId] = useState<string>();
```

In `showCourseList`, before `setSummaryRoundId(undefined);`, add:

```tsx
    setAbandonCandidateRoundId(undefined);
```

In `selectCourse`, `editCourse`, and `createCourse`, add this line after `invalidateProviderLoad();`:

```tsx
    setAbandonCandidateRoundId(undefined);
```

In `resumeRound`, before `setActiveTab('play');`, add:

```tsx
    setAbandonCandidateRoundId(undefined);
```

Before `openCompletedRound`, add:

```tsx
  function requestAbandonRound(roundId: string): void {
    setAbandonCandidateRoundId(roundId);
  }

  function cancelAbandonRound(): void {
    setAbandonCandidateRoundId(undefined);
  }

  function confirmAbandonRound(roundId: string): void {
    if (recoveryRequired) return;

    const nextRounds = roundsRef.current.filter((round) =>
      round.id !== roundId || round.status !== 'in_progress'
    );

    if (nextRounds.length === roundsRef.current.length) {
      setAbandonCandidateRoundId(undefined);
      return;
    }

    replaceRounds(nextRounds);
    persist(savedCoursesRef.current, nextRounds);
    setAbandonCandidateRoundId(undefined);

    if (activeRoundId === roundId) {
      setActiveRoundId(undefined);
      setActiveRoundInitialTarget(undefined);
    }

    if (summaryRoundId === roundId) {
      setSummaryRoundId(undefined);
    }
  }
```

In the `CourseList` render props, add:

```tsx
          abandonCandidateRoundId={abandonCandidateRoundId}
          onRequestAbandonRound={requestAbandonRound}
          onCancelAbandonRound={cancelAbandonRound}
          onConfirmAbandonRound={confirmAbandonRound}
```

- [ ] **Step 6: Run abandon tests to verify they pass**

Run:

```powershell
npm test -- --run src/App.test.tsx -t "abandon"
```

Expected: PASS for the Play screen abandon cancel/confirm tests.

- [ ] **Step 7: Update multiple in-progress test to assert individual abandon controls**

In the test named `exposes every persisted in-progress round for resuming`, add these assertions before the click that resumes Parklands:

```tsx
    expect(screen.getByRole('button', { name: 'Abandon Lakeview Nine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abandon Parklands Championship' })).toBeInTheDocument();
```

Then keep the existing resume click/assertions unchanged.

- [ ] **Step 8: Run focused App tests**

Run:

```powershell
npm test -- --run src/App.test.tsx
```

Expected: PASS for all App tests.

- [ ] **Step 9: Commit Task 2**

Run:

```powershell
git --git-dir=work\golf-scorecard-design.git --work-tree=. status --short
git --git-dir=work\golf-scorecard-design.git --work-tree=. add src/App.tsx src/App.test.tsx src/components/CourseList.tsx src/components/AbandonRoundConfirmation.tsx
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "feat: abandon in-progress rounds"
```

Expected: commit includes only Task 2 files.

---

### Task 3: Blocked Course Abandon And Styling

**Files:**
- Modify: `src/components/CourseDetail.tsx`
- Modify: `src/components/CourseDetail.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Extends `CourseDetail` props:

```tsx
  abandonCandidateRoundId?: string;
  onRequestAbandonRound(roundId: string): void;
  onCancelAbandonRound(): void;
  onConfirmAbandonRound(roundId: string): void;
```

- Consumes existing `AbandonRoundConfirmation`.
- The blocked course screen should show `Resume <courseName>` and `Abandon <courseName>` actions. Confirming abandon should leave the selected course visible and reveal `Start round`.

- [ ] **Step 1: Add failing CourseDetail test for blocked-course abandon action**

In `src/components/CourseDetail.test.tsx`, add this test after the blocked-state test from Task 1:

```tsx
  it('shows blocked-course abandon confirmation when requested', async () => {
    const onRequestAbandonRound = vi.fn();
    const onCancelAbandonRound = vi.fn();
    const onConfirmAbandonRound = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{
          type: 'blocked',
          roundId: 'round-1',
          courseName: 'Lakeview Nine',
          progressLabel: '1/9 holes complete'
        }}
        abandonCandidateRoundId="round-1"
        onBack={() => undefined}
        onStartRound={() => undefined}
        onResumeRound={() => undefined}
        onRequestAbandonRound={onRequestAbandonRound}
        onCancelAbandonRound={onCancelAbandonRound}
        onConfirmAbandonRound={onConfirmAbandonRound}
        onEditCourse={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine permanently' }));

    expect(onRequestAbandonRound).toHaveBeenCalledWith('round-1');
    expect(onCancelAbandonRound).toHaveBeenCalled();
    expect(onConfirmAbandonRound).toHaveBeenCalledWith('round-1');
  });
```

- [ ] **Step 2: Run CourseDetail tests to verify they fail**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx
```

Expected: FAIL because `CourseDetail` has no abandon props or confirmation rendering.

- [ ] **Step 3: Extend CourseDetail with blocked abandon confirmation**

In `src/components/CourseDetail.tsx`, add:

```tsx
import { AbandonRoundConfirmation } from './AbandonRoundConfirmation';
```

Extend `CourseDetailProps` with:

```tsx
  abandonCandidateRoundId?: string;
  onRequestAbandonRound(roundId: string): void;
  onCancelAbandonRound(): void;
  onConfirmAbandonRound(roundId: string): void;
```

Add the new props to function destructuring:

```tsx
  abandonCandidateRoundId,
  onRequestAbandonRound,
  onCancelAbandonRound,
  onConfirmAbandonRound,
```

Inside the `roundAction.type === 'blocked'` block, after the `Resume {roundAction.courseName}` button, add:

```tsx
          <button
            className="text-button abandon-action"
            type="button"
            onClick={() => onRequestAbandonRound(roundAction.roundId)}
          >
            Abandon {roundAction.courseName}
          </button>
          {abandonCandidateRoundId === roundAction.roundId ? (
            <AbandonRoundConfirmation
              courseName={roundAction.courseName}
              onCancel={onCancelAbandonRound}
              onConfirm={() => onConfirmAbandonRound(roundAction.roundId)}
            />
          ) : null}
```

Update all `CourseDetail` usages in `CourseDetail.test.tsx` so the required abandon callbacks are passed. For tests that do not exercise abandon, use:

```tsx
        onRequestAbandonRound={() => undefined}
        onCancelAbandonRound={() => undefined}
        onConfirmAbandonRound={() => undefined}
```

- [ ] **Step 4: Run CourseDetail tests to verify they pass**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx
```

Expected: PASS for all CourseDetail tests.

- [ ] **Step 5: Add failing App test for abandoning from blocked course detail**

In `src/App.test.tsx`, add this test after `blocks starting a different course while another course is in progress`:

```tsx
  it('abandons the blocking round from another course detail and then starts the selected course', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: /Parklands Championship 18 holes · Par 72 · seeded/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine' }));
    expect(screen.getByText('Abandon Lakeview Nine?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abandon Lakeview Nine permanently' }));

    expect(screen.getByRole('heading', { name: 'Parklands Championship' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start round' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));

    expect(screen.getByRole('heading', { name: 'Parklands Championship' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hole 18, unplayed/ })).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
    expect(stored.rounds).toHaveLength(1);
    expect(stored.rounds[0].courseSnapshot.name).toBe('Parklands Championship');
    expect(stored.rounds[0].status).toBe('in_progress');
  });
```

- [ ] **Step 6: Wire App abandon props into CourseDetail**

In `src/App.tsx`, replace the `CourseDetail` render line with:

```tsx
      {!activeRound && !summaryRound && !editingCourseId && selectedCourse ? <CourseDetail course={selectedCourse} roundAction={selectedCourseRoundAction} abandonCandidateRoundId={abandonCandidateRoundId} onBack={() => setSelectedCourseId(undefined)} onStartRound={startRound} onResumeRound={resumeRound} onRequestAbandonRound={requestAbandonRound} onCancelAbandonRound={cancelAbandonRound} onConfirmAbandonRound={confirmAbandonRound} onEditCourse={editCourse} /> : null}
```

- [ ] **Step 7: Add CSS for guardrails and abandon UI**

In `src/styles.css`, replace:

```css
.course-row,
.hole-card,
.hole-form,
.resume-banner {
```

with:

```css
.course-row,
.hole-card,
.hole-form,
.resume-banner,
.blocked-round-panel,
.abandon-confirmation {
```

After the existing `.resume-banner { display: grid; gap: 8px; }` block, add:

```css
.resume-card {
  display: grid;
  gap: 8px;
}

.resume-card-actions {
  display: flex;
  justify-content: flex-end;
}
```

After the existing `.resume-action` CSS block, add:

```css
.round-action-panel,
.blocked-round-panel,
.abandon-confirmation {
  display: grid;
  gap: 10px;
}

.round-action-note {
  color: #64736c;
  font-weight: 700;
  margin: 0;
}

.blocked-round-panel p,
.abandon-confirmation p {
  margin: 0;
}

.abandon-action {
  color: #8a2f1c;
}

.confirmation-actions {
  display: grid;
  gap: 8px;
}

.danger-button {
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid #8a2f1c;
  padding: 10px 14px;
  background: #8a2f1c;
  color: #ffffff;
  font-weight: 700;
}
```

Inside the existing `@media (min-width: 480px)` CSS block, add:

```css
  .confirmation-actions {
    grid-template-columns: 1fr 1fr;
  }
```

- [ ] **Step 8: Run blocked abandon App test and component tests**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx src/App.test.tsx -t "blocked|blocking|abandon"
```

Expected: PASS for blocked, blocking, and abandon tests.

- [ ] **Step 9: Run full unit test suite and build**

Run:

```powershell
npm test -- --run
npm run build
```

Expected: all tests pass and build exits 0.

- [ ] **Step 10: Commit Task 3**

Run:

```powershell
git --git-dir=work\golf-scorecard-design.git --work-tree=. status --short
git --git-dir=work\golf-scorecard-design.git --work-tree=. add src/App.tsx src/App.test.tsx src/components/CourseDetail.tsx src/components/CourseDetail.test.tsx src/styles.css
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "feat: block and abandon active round conflicts"
```

Expected: commit includes only Task 3 files.

---

### Task 4: Final Verification And Mobile Rendered QA

**Files:**
- Modify only if verification reveals a defect in files changed by Tasks 1-3.
- Test artifacts must be saved outside the repo, for example under `C:\tmp`.

**Interfaces:**
- Consumes the completed user flows from Tasks 1-3.
- Produces final confidence that the branch is ready for PR.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
npm test -- --run
npm run build
npm run e2e
```

Expected: all commands exit 0.

- [ ] **Step 2: Start local Vite server for rendered QA**

Run:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.ms-playwright'
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected: Vite serves the app at `http://127.0.0.1:5173/golf-scorecards/`.

Keep this process running until rendered QA is complete. If port 5173 is busy, use 5174 and replace the URL in the script below.

- [ ] **Step 3: Run mobile Play screen and blocked course detail smoke test**

In a separate shell, run:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.ms-playwright'
@'
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
const page = await context.newPage();
const logs = [];
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) {
    logs.push(`${message.type()}: ${message.text()}`);
  }
});
page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));

await page.goto('http://127.0.0.1:5173/golf-scorecards/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Lakeview Nine 9 holes/i }).click();
await page.getByRole('button', { name: 'Start round' }).click();
for (let i = 0; i < 5; i += 1) {
  await page.getByRole('button', { name: 'Increase hole 1 strokes' }).click();
}
await page.getByRole('button', { name: 'Back' }).click();
await page.getByRole('button', { name: /Resume Lakeview Nine, 1\/9 holes, Total 5, \+1, Next: Hole 2/ }).waitFor();
await page.getByRole('button', { name: 'Abandon Lakeview Nine' }).waitFor();
await page.screenshot({ path: 'C:/tmp/guardrails-play-resume-320.png', fullPage: false });

await page.getByRole('button', { name: /Parklands Championship 18 holes/i }).click();
await page.getByText('Finish or abandon Lakeview Nine before starting another round.').waitFor();
await page.getByRole('button', { name: 'Resume Lakeview Nine' }).waitFor();
await page.getByRole('button', { name: 'Abandon Lakeview Nine' }).waitFor();
await page.screenshot({ path: 'C:/tmp/guardrails-blocked-course-320.png', fullPage: false });

await page.getByRole('button', { name: 'Abandon Lakeview Nine' }).click();
await page.getByText('Abandon Lakeview Nine?').waitFor();
await page.getByRole('button', { name: 'Keep round' }).click();
await page.getByText('Finish or abandon Lakeview Nine before starting another round.').waitFor();

await page.getByRole('button', { name: 'Abandon Lakeview Nine' }).click();
await page.getByRole('button', { name: 'Abandon Lakeview Nine permanently' }).click();
await page.getByRole('button', { name: 'Start round' }).waitFor();
await page.screenshot({ path: 'C:/tmp/guardrails-after-abandon-320.png', fullPage: false });

const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth ||
  document.body.scrollWidth > document.body.clientWidth
);

await browser.close();
console.log(JSON.stringify({
  playResumeCard: true,
  blockedCourseActions: true,
  abandonCancel: true,
  abandonConfirm: true,
  overflow,
  logs
}));
'@ | node --input-type=module -
```

Expected JSON:

```json
{
  "playResumeCard": true,
  "blockedCourseActions": true,
  "abandonCancel": true,
  "abandonConfirm": true,
  "overflow": false,
  "logs": []
}
```

Expected screenshots:

- `C:\tmp\guardrails-play-resume-320.png`
- `C:\tmp\guardrails-blocked-course-320.png`
- `C:\tmp\guardrails-after-abandon-320.png`

- [ ] **Step 4: Stop local Vite server**

Stop the Vite process started in Step 2.

Then run:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
```

Expected: no listener for port 5173. If port 5174 was used, check 5174 instead.

- [ ] **Step 5: Review final diff**

Run:

```powershell
git --git-dir=work\golf-scorecard-design.git --work-tree=. diff --stat origin/main..HEAD
git --git-dir=work\golf-scorecard-design.git --work-tree=. diff --check origin/main..HEAD
git --git-dir=work\golf-scorecard-design.git --work-tree=. status --short --branch
```

Expected:

- Diff includes the approved spec commit, plan commit, and implementation commits.
- No whitespace errors.
- No staged files.
- Untracked `.superpowers/sdd/*` scratch files may remain untracked.
- The unrelated modified `docs/superpowers/specs/2026-07-19-mobile-scoring-polish-design.md` remains outside the implementation commits unless the user explicitly asks to handle it.

- [ ] **Step 6: Request final code review**

Use `superpowers:requesting-code-review` with this review brief:

```text
Review in-progress round guardrails implementation on branch agent/in-progress-round-guardrails.

Focus on:
- no silent redirect when course detail Start round would conflict with an existing in-progress round
- same-course resume action and first-unplayed resume targeting
- different-course blocked state with visible explanation
- abandon confirmation cancel/confirm behavior
- deletion limited to in_progress rounds
- completed history preservation
- no nested interactive controls in resume cards
- mobile 320px layout for resume cards, blocked course detail, and confirmation panels
```

- [ ] **Step 7: Apply review fixes**

If review finds issues, fix them with TDD and run the focused failing test first. Then rerun:

```powershell
npm test -- --run
npm run build
npm run e2e
```

Expected: all commands pass after any review fixes.

- [ ] **Step 8: Confirm final status**

Run:

```powershell
git --git-dir=work\golf-scorecard-design.git --work-tree=. log --oneline --decorate origin/main..HEAD
git --git-dir=work\golf-scorecard-design.git --work-tree=. status --short --branch
```

Expected:

- Branch is `agent/in-progress-round-guardrails`.
- Local branch is ahead of `origin/main`.
- Only intentional commits appear after `origin/main`.
- No implementation changes remain unstaged.

---

## Implementation Notes

- `startRound(courseId)` should no-op when any in-progress round exists. The UI should make that state unreachable for normal users, and the no-op prevents stale button events from reintroducing silent redirect behavior.
- Same-course detection should use both `round.courseId === course.id` and `round.courseSnapshot.id === course.id` so legacy rounds without `courseId` still behave sensibly.
- If multiple in-progress rounds exist in loaded storage, `CourseList` should show all cards. `CourseDetail` should prefer a matching in-progress round for the selected course; otherwise it should block on the first in-progress round.
- The `AbandonRoundConfirmation` component should not know about round ids. It receives display copy and callbacks only.
- Do not add a domain `abandonRound()` helper unless duplication appears during implementation. The deletion is App persistence orchestration, not scoring domain logic.
- Do not add a new `RoundStatus`.
