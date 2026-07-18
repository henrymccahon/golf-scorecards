# Mobile Scoring Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active round all-holes numeric input screen with a mobile-first single-hole scoring flow, plus/minus score controls, compact hole navigation, and a mandatory scorecard review before finish.

**Architecture:** Keep `App` as the owner of round persistence and completion. Add small score-display helpers in the round domain, then split active-round rendering into focused components for one-hole entry, hole navigation, and review while preserving the existing `onChangeStrokes(holeNumber, strokes)` and `onFinishRound()` callbacks.

**Tech Stack:** React 18, TypeScript 5, Vite, Vitest, React Testing Library, Playwright mobile project, browser `localStorage`, `lucide-react` icons.

## Global Constraints

- Make mobile score entry fast enough to use during a round without fighting small numeric inputs.
- Show one hole as the primary scoring surface.
- Use plus/minus controls for score entry, with direct prevention of invalid negative or fractional scores.
- Display unplayed holes as `0` while keeping domain state as `undefined` and serialized unplayed values nullish or omitted.
- Let users move with previous and next controls.
- Provide a compact hole navigator for quick jumps and progress scanning.
- Require a full scorecard review step before completing the round.
- Preserve the current local-first round persistence, immutable course snapshot behavior, and completion rules.
- Leave layout room for future pro hole details such as distance, handicap/stroke index, notes, shot prompts, or richer score context.
- Do not add putts, penalties, fairways hit, greens in regulation, or match play scoring in this package.
- Do not add GPS, maps, shot tracking, or live course-position features.
- Do not change course search, provider loading, course storage, or custom course editing.
- Do not change completed round history beyond whatever is necessary to open the existing summary screen.
- Do not require accounts, sync, or backend services.
- Do not store `0` as a played score.
- Completing the round must continue to use the existing `completeRound` path and then show the existing summary screen.
- Current workspace note: normal `.git` metadata may not be available from the worktree root, so commit commands below use `git --git-dir='work\\golf-scorecard-design.git' --work-tree='.'`.

---

## File Structure

- `src/domain/rounds.ts`: keep the existing round write boundary and add score display/conversion helpers used by UI and storage normalization.
- `src/domain/rounds.test.ts`: verify unplayed display values, plus/minus conversion, completion blocking, and totals for nullish or invalid loaded scores.
- `src/storage/localStore.ts`: normalize nullish or invalid stored `strokes` values to omitted `strokes` on load while keeping malformed round shape recovery behavior.
- `src/storage/localStore.test.ts`: verify null, omitted, and `0` stored strokes load as unplayed and never return numeric `0`.
- `src/components/HoleScoreEntry.tsx`: render one hole, available hole metadata, plus/minus controls, and large displayed score.
- `src/components/HoleNavigator.tsx`: render compact hole jump buttons with selected and played/unplayed state.
- `src/components/ScorecardReview.tsx`: render full review, totals, missing-hole recovery action, and guarded finish button.
- `src/components/ActiveRound.tsx`: own selected-hole and `scoring`/`review` mode state, delegate score writes and finish through existing props.
- `src/components/ActiveRound.test.tsx`: cover single-hole scoring behavior and review gate behavior.
- `src/components/RoundDetails.test.tsx`: keep summary and history tests; move active-round-specific expectations into `ActiveRound.test.tsx`.
- `src/App.test.tsx`: update app-level scoring, resume, and provider scoring tests to use the new controls instead of numeric inputs.
- `e2e/score-round.spec.ts`: update mobile browser scoring flows to use plus/next/navigator/review interactions.
- `src/styles.css`: replace old score-entry list styles with stable mobile scoring, navigator, and review styles.

---

### Task 1: Score Display Helpers And Storage Normalization

**Files:**
- Modify: `src/domain/rounds.ts`
- Modify: `src/domain/rounds.test.ts`
- Modify: `src/storage/localStore.ts`
- Modify: `src/storage/localStore.test.ts`

**Interfaces:**
- Produces: `normalizeStrokes(value: unknown): number | undefined`
- Produces: `getDisplayStrokes(value: unknown): number`
- Produces: `adjustStrokes(value: unknown, delta: 1 | -1): number | undefined`
- Preserves: `setHoleStrokes(round: Round, holeNumber: number, strokes: number | undefined): Round`
- Consumes: `normalizeStrokes` inside `getRoundTotals`, `canCompleteRound`, and storage load normalization.

- [ ] **Step 1: Add failing domain tests for score display semantics**

Modify the import at the top of `src/domain/rounds.test.ts`:

```ts
import { adjustStrokes, canCompleteRound, completeRound, createRoundFromCourse, getDisplayStrokes, getRoundTotals, normalizeStrokes, setHoleStrokes } from './rounds';
import type { Course, Round } from './types';
```

Append these tests inside the existing `describe('round domain', () => { })` block:

```ts
  it('normalizes nullish and invalid stroke values for display', () => {
    expect(normalizeStrokes(undefined)).toBeUndefined();
    expect(normalizeStrokes(null)).toBeUndefined();
    expect(normalizeStrokes(0)).toBeUndefined();
    expect(normalizeStrokes(-1)).toBeUndefined();
    expect(normalizeStrokes(2.5)).toBeUndefined();
    expect(normalizeStrokes('4')).toBeUndefined();
    expect(normalizeStrokes(4)).toBe(4);

    expect(getDisplayStrokes(undefined)).toBe(0);
    expect(getDisplayStrokes(null)).toBe(0);
    expect(getDisplayStrokes(0)).toBe(0);
    expect(getDisplayStrokes(4)).toBe(4);
  });

  it('adjusts displayed strokes without storing zero', () => {
    expect(adjustStrokes(undefined, 1)).toBe(1);
    expect(adjustStrokes(null, 1)).toBe(1);
    expect(adjustStrokes(4, 1)).toBe(5);
    expect(adjustStrokes(4, -1)).toBe(3);
    expect(adjustStrokes(1, -1)).toBeUndefined();
    expect(adjustStrokes(undefined, -1)).toBeUndefined();
    expect(adjustStrokes(0, -1)).toBeUndefined();
  });

  it('keeps completion blocked while any hole is unplayed', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });
    const almostComplete = round.scores.reduce((currentRound, score) => (
      score.holeNumber === 9 ? currentRound : setHoleStrokes(currentRound, score.holeNumber, 4)
    ), round);

    expect(canCompleteRound(almostComplete)).toBe(false);
    expect(canCompleteRound(setHoleStrokes(almostComplete, 9, 4))).toBe(true);
  });

  it('calculates totals from positive integer strokes only', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });
    const loadedRound = {
      ...round,
      scores: round.scores.map((score) => {
        if (score.holeNumber === 1) return { ...score, strokes: 5 };
        if (score.holeNumber === 2) return { ...score, strokes: null };
        if (score.holeNumber === 3) return { ...score, strokes: 0 };
        return score;
      })
    } as unknown as Round;

    expect(getRoundTotals(loadedRound)).toMatchObject({
      completedHoles: 1,
      totalStrokes: 5,
      playedPar: 5,
      scoreToPar: 0
    });
    expect(canCompleteRound(loadedRound)).toBe(false);
  });
```

- [ ] **Step 2: Add failing storage normalization test**

Append this test inside the existing `describe('local scorecard store', () => { })` block in `src/storage/localStore.test.ts`:

```ts
  it('loads nullish and zero stored strokes as unplayed omitted strokes', () => {
    const storage = new MemoryStorage();
    const storedRound = {
      ...round,
      scores: round.scores.map((score) => {
        if (score.holeNumber === 1) return { ...score, strokes: null };
        if (score.holeNumber === 2) return { ...score, strokes: 0 };
        if (score.holeNumber === 3) return { ...score, strokes: 4 };
        return score;
      })
    };
    storage.setItem('test-key', JSON.stringify({ savedCourses: [course], rounds: [storedRound] }));

    const loaded = createLocalScorecardStore(storage, 'test-key').load();

    expect(loaded.recoveryRequired).toBe(false);
    expect(loaded.data.rounds[0].scores[0]).toEqual({ holeNumber: 1 });
    expect(loaded.data.rounds[0].scores[1]).toEqual({ holeNumber: 2 });
    expect(loaded.data.rounds[0].scores[2]).toEqual({ holeNumber: 3, strokes: 4 });
  });
```

- [ ] **Step 3: Run failing task tests**

Run:

```powershell
npm test -- --run src/domain/rounds.test.ts src/storage/localStore.test.ts
```

Expected: FAIL because `normalizeStrokes`, `getDisplayStrokes`, and `adjustStrokes` do not exist, and storage still rejects `null` and `0` strokes.

- [ ] **Step 4: Add score conversion helpers to the round domain**

Add these functions near the top of `src/domain/rounds.ts`, after the `RoundTotals` interface:

```ts
export function normalizeStrokes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function getDisplayStrokes(value: unknown): number {
  return normalizeStrokes(value) ?? 0;
}

export function adjustStrokes(value: unknown, delta: 1 | -1): number | undefined {
  const nextValue = getDisplayStrokes(value) + delta;
  return nextValue > 0 ? nextValue : undefined;
}
```

- [ ] **Step 5: Use normalized strokes in totals and completion**

In `src/domain/rounds.ts`, replace the start of `getRoundTotals`:

```ts
  const completedScores = round.scores.filter((score) => Number.isInteger(score.strokes) && score.strokes! > 0);
```

with:

```ts
  const completedScores = round.scores
    .map((score) => ({ ...score, strokes: normalizeStrokes(score.strokes) }))
    .filter((score) => score.strokes !== undefined);
```

Replace `canCompleteRound`:

```ts
export function canCompleteRound(round: Round): boolean {
  return round.scores.length === round.courseSnapshot.holeCount &&
    round.scores.every((score) => Number.isInteger(score.strokes) && score.strokes! > 0);
}
```

with:

```ts
export function canCompleteRound(round: Round): boolean {
  return round.scores.length === round.courseSnapshot.holeCount &&
    round.scores.every((score) => normalizeStrokes(score.strokes) !== undefined);
}
```

- [ ] **Step 6: Normalize stored round scores on load**

Modify the import in `src/storage/localStore.ts`:

```ts
import { normalizeStrokes } from '../domain/rounds';
```

Replace `isScore` with this version:

```ts
function isScore(value: unknown): boolean {
  if (!isRecord(value) || !isPositiveInteger(value.holeNumber)) return false;
  if (value.strokes !== undefined && value.strokes !== null && typeof value.strokes !== 'number') return false;
  if (value.strokes !== undefined && value.strokes !== null && !Number.isInteger(value.strokes)) return false;
  if (value.putts !== undefined && !isPositiveInteger(value.putts)) return false;
  if (value.penalties !== undefined && (typeof value.penalties !== 'number' || !Number.isInteger(value.penalties) || value.penalties < 0)) return false;
  if (value.fairwayHit !== undefined && typeof value.fairwayHit !== 'boolean') return false;
  return value.greenInRegulation === undefined || typeof value.greenInRegulation === 'boolean';
}
```

Add this helper after `isRound`:

```ts
function normalizeRound(round: Round): Round {
  return {
    ...round,
    scores: round.scores.map((score) => {
      const strokes = normalizeStrokes(score.strokes);
      const { strokes: _strokes, ...scoreWithoutStrokes } = score;
      return strokes === undefined ? scoreWithoutStrokes : { ...scoreWithoutStrokes, strokes };
    })
  };
}
```

In `parseStoredData`, replace:

```ts
    const validatedRounds = parsed.rounds as Round[];
```

with:

```ts
    const validatedRounds = (parsed.rounds as Round[]).map(normalizeRound);
```

- [ ] **Step 7: Run task tests**

Run:

```powershell
npm test -- --run src/domain/rounds.test.ts src/storage/localStore.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/domain/rounds.ts src/domain/rounds.test.ts src/storage/localStore.ts src/storage/localStore.test.ts
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add score display normalization"
```

Expected: commit succeeds.

---

### Task 2: Single-Hole Active Round Components

**Files:**
- Create: `src/components/HoleScoreEntry.tsx`
- Create: `src/components/HoleNavigator.tsx`
- Create: `src/components/ScorecardReview.tsx`
- Create: `src/components/ActiveRound.test.tsx`
- Modify: `src/components/ActiveRound.tsx`
- Modify: `src/components/RoundDetails.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getDisplayStrokes(value: unknown): number`
- Consumes: `adjustStrokes(value: unknown, delta: 1 | -1): number | undefined`
- Consumes: `canCompleteRound(round: Round): boolean`
- Produces: `HoleScoreEntry({ hole, displayStrokes, onIncrement, onDecrement })`
- Produces: `HoleNavigator({ holes, scores, selectedHoleNumber, onSelectHole })`
- Produces: `ScorecardReview({ round, onBackToScoring, onEditHole, onFinishRound })`
- Preserves: `ActiveRoundProps` with `round`, `onBack`, `onChangeStrokes`, and `onFinishRound`.

- [ ] **Step 1: Create failing component tests**

Create `src/components/ActiveRound.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveRound } from './ActiveRound';
import { createRoundFromCourse, setHoleStrokes } from '../domain/rounds';
import type { Course, Round } from '../domain/types';
import { renderApp } from '../test/render';

function makeCourse(holeCount: 9 | 18 = 9): Course {
  return {
    id: 'course-1',
    name: 'Test Course',
    source: 'custom',
    holeCount,
    holes: Array.from({ length: holeCount }, (_, index) => ({
      number: index + 1,
      par: index === 0 ? 5 : 4,
      strokeIndex: index + 1,
      teeDistance: 120 + index,
      teeDistanceUnit: 'yards'
    }))
  };
}

function makeRound(holeCount: 9 | 18 = 9): Round {
  return createRoundFromCourse(makeCourse(holeCount), {
    id: 'round-1',
    startedAt: '2026-07-18T01:00:00.000Z'
  });
}

function makeCompleteRound(holeCount: 9 | 18 = 9): Round {
  const round = makeRound(holeCount);
  return round.scores.reduce((currentRound, score) => (
    setHoleStrokes(currentRound, score.holeNumber, 4)
  ), round);
}

describe('ActiveRound mobile scoring', () => {
  it('opens to hole 1 with metadata and an unplayed score displayed as zero', () => {
    renderApp(
      <ActiveRound
        round={makeRound()}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.getByText('Par 5')).toBeInTheDocument();
    expect(screen.getByText('SI 1')).toBeInTheDocument();
    expect(screen.getByText('120 yards')).toBeInTheDocument();
    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('0');
  });

  it('increments and decrements through domain stroke values without storing zero', async () => {
    const onChangeStrokes = vi.fn();
    const firstRender = renderApp(
      <ActiveRound
        round={makeRound()}
        onBack={() => undefined}
        onChangeStrokes={onChangeStrokes}
        onFinishRound={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    expect(onChangeStrokes).toHaveBeenLastCalledWith(1, 1);

    firstRender.unmount();
    const roundWithOneStroke = setHoleStrokes(makeRound(), 1, 1);
    renderApp(
      <ActiveRound
        round={roundWithOneStroke}
        onBack={() => undefined}
        onChangeStrokes={onChangeStrokes}
        onFinishRound={() => undefined}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Decrease hole 1 strokes' }));

    expect(onChangeStrokes).toHaveBeenLastCalledWith(1, undefined);
  });

  it('moves with previous and next controls and opens review from the last hole', async () => {
    renderApp(
      <ActiveRound
        round={makeRound()}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Previous hole' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next hole' }));
    expect(screen.getByRole('heading', { name: 'Hole 2' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous hole' }));
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));

    expect(screen.getByRole('heading', { name: 'Scorecard review' })).toBeInTheDocument();
  });

  it('jumps through the compact navigator and marks played state', async () => {
    const round = setHoleStrokes(makeRound(), 1, 4);
    renderApp(
      <ActiveRound
        round={round}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Hole 1, 4 strokes, selected' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hole 3, unplayed' }));

    expect(screen.getByRole('heading', { name: 'Hole 3' })).toBeInTheDocument();
  });

  it('keeps finish disabled in review until all holes are played and can return to the first missing hole', async () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 4)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));

    expect(screen.getByRole('button', { name: 'Finish round' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Go to hole 2' }));

    expect(screen.getByRole('heading', { name: 'Hole 2' })).toBeInTheDocument();
  });

  it('finishes only from the review screen', async () => {
    const onFinishRound = vi.fn();
    renderApp(
      <ActiveRound
        round={makeCompleteRound()}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={onFinishRound}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, 4 strokes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));

    expect(onFinishRound).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Remove active-round assumptions from the old round details test**

In `src/components/RoundDetails.test.tsx`, delete the test named:

```ts
it('shows tee distances and front/back totals for an active 18-hole round', () => {
```

Keep the completed summary and history tests in that file. Remove the now-unused `ActiveRound` import from the same file.

- [ ] **Step 3: Run failing component tests**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx src/components/RoundDetails.test.tsx
```

Expected: FAIL because the new active-round component tests expect controls and component files that do not exist yet.

- [ ] **Step 4: Create the one-hole score entry component**

Create `src/components/HoleScoreEntry.tsx`:

```tsx
import { Minus, Plus } from 'lucide-react';
import type { Hole } from '../domain/types';

interface HoleScoreEntryProps {
  hole: Hole;
  displayStrokes: number;
  onIncrement(): void;
  onDecrement(): void;
}

export function HoleScoreEntry({ hole, displayStrokes, onIncrement, onDecrement }: HoleScoreEntryProps) {
  return (
    <section className="hole-score-entry" aria-labelledby={`hole-${hole.number}-title`}>
      <div className="hole-title-row">
        <div>
          <p className="eyebrow">Current hole</p>
          <h2 id={`hole-${hole.number}-title`}>Hole {hole.number}</h2>
        </div>
        <div className="hole-meta" aria-label={`Hole ${hole.number} details`}>
          <span>Par {hole.par}</span>
          {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
          {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
        </div>
      </div>
      <div className="score-control" aria-label={`Hole ${hole.number} score controls`}>
        <button
          className="score-stepper-button"
          type="button"
          aria-label={`Decrease hole ${hole.number} strokes`}
          disabled={displayStrokes === 0}
          onClick={onDecrement}
        >
          <Minus aria-hidden="true" size={28} />
        </button>
        <output className="score-value" aria-label={`Hole ${hole.number} displayed score`}>
          {displayStrokes}
        </output>
        <button
          className="score-stepper-button"
          type="button"
          aria-label={`Increase hole ${hole.number} strokes`}
          onClick={onIncrement}
        >
          <Plus aria-hidden="true" size={28} />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create the compact hole navigator**

Create `src/components/HoleNavigator.tsx`:

```tsx
import { getDisplayStrokes } from '../domain/rounds';
import type { Hole, ScoreEntry } from '../domain/types';

interface HoleNavigatorProps {
  holes: Hole[];
  scores: ScoreEntry[];
  selectedHoleNumber: number;
  onSelectHole(holeNumber: number): void;
}

export function HoleNavigator({ holes, scores, selectedHoleNumber, onSelectHole }: HoleNavigatorProps) {
  const scoreByHole = new Map(scores.map((score) => [score.holeNumber, score]));

  return (
    <nav className="hole-navigator" aria-label="Hole navigator">
      {holes.map((hole) => {
        const displayStrokes = getDisplayStrokes(scoreByHole.get(hole.number)?.strokes);
        const selected = hole.number === selectedHoleNumber;
        const stateLabel = displayStrokes > 0 ? `${displayStrokes} strokes` : 'unplayed';
        const selectedLabel = selected ? ', selected' : '';

        return (
          <button
            key={hole.number}
            type="button"
            className={selected ? 'selected' : displayStrokes > 0 ? 'played' : ''}
            aria-current={selected ? 'step' : undefined}
            aria-label={`Hole ${hole.number}, ${stateLabel}${selectedLabel}`}
            onClick={() => onSelectHole(hole.number)}
          >
            <span>{hole.number}</span>
            <small>{displayStrokes}</small>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: Create the scorecard review component**

Create `src/components/ScorecardReview.tsx`:

```tsx
import { canCompleteRound, getDisplayStrokes, getRoundTotals } from '../domain/rounds';
import type { Round } from '../domain/types';

interface ScorecardReviewProps {
  round: Round;
  onBackToScoring(): void;
  onEditHole(holeNumber: number): void;
  onFinishRound(): void;
}

export function ScorecardReview({ round, onBackToScoring, onEditHole, onFinishRound }: ScorecardReviewProps) {
  const totals = getRoundTotals(round);
  const scoreByHole = new Map(round.scores.map((score) => [score.holeNumber, score]));
  const missingHole = round.courseSnapshot.holes.find((hole) =>
    getDisplayStrokes(scoreByHole.get(hole.number)?.strokes) === 0
  );

  return (
    <section className="screen scorecard-review">
      <button className="text-button" type="button" onClick={onBackToScoring}>Back to scoring</button>
      <header className="screen-header">
        <h2>Scorecard review</h2>
        <p>{totals.completedHoles}/{round.courseSnapshot.holeCount} holes · Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
      </header>
      <div className="summary-strip">
        <span>Total {totals.totalStrokes}</span>
        <span>Par {totals.totalPar}</span>
        {round.courseSnapshot.holeCount === 18 ? <span>Out {totals.frontNineStrokes} · In {totals.backNineStrokes}</span> : null}
      </div>
      {missingHole ? (
        <div className="review-alert" role="status">
          <span>Hole {missingHole.number} still needs a score.</span>
          <button className="secondary-button" type="button" onClick={() => onEditHole(missingHole.number)}>
            Go to hole {missingHole.number}
          </button>
        </div>
      ) : null}
      <div className="review-grid" aria-label="Scorecard review holes">
        {round.courseSnapshot.holes.map((hole) => {
          const strokes = getDisplayStrokes(scoreByHole.get(hole.number)?.strokes);
          const scoreToPar = strokes > 0 ? strokes - hole.par : undefined;

          return (
            <button
              key={hole.number}
              type="button"
              className={strokes > 0 ? 'review-hole played' : 'review-hole'}
              onClick={() => onEditHole(hole.number)}
            >
              <strong>Hole {hole.number}</strong>
              <span>Par {hole.par}</span>
              <span>{strokes}</span>
              <small>{scoreToPar === undefined ? 'Unplayed' : formatScoreToPar(scoreToPar)}</small>
            </button>
          );
        })}
      </div>
      <button className="primary-button" type="button" disabled={!canCompleteRound(round)} onClick={onFinishRound}>
        Finish round
      </button>
    </section>
  );
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
```

- [ ] **Step 7: Replace ActiveRound with single-hole state flow**

Replace `src/components/ActiveRound.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Round } from '../domain/types';
import { adjustStrokes, getDisplayStrokes, getRoundTotals } from '../domain/rounds';
import { HoleNavigator } from './HoleNavigator';
import { HoleScoreEntry } from './HoleScoreEntry';
import { ScorecardReview } from './ScorecardReview';

interface ActiveRoundProps {
  round: Round;
  onBack(): void;
  onChangeStrokes(holeNumber: number, strokes: number | undefined): void;
  onFinishRound(): void;
}

type ActiveRoundMode = 'scoring' | 'review';

export function ActiveRound({ round, onBack, onChangeStrokes, onFinishRound }: ActiveRoundProps) {
  const holes = round.courseSnapshot.holes;
  const firstHoleNumber = holes[0]?.number ?? 1;
  const [mode, setMode] = useState<ActiveRoundMode>('scoring');
  const [selectedHoleNumber, setSelectedHoleNumber] = useState(firstHoleNumber);

  useEffect(() => {
    setMode('scoring');
    setSelectedHoleNumber(firstHoleNumber);
  }, [firstHoleNumber, round.id]);

  const totals = getRoundTotals(round);
  const selectedIndex = Math.max(0, holes.findIndex((hole) => hole.number === selectedHoleNumber));
  const selectedHole = holes[selectedIndex] ?? holes[0];
  const selectedScore = round.scores.find((entry) => entry.holeNumber === selectedHole?.number);
  const displayStrokes = getDisplayStrokes(selectedScore?.strokes);

  function changeSelectedStrokes(delta: 1 | -1): void {
    if (!selectedHole) return;
    onChangeStrokes(selectedHole.number, adjustStrokes(selectedScore?.strokes, delta));
  }

  function selectHole(holeNumber: number): void {
    setSelectedHoleNumber(holeNumber);
    setMode('scoring');
  }

  function goToPreviousHole(): void {
    if (selectedIndex <= 0) return;
    setSelectedHoleNumber(holes[selectedIndex - 1].number);
  }

  function goToNextHole(): void {
    if (selectedIndex >= holes.length - 1) {
      setMode('review');
      return;
    }
    setSelectedHoleNumber(holes[selectedIndex + 1].number);
  }

  if (mode === 'review') {
    return (
      <ScorecardReview
        round={round}
        onBackToScoring={() => setMode('scoring')}
        onEditHole={selectHole}
        onFinishRound={onFinishRound}
      />
    );
  }

  return (
    <section className="screen active-round-screen">
      <button className="text-button" type="button" onClick={onBack}>Back</button>
      <header className="screen-header active-round-header">
        <div>
          <h1>{round.courseSnapshot.name}</h1>
          <p>{totals.completedHoles}/{round.courseSnapshot.holeCount} holes · Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
        </div>
      </header>
      {selectedHole ? (
        <HoleScoreEntry
          hole={selectedHole}
          displayStrokes={displayStrokes}
          onIncrement={() => changeSelectedStrokes(1)}
          onDecrement={() => changeSelectedStrokes(-1)}
        />
      ) : null}
      <div className="hole-navigation-controls">
        <button
          className="secondary-button"
          type="button"
          aria-label="Previous hole"
          disabled={selectedIndex <= 0}
          onClick={goToPreviousHole}
        >
          <ChevronLeft aria-hidden="true" size={20} />
          <span>Previous</span>
        </button>
        <button
          className="primary-button"
          type="button"
          aria-label={selectedIndex >= holes.length - 1 ? 'Review scorecard' : 'Next hole'}
          onClick={goToNextHole}
        >
          <span>{selectedIndex >= holes.length - 1 ? 'Review scorecard' : 'Next'}</span>
          {selectedIndex >= holes.length - 1 ? null : <ChevronRight aria-hidden="true" size={20} />}
        </button>
      </div>
      <HoleNavigator
        holes={holes}
        scores={round.scores}
        selectedHoleNumber={selectedHole?.number ?? firstHoleNumber}
        onSelectHole={selectHole}
      />
    </section>
  );
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
```

- [ ] **Step 8: Replace old score-entry styles with mobile scoring styles**

In `src/styles.css`, delete the `.score-entry-list`, `.score-entry-row`, `.score-entry-row small`, and `.score-entry-row input` rules.

Add these rules before `.primary-button:disabled`:

```css
.active-round-screen {
  padding-bottom: 24px;
}

.active-round-header {
  display: grid;
  gap: 8px;
}

.hole-score-entry {
  display: grid;
  gap: 18px;
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fffdf7;
  padding: 16px;
}

.hole-title-row {
  display: grid;
  gap: 10px;
}

.hole-title-row h2 {
  margin: 0;
  font-size: 2rem;
}

.hole-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hole-meta span {
  border-radius: 8px;
  background: #e4efe8;
  padding: 8px 10px;
  font-weight: 800;
}

.score-control {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 64px;
  align-items: center;
  gap: 12px;
}

.score-stepper-button {
  min-height: 64px;
  border: 1px solid #174a3c;
  border-radius: 8px;
  background: #ffffff;
  color: #174a3c;
  display: grid;
  place-items: center;
}

.score-stepper-button:disabled {
  opacity: 0.4;
}

.score-value {
  min-height: 96px;
  border-radius: 8px;
  background: #174a3c;
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 4rem;
  font-weight: 900;
}

.hole-navigation-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hole-navigation-controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.hole-navigator {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 6px;
}

.hole-navigator button {
  min-width: 0;
  min-height: 48px;
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fffdf7;
  color: #17362f;
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 4px;
  font-weight: 800;
}

.hole-navigator button.played {
  background: #e4efe8;
  border-color: #9bbbab;
}

.hole-navigator button.selected {
  background: #174a3c;
  border-color: #174a3c;
  color: #ffffff;
}

.hole-navigator small {
  font-size: 0.72rem;
}

.scorecard-review {
  padding-bottom: 24px;
}

.review-alert {
  display: grid;
  gap: 8px;
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fff7df;
  padding: 12px;
  font-weight: 800;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.review-hole {
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fffdf7;
  color: #17362f;
  display: grid;
  gap: 4px;
  padding: 10px;
  text-align: left;
}

.review-hole.played {
  background: #e4efe8;
}

.review-hole span,
.review-hole small {
  color: #52675f;
}
```

In the existing `@media (max-width: 380px)` block, replace the `.score-entry-row` rule with:

```css
  .score-control {
    grid-template-columns: 56px minmax(0, 1fr) 56px;
  }

  .score-value {
    font-size: 3.25rem;
  }

  .hole-navigator {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
```

- [ ] **Step 9: Run task tests**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx src/components/RoundDetails.test.tsx src/domain/rounds.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/components src/styles.css
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add mobile hole scoring flow"
```

Expected: commit succeeds.

---

### Task 3: App Integration Tests, E2E Flow, And Full Verification

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `e2e/score-round.spec.ts`

**Interfaces:**
- Consumes: active-round button labels `Increase hole N strokes`, `Next hole`, `Review scorecard`, `Finish round`, and navigator labels such as `Hole N, unplayed` or `Hole N, 4 strokes`.
- Produces: updated app-level and browser-level proof that seeded and provider-backed rounds can be scored through the new mobile flow.
- Preserves: summary and history behavior after `onFinishRound` completes the existing round.

- [ ] **Step 1: Add app-test helper for scoring the visible active round**

In `src/App.test.tsx`, add this helper after `providerCourse`:

```tsx
async function scoreVisibleRound(holeCount: number, strokesPerHole: number): Promise<void> {
  for (let hole = 1; hole <= holeCount; hole += 1) {
    for (let stroke = 0; stroke < strokesPerHole; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: `Increase hole ${hole} strokes` }));
    }
    if (hole < holeCount) {
      await userEvent.click(screen.getByRole('button', { name: 'Next hole' }));
    }
  }
  await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));
}
```

- [ ] **Step 2: Update seeded scoring app test**

In the test named `starts a seeded course round, records strokes, finishes it, and shows history`, replace the numeric input loop and finish click:

```tsx
    for (let hole = 1; hole <= 9; hole += 1) {
      await userEvent.clear(screen.getByLabelText(`Hole ${hole} strokes`));
      await userEvent.type(screen.getByLabelText(`Hole ${hole} strokes`), '4');
    }

    await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));
```

with:

```tsx
    await scoreVisibleRound(9, 4);
    await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));
```

- [ ] **Step 3: Update resume app tests for displayed score output**

In the test named `resumes an in-progress autosaved round after remount`, replace:

```tsx
    await userEvent.clear(screen.getByLabelText('Hole 1 strokes'));
    await userEvent.type(screen.getByLabelText('Hole 1 strokes'), '5');
```

with:

```tsx
    for (let stroke = 0; stroke < 5; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    }
```

Then replace:

```tsx
    expect(screen.getByLabelText('Hole 1 strokes')).toHaveValue(5);
```

with:

```tsx
    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('5');
```

In the test named `preserves an edited resumed round when a pending provider load resolves`, replace:

```tsx
    await userEvent.clear(screen.getByLabelText('Hole 1 strokes'));
    await userEvent.type(screen.getByLabelText('Hole 1 strokes'), '5');
```

with:

```tsx
    for (let stroke = 0; stroke < 5; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    }
```

Then replace:

```tsx
    expect(screen.getByLabelText('Hole 1 strokes')).toHaveValue(5);
```

with:

```tsx
    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('5');
```

- [ ] **Step 4: Update active-round presence assertions**

In the test named `routes a new start request to the existing in-progress round`, replace:

```tsx
    expect(screen.queryByLabelText('Hole 18 strokes')).not.toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hole 18,/ })).not.toBeInTheDocument();
```

In the test named `exposes every persisted in-progress round for resuming`, replace:

```tsx
    expect(screen.getByLabelText('Hole 18 strokes')).toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hole 18, unplayed/ })).toBeInTheDocument();
```

In the provider test named `searches provided courses, saves one locally, and starts a round from it`, replace:

```tsx
  expect(screen.getByLabelText('Hole 18 strokes')).toBeInTheDocument();
```

with:

```tsx
  expect(screen.getByRole('button', { name: /Hole 18, unplayed/ })).toBeInTheDocument();
```

- [ ] **Step 5: Run app tests to expose remaining old-input assumptions**

Run:

```powershell
npm test -- --run src/App.test.tsx
```

Expected: PASS.

Run this scan:

```powershell
rg -n "Hole \\$\\{hole\\} strokes|Hole 1 strokes|Hole 18 strokes" src\\App.test.tsx
```

Expected: no output.

- [ ] **Step 6: Update Playwright seeded scoring flow**

In `e2e/score-round.spec.ts`, replace the import:

```ts
import { expect, test } from '@playwright/test';
```

with:

```ts
import { expect, test, type Page } from '@playwright/test';
```

Add this helper below the imports:

```ts
async function scoreRound(page: Page, holeCount: number, strokesPerHole: number) {
  for (let hole = 1; hole <= holeCount; hole += 1) {
    for (let stroke = 0; stroke < strokesPerHole; stroke += 1) {
      await page.getByRole('button', { name: `Increase hole ${hole} strokes` }).click();
    }
    if (hole < holeCount) {
      await page.getByRole('button', { name: 'Next hole' }).click();
    }
  }
  await page.getByRole('button', { name: 'Review scorecard' }).click();
}
```

In the seeded 9-hole test, replace:

```ts
  for (let hole = 1; hole <= 9; hole += 1) {
    await page.getByLabel(`Hole ${hole} strokes`).fill('4');
  }
```

with:

```ts
  await scoreRound(page, 9, 4);
```

- [ ] **Step 7: Update Playwright provider scoring flow**

In the provided 18-hole test, replace:

```ts
  for (let hole = 1; hole <= 18; hole += 1) {
    await page.getByLabel(`Hole ${hole} strokes`).fill('4');
  }
```

with:

```ts
  await page.getByRole('button', { name: /Hole 10, unplayed/ }).click();
  await expect(page.getByRole('heading', { name: 'Hole 10' })).toBeVisible();
  await page.getByRole('button', { name: /Hole 1, unplayed/ }).click();
  await scoreRound(page, 18, 4);
```

Keep the existing finish, summary, and history assertions:

```ts
  await page.getByRole('button', { name: 'Finish round' }).click();
  await expect(page.getByText('Total 72', { exact: true })).toBeVisible();
```

- [ ] **Step 8: Run app and browser workflow tests**

Run:

```powershell
npm test -- --run src/App.test.tsx src/components/ActiveRound.test.tsx src/components/RoundDetails.test.tsx
```

Expected: PASS.

Run:

```powershell
npm run e2e
```

Expected: PASS for the mobile seeded-course and provided-course scoring workflows.

- [ ] **Step 9: Run full verification**

Run:

```powershell
npm test -- --run
```

Expected: PASS with all Vitest suites.

Run:

```powershell
npm run build
```

Expected: PASS with TypeScript compilation and Vite production build completing.

- [ ] **Step 10: Commit Task 3**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/App.test.tsx e2e/score-round.spec.ts
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "test: update scoring flows for mobile entry"
```

Expected: commit succeeds.

---

## Self-Review Notes

- Spec coverage: Task 1 implements `0` display versus nullish/omitted stored unplayed values, protects completion rules, and keeps totals positive-stroke-only. Task 2 implements single-hole entry, plus/minus controls, previous/next navigation, compact navigator, future hole-detail layout space, accessible labels, and the review gate. Task 3 proves the new flow through app-level and mobile browser workflows.
- Scope check: The plan does not add putts, penalties, fairways, greens, GPS, maps, shot tracking, provider changes, custom course changes, backend services, or score fields beyond strokes.
- Type consistency: `normalizeStrokes`, `getDisplayStrokes`, `adjustStrokes`, `HoleScoreEntry`, `HoleNavigator`, and `ScorecardReview` are defined before use. `ActiveRoundProps` remains compatible with `App`.
- Test coverage: Unit tests cover display/domain conversion and storage normalization. Component tests cover single-hole scoring, navigation, navigator state, review blocking, missing-hole return, and finish callback. App and E2E tests cover seeded and provider-backed mobile scoring through the new controls.
