# Resume Round Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-progress round resume cards show useful progress context and resume the scorer to the first unplayed hole or review screen.

**Architecture:** Add pure resume-target helpers in the round domain, teach `ActiveRound` to accept an initial target without becoming controlled by `App`, then render richer resume card content and wire the target through the resume flow. Keep scoring, persistence, completion, and history semantics unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Playwright e2e, localStorage persistence.

## Global Constraints

- Show each in-progress round as a compact resume card above course search.
- Include round progress, current total, score to par, and the next useful action.
- Resume directly to the first unplayed hole when one exists.
- Resume directly to scorecard review when every hole has a score but the round has not been finished.
- Starting a new round continues to open on hole 1 in scoring mode.
- Do not add delete, archive, or abandon-round behavior.
- Do not change completed round history.
- Do not change score calculation or storage shape.
- Do not add backend sync, account, or multi-device behavior.
- Do not add layout-only ARIA labels to generic wrappers.
- Keep cards readable at 320px.

---

## File Structure

- `src/domain/rounds.ts`: owns pure scoring and resume-target calculations.
- `src/domain/rounds.test.ts`: verifies resume-target behavior against normal and malformed score entries.
- `src/components/ActiveRound.tsx`: owns active scoring/review UI state and accepts optional initial resume target.
- `src/components/ActiveRound.test.tsx`: verifies initial target behavior without involving app storage.
- `src/components/CourseList.tsx`: renders in-progress resume cards above search using the same resume-target helper as `App`.
- `src/App.tsx`: resolves a round's resume target and passes it into `ActiveRound`.
- `src/App.test.tsx`: verifies user-facing resume behavior, autosave/resume behavior, and multiple in-progress cards.
- `src/styles.css`: tunes compact resume card layout and wrapping.

---

### Task 1: Round Resume Target Helpers

**Files:**
- Modify: `src/domain/rounds.ts`
- Modify: `src/domain/rounds.test.ts`

**Interfaces:**
- Produces:
  - `export type RoundResumeTarget = { mode: 'scoring'; holeNumber: number } | { mode: 'review' };`
  - `export function getFirstUnplayedHoleNumber(round: Round): number | undefined`
  - `export function getRoundResumeTarget(round: Round): RoundResumeTarget`
- Consumes:
  - Existing `Round`, `normalizeStrokes`, and `courseSnapshot.holes`.

- [ ] **Step 1: Write failing domain tests**

Add `getFirstUnplayedHoleNumber` and `getRoundResumeTarget` to the import in `src/domain/rounds.test.ts`:

```ts
import {
  adjustStrokes,
  canCompleteRound,
  completeRound,
  createRoundFromCourse,
  getDisplayStrokes,
  getFirstUnplayedHoleNumber,
  getRoundResumeTarget,
  getRoundTotals,
  normalizeStrokes,
  setHoleStrokes
} from './rounds';
```

Add these tests inside `describe('round domain', () => { ... })`:

```ts
  it('finds the first unplayed hole using normalized stroke values', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-19T01:00:00.000Z'
    });
    const loadedRound = {
      ...round,
      scores: round.scores.map((score) => {
        if (score.holeNumber === 1) return { ...score, strokes: 4 };
        if (score.holeNumber === 2) return { ...score, strokes: null };
        if (score.holeNumber === 3) return { ...score, strokes: 0 };
        return score;
      })
    } as unknown as Round;

    expect(getFirstUnplayedHoleNumber(loadedRound)).toBe(2);
    expect(getRoundResumeTarget(loadedRound)).toEqual({ mode: 'scoring', holeNumber: 2 });
  });

  it('treats missing score entries as unplayed resume targets', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-19T01:00:00.000Z'
    });
    const loadedRound = {
      ...round,
      scores: round.scores.filter((score) => score.holeNumber !== 3)
    };
    const firstTwoScored = setHoleStrokes(setHoleStrokes(loadedRound, 1, 4), 2, 5);

    expect(getFirstUnplayedHoleNumber(firstTwoScored)).toBe(3);
    expect(getRoundResumeTarget(firstTwoScored)).toEqual({ mode: 'scoring', holeNumber: 3 });
  });

  it('returns review as the resume target when every hole is scored', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-19T01:00:00.000Z'
    });
    const completeInProgressRound = round.scores.reduce((currentRound, score) => (
      setHoleStrokes(currentRound, score.holeNumber, 4)
    ), round);

    expect(getFirstUnplayedHoleNumber(completeInProgressRound)).toBeUndefined();
    expect(getRoundResumeTarget(completeInProgressRound)).toEqual({ mode: 'review' });
  });

  it('falls back to hole 1 for a malformed round with no holes', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-19T01:00:00.000Z'
    });
    const malformedRound = {
      ...round,
      courseSnapshot: {
        ...round.courseSnapshot,
        holes: []
      },
      scores: []
    } as Round;

    expect(getFirstUnplayedHoleNumber(malformedRound)).toBeUndefined();
    expect(getRoundResumeTarget(malformedRound)).toEqual({ mode: 'scoring', holeNumber: 1 });
  });
```

- [ ] **Step 2: Run the domain tests and verify they fail**

Run:

```bash
npm test -- --run src/domain/rounds.test.ts
```

Expected: FAIL because `getFirstUnplayedHoleNumber` and `getRoundResumeTarget` are not exported from `src/domain/rounds.ts`.

- [ ] **Step 3: Implement the resume-target helpers**

In `src/domain/rounds.ts`, add this type after `RoundTotals`:

```ts
export type RoundResumeTarget = { mode: 'scoring'; holeNumber: number } | { mode: 'review' };
```

Add these functions after `getDisplayStrokes`:

```ts
export function getFirstUnplayedHoleNumber(round: Round): number | undefined {
  const scoreByHole = new Map(round.scores.map((score) => [score.holeNumber, score]));
  const firstUnplayedHole = round.courseSnapshot.holes.find((hole) =>
    normalizeStrokes(scoreByHole.get(hole.number)?.strokes) === undefined
  );

  return firstUnplayedHole?.number;
}

export function getRoundResumeTarget(round: Round): RoundResumeTarget {
  const firstUnplayedHoleNumber = getFirstUnplayedHoleNumber(round);

  if (firstUnplayedHoleNumber !== undefined) {
    return { mode: 'scoring', holeNumber: firstUnplayedHoleNumber };
  }

  if (round.courseSnapshot.holes.length === 0) {
    return { mode: 'scoring', holeNumber: 1 };
  }

  return { mode: 'review' };
}
```

- [ ] **Step 4: Run the domain tests and verify they pass**

Run:

```bash
npm test -- --run src/domain/rounds.test.ts
```

Expected: PASS for all round domain tests.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git --git-dir=work\golf-scorecard-design.git --work-tree=. add src/domain/rounds.ts src/domain/rounds.test.ts
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "feat: add round resume targets"
```

Expected: commit containing only `src/domain/rounds.ts` and `src/domain/rounds.test.ts`.

---

### Task 2: ActiveRound Initial Target

**Files:**
- Modify: `src/components/ActiveRound.tsx`
- Modify: `src/components/ActiveRound.test.tsx`

**Interfaces:**
- Consumes:
  - `RoundResumeTarget` from `src/domain/rounds.ts`.
- Produces:
  - `ActiveRoundProps.initialTarget?: RoundResumeTarget`
  - `ActiveRound` initializes scoring mode and selected hole from `initialTarget` only when mounting or when the active round/initial target changes.

- [ ] **Step 1: Write failing ActiveRound tests**

In `src/components/ActiveRound.test.tsx`, add these tests inside `describe('ActiveRound mobile scoring', () => { ... })`:

```ts
  it('opens to an initial scoring target when one is provided', () => {
    renderApp(
      <ActiveRound
        round={makeRound()}
        initialTarget={{ mode: 'scoring', holeNumber: 4 }}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Hole 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hole 4, unplayed, selected' })).toBeInTheDocument();
  });

  it('opens to review when the initial target is review', () => {
    renderApp(
      <ActiveRound
        round={makeCompleteRound()}
        initialTarget={{ mode: 'review' }}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Scorecard review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish round' })).toBeEnabled();
  });
```

- [ ] **Step 2: Run ActiveRound tests and verify they fail**

Run:

```bash
npm test -- --run src/components/ActiveRound.test.tsx
```

Expected: FAIL because `ActiveRound` does not accept `initialTarget`.

- [ ] **Step 3: Add the initial target prop**

In `src/components/ActiveRound.tsx`, change the imports to include `RoundResumeTarget`:

```ts
import { adjustStrokes, getDisplayStrokes, getRoundTotals, type RoundResumeTarget } from '../domain/rounds';
```

Add the prop:

```ts
interface ActiveRoundProps {
  round: Round;
  initialTarget?: RoundResumeTarget;
  onBack(): void;
  onChangeStrokes(holeNumber: number, strokes: number | undefined): void;
  onFinishRound(): void;
}
```

Update the component signature and state initialization:

```ts
export function ActiveRound({ round, initialTarget, onBack, onChangeStrokes, onFinishRound }: ActiveRoundProps) {
  const holes = round.courseSnapshot.holes;
  const firstHoleNumber = holes[0]?.number ?? 1;
  const [mode, setMode] = useState<ActiveRoundMode>(() => getInitialMode(initialTarget));
  const [selectedHoleNumber, setSelectedHoleNumber] = useState(() => getInitialHoleNumber(initialTarget, firstHoleNumber));
  const initialTargetHoleNumber = initialTarget?.mode === 'scoring' ? initialTarget.holeNumber : undefined;

  useEffect(() => {
    setMode(getInitialMode(initialTarget));
    setSelectedHoleNumber(getInitialHoleNumber(initialTarget, firstHoleNumber));
  }, [firstHoleNumber, round.id, initialTarget?.mode, initialTargetHoleNumber]);
```

Add these helpers above `formatScoreToPar`:

```ts
function getInitialMode(initialTarget: RoundResumeTarget | undefined): ActiveRoundMode {
  return initialTarget?.mode ?? 'scoring';
}

function getInitialHoleNumber(initialTarget: RoundResumeTarget | undefined, firstHoleNumber: number): number {
  return initialTarget?.mode === 'scoring' ? initialTarget.holeNumber : firstHoleNumber;
}
```

Keep all existing `selectHole`, previous/next, and review behavior unchanged.

- [ ] **Step 4: Run ActiveRound tests and verify they pass**

Run:

```bash
npm test -- --run src/components/ActiveRound.test.tsx
```

Expected: PASS for all ActiveRound tests.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git --git-dir=work\golf-scorecard-design.git --work-tree=. add src/components/ActiveRound.tsx src/components/ActiveRound.test.tsx
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "feat: support active round resume targets"
```

Expected: commit containing only `src/components/ActiveRound.tsx` and `src/components/ActiveRound.test.tsx`.

---

### Task 3: Resume Cards and App Wiring

**Files:**
- Modify: `src/components/CourseList.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes:
  - `getRoundResumeTarget(round): RoundResumeTarget`
  - `getRoundTotals(round): RoundTotals`
  - `ActiveRoundProps.initialTarget?: RoundResumeTarget`
- Produces:
  - Resume card accessible name includes course name, progress, total, score to par, and next action.
  - `App.resumeRound(roundId)` stores the round's resume target and passes it into `ActiveRound`.

- [ ] **Step 1: Write failing App tests for resume cards and targeting**

In `src/App.test.tsx`, update `resumes an in-progress autosaved round after remount` to expect the richer card and first-unplayed targeting:

```ts
  it('resumes an in-progress autosaved round after remount', async () => {
    const firstRender = renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    for (let stroke = 0; stroke < 5; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    }

    firstRender.unmount();
    renderAppWithExistingStorage(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Resume Lakeview Nine, 1\/9 holes, Total 5, \+1, Next: Hole 2/ }));

    expect(screen.getByRole('heading', { name: 'Hole 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hole 2 displayed score')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Hole 1, 5 strokes' })).toBeInTheDocument();
  });
```

Update `exposes every persisted in-progress round for resuming`:

```ts
  it('exposes every persisted in-progress round for resuming', async () => {
    const firstRound = createRoundFromCourse(seedCourses[0], { id: 'round-1', startedAt: '2026-07-17T01:00:00.000Z' });
    const secondRound = createRoundFromCourse(seedCourses[1], { id: 'round-2', startedAt: '2026-07-17T02:00:00.000Z' });
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [firstRound, secondRound] }));

    renderAppWithExistingStorage(<App />);

    expect(screen.getByRole('button', { name: /Resume Lakeview Nine, 0\/9 holes, Total 0, E, Next: Hole 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume Parklands Championship, 0\/18 holes, Total 0, E, Next: Hole 1/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Resume Parklands Championship, 0\/18 holes, Total 0, E, Next: Hole 1/ }));

    expect(screen.getByRole('heading', { name: 'Parklands Championship' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hole 18, unplayed/ })).toBeInTheDocument();
  });
```

Add this new test near the other resume tests:

```ts
  it('resumes a fully scored in-progress round to scorecard review', async () => {
    const round = createRoundFromCourse(seedCourses[0], {
      id: 'round-1',
      startedAt: '2026-07-19T01:00:00.000Z'
    });
    const fullyScoredRound = round.scores.reduce((currentRound, score) => ({
      ...currentRound,
      scores: currentRound.scores.map((entry) =>
        entry.holeNumber === score.holeNumber ? { ...entry, strokes: 4 } : entry
      )
    }), round);
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [fullyScoredRound] }));

    renderAppWithExistingStorage(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Resume Lakeview Nine, 9\/9 holes, Total 36, E, Ready to review/ }));

    expect(screen.getByRole('heading', { name: 'Scorecard review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish round' })).toBeEnabled();
  });
```

Update `preserves an edited resumed round when a pending provider load resolves` so the resume click uses the richer accessible name:

```ts
    await userEvent.click(screen.getByRole('button', { name: /Resume Lakeview Nine, 0\/9 holes, Total 0, E, Next: Hole 1/ }));
```

- [ ] **Step 2: Run App tests and verify they fail**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because the resume card accessible names are still the old `Resume <course>` text and `App` does not pass an initial target into `ActiveRound`.

- [ ] **Step 3: Render richer resume cards**

In `src/components/CourseList.tsx`, add the domain import:

```ts
import { getRoundResumeTarget, getRoundTotals } from '../domain/rounds';
```

Replace the current in-progress round map:

```tsx
      {inProgressRounds.map((round) => (
        <button key={round.id} className="resume-banner" onClick={() => onResumeRound(round.id)}>
          Resume {round.courseSnapshot.name}
        </button>
      ))}
```

with:

```tsx
      {inProgressRounds.map((round) => {
        const totals = getRoundTotals(round);
        const resumeTarget = getRoundResumeTarget(round);
        const nextAction = resumeTarget.mode === 'review' ? 'Ready to review' : `Next: Hole ${resumeTarget.holeNumber}`;
        const progress = `${totals.completedHoles}/${round.courseSnapshot.holeCount} holes`;
        const totalLabel = `Total ${totals.totalStrokes}`;
        const scoreLabel = formatScoreToPar(totals.scoreToPar);

        return (
          <button
            key={round.id}
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
        );
      })}
```

Add this helper at the bottom of `CourseList.tsx`:

```ts
function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
```

- [ ] **Step 4: Wire App resume targets into ActiveRound**

In `src/App.tsx`, update the round import:

```ts
import { completeRound, createRoundFromCourse, getRoundResumeTarget, setHoleStrokes } from './domain/rounds';
import type { RoundResumeTarget } from './domain/rounds';
```

Add state near `activeRoundId`:

```ts
  const [activeRoundInitialTarget, setActiveRoundInitialTarget] = useState<RoundResumeTarget>();
```

Clear the target when leaving/resolving active round state:

```ts
  function showCourseList(tab: AppTab = activeTab): void {
    invalidateProviderLoad();
    setActiveTab(tab);
    setSelectedCourseId(undefined);
    setEditingCourseId(undefined);
    setActiveRoundId(undefined);
    setActiveRoundInitialTarget(undefined);
    setSummaryRoundId(undefined);
  }
```

In the new-round path inside `startRound`, set the initial target to `undefined` before opening the new active round:

```ts
    setSelectedCourseId(undefined);
    setActiveRoundInitialTarget(undefined);
    setActiveRoundId(round.id);
    setSummaryRoundId(undefined);
    setActiveTab('play');
```

In `finishRound`, clear the initial target before showing summary:

```ts
    setActiveRoundId(undefined);
    setActiveRoundInitialTarget(undefined);
    setSummaryRoundId(completedRound.id);
```

Replace `resumeRound` with:

```ts
  function resumeRound(roundId: string): void {
    invalidateProviderLoad();
    const round = roundsRef.current.find((existingRound) => existingRound.id === roundId);
    setSelectedCourseId(undefined);
    setEditingCourseId(undefined);
    setSummaryRoundId(undefined);
    setActiveRoundInitialTarget(round ? getRoundResumeTarget(round) : undefined);
    setActiveRoundId(roundId);
    setActiveTab('play');
  }
```

In `openCompletedRound`, clear any stale active target:

```ts
  function openCompletedRound(roundId: string): void {
    invalidateProviderLoad();
    setSummaryRoundId(roundId);
    setActiveRoundInitialTarget(undefined);
    setActiveRoundId(undefined);
  }
```

Pass the target into `ActiveRound`:

```tsx
      {activeRound ? <ActiveRound round={activeRound} initialTarget={activeRoundInitialTarget} onBack={() => showCourseList('play')} onChangeStrokes={(holeNumber, strokes) => changeRoundStrokes(activeRound.id, holeNumber, strokes)} onFinishRound={() => finishRound(activeRound.id)} /> : null}
```

- [ ] **Step 5: Style the compact resume cards**

In `src/styles.css`, update the shared row block so `.resume-banner` can still share the base card styling:

```css
.course-row,
.hole-card,
.hole-form,
.resume-banner {
  width: 100%;
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fffdf7;
  color: #17362f;
  padding: 14px;
  text-align: left;
}
```

Add these rules after `.course-row small`:

```css
.resume-banner {
  display: grid;
  gap: 8px;
}

.resume-banner > span:first-child {
  display: grid;
  gap: 4px;
}

.resume-banner small {
  color: #64736c;
}

.resume-action {
  color: #174a3c;
  font-weight: 800;
}
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npm test -- --run src/App.test.tsx src/components/ActiveRound.test.tsx src/domain/rounds.test.ts
```

Expected: PASS for all focused tests.

- [ ] **Step 7: Run full automated verification**

Run:

```bash
npm test -- --run
npm run build
npm run e2e
```

Expected:
- Unit/component tests pass with 0 failures.
- Build exits 0.
- E2E exits 0.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git --git-dir=work\golf-scorecard-design.git --work-tree=. add src/components/CourseList.tsx src/App.tsx src/App.test.tsx src/styles.css
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "feat: improve resume round cards"
```

Expected: commit containing only resume-card UI, app wiring, and related tests/styles.

---

### Task 4: Rendered Mobile QA and Final Review

**Files:**
- No expected source changes unless QA or review finds a defect.

**Interfaces:**
- Consumes all completed tasks.
- Produces final confidence that the resume polish behaves correctly on mobile and is ready for PR.

- [ ] **Step 1: Start the local app**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Expected: Vite serves the app at `http://127.0.0.1:5173/golf-scorecards/`. If port 5173 is occupied, identify the existing listener before choosing another port.

- [ ] **Step 2: Run Browser QA at mobile width**

Use Browser or Playwright to check:

```text
http://127.0.0.1:5173/golf-scorecards/
viewport: 390x844 and 320x740
```

Required observations:
- Play screen with a partial in-progress round shows course name, progress, total, score to par, and `Next: Hole N`.
- The resume card is readable at 320px with no horizontal overflow.
- Tapping a partial resume card opens the first unplayed hole.
- A fully scored in-progress round shows `Ready to review`.
- Tapping a fully scored resume card opens `Scorecard review`.
- Console has no relevant warnings or errors.
- No Vite/framework error overlay appears.

- [ ] **Step 3: Request final code review**

Ask a reviewer to inspect:

```text
Review resume round clarity implementation on branch agent/resume-round-clarity.

Focus on:
- resume-target helpers treating null, zero, missing, and malformed strokes as unplayed
- ActiveRound initialTarget not resetting user navigation after score changes
- App wiring avoiding stale resume targets
- resume card accessible name and visible text
- 320px layout risk

Verification already run:
- npm test -- --run
- npm run build
- npm run e2e
- mobile rendered QA
```

- [ ] **Step 4: Address review findings if any**

If review finds an issue, write a focused failing test first, implement the smallest fix, rerun affected tests plus the full verification commands from Task 3 Step 7, and commit with a narrow message such as:

```bash
git --git-dir=work\golf-scorecard-design.git --work-tree=. commit -m "fix: keep resume target stable"
```

- [ ] **Step 5: Confirm final status**

Run:

```bash
git --git-dir=work\golf-scorecard-design.git --work-tree=. status --short --branch
git --git-dir=work\golf-scorecard-design.git --work-tree=. log --oneline --decorate --max-count=8
```

Expected:
- Branch is `agent/resume-round-clarity`.
- Only intentional tracked changes are committed.
- Any `.superpowers/sdd` scratch files remain untracked and are not included in the PR.
