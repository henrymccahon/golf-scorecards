# Mobile Scoring Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the deployed mobile scoring flow by fixing contextual page titles, course detail metadata spacing, and the narrow last-hole review action label.

**Architecture:** Keep the existing scoring flow and data model unchanged. Add a small app-level page-title decision in `App`, improve course detail markup only where CSS needs a stable layout hook, and keep `ActiveRound`'s accessible action contract while shortening the visible last-hole label.

**Tech Stack:** React 18, TypeScript 5, Vite, Vitest, React Testing Library, Playwright mobile workflow, browser `localStorage`, CSS.

## Global Constraints

- The scoring model, review gate, plus/minus controls, and persistence rules stay unchanged.
- Scope is limited to small clarity and layout improvements found during mobile QA.
- Show an accurate top-level page heading while scoring, reviewing, viewing a course, editing a course, or reading a summary.
- Make course detail scorecard rows readable on narrow screens by spacing hole metadata instead of allowing it to run together.
- Keep the last-hole primary action readable at 320px while preserving the accessible action name `Review scorecard`.
- Do not add scoring shortcuts such as set-par, quick scores, or score-to-par chips.
- Do not change provider search, course import, account, sync, backend, bottom navigation, or theme behavior.
- Current workspace note: normal `.git` metadata may not be available from the worktree root, so commit commands below use `git --git-dir='work\\golf-scorecard-design.git' --work-tree='.'`.

---

## File Structure

- `src/App.tsx`: derive the app-level header title from current view state.
- `src/App.test.tsx`: verify contextual app header titles through course detail, scoring, review, summary, history, and course setup.
- `src/components/CourseDetail.tsx`: group each hole row's metadata in a labelled wrapper that CSS can space cleanly.
- `src/components/CourseDetail.test.tsx`: verify course detail rows expose hole metadata as grouped content.
- `src/components/ActiveRound.tsx`: keep the last-hole button accessible name as `Review scorecard` while using compact visible text.
- `src/components/ActiveRound.test.tsx`: verify the compact visible label and unchanged accessible button name.
- `src/styles.css`: add targeted layout rules for course detail metadata and narrow active-round navigation controls.

---

### Task 1: Contextual App Header Titles

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: local `getPageTitle(): string` inside `App`.
- Consumes: existing `activeRound`, `summaryRound`, `editingCourseId`, `selectedCourse`, and `activeTab` view state.
- Preserves: the existing bottom navigation state and all screen routing behavior.

- [ ] **Step 1: Add failing app title tests**

Add these tests inside `describe('App course flows', () => { })` in `src/App.test.tsx`, after the existing `searches seeded courses` test:

```tsx
  it('shows contextual app header titles while moving through scoring states', async () => {
    renderApp(<App />);

    expect(screen.getByRole('heading', { name: 'Start a round' })).toBeInTheDocument();

    await userEvent.click(screen.getByText('Lakeview Nine'));
    expect(screen.getByRole('heading', { name: 'Course scorecard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lakeview Nine' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    expect(screen.getByRole('heading', { name: 'Score round' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();

    await scoreVisibleRound(9, 4);
    expect(screen.getByRole('heading', { name: 'Score round' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scorecard review' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));
    expect(screen.getByRole('heading', { name: 'Round summary' })).toBeInTheDocument();
    expect(screen.getByText('Total 36')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
  });

  it('shows course setup as the app header while creating a custom course', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));

    expect(screen.getByRole('heading', { name: 'Course setup' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create course' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the failing app title tests**

Run:

```powershell
npm test -- --run src/App.test.tsx
```

Expected: FAIL because `Course scorecard`, `Score round`, `Round summary`, and `Course setup` are not app-level headings yet.

- [ ] **Step 3: Add the contextual title helper**

In `src/App.tsx`, add this local constant and helper after `resetSavedData()` and before the `return` statement:

```tsx
  const pageTitle = getPageTitle();

  function getPageTitle(): string {
    if (activeRound) return 'Score round';
    if (summaryRound) return 'Round summary';
    if (editingCourseId) return 'Course setup';
    if (selectedCourse) return 'Course scorecard';
    if (activeTab === 'history') return 'History';
    if (activeTab === 'courses') return 'Courses';
    return 'Start a round';
  }
```

- [ ] **Step 4: Use the contextual title in the app header**

In `src/App.tsx`, replace:

```tsx
        <h1>{activeTab === 'history' ? 'History' : activeTab === 'courses' ? 'Courses' : 'Start a round'}</h1>
```

with:

```tsx
        <h1>{pageTitle}</h1>
```

- [ ] **Step 5: Run the app title tests**

Run:

```powershell
npm test -- --run src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/App.tsx src/App.test.tsx
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "fix: add contextual app headings"
```

Expected: commit succeeds.

---

### Task 2: Course Detail Metadata Spacing

**Files:**
- Create: `src/components/CourseDetail.test.tsx`
- Modify: `src/components/CourseDetail.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `aria-label="Hole N scorecard row"` on each course detail hole row.
- Produces: `aria-label="Hole N metadata"` on each grouped metadata wrapper.
- Preserves: `CourseDetailProps` and the `onStartRound(course.id)` / `onEditCourse(course.id)` callbacks.

- [ ] **Step 1: Create the failing CourseDetail test**

Create `src/components/CourseDetail.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CourseDetail } from './CourseDetail';
import type { Course } from '../domain/types';
import { renderApp } from '../test/render';

function makeCourse(): Course {
  return {
    id: 'course-1',
    name: 'Polish Nine',
    source: 'custom',
    holeCount: 9,
    holes: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      par: index === 0 ? 5 : 4,
      strokeIndex: index + 1,
      teeDistance: 120 + index,
      teeDistanceUnit: 'yards'
    }))
  };
}

describe('CourseDetail', () => {
  it('groups hole metadata so mobile rows can wrap with spacing', () => {
    renderApp(
      <CourseDetail
        course={makeCourse()}
        onBack={() => undefined}
        onStartRound={() => undefined}
        onEditCourse={() => undefined}
      />
    );

    const holeRow = screen.getByLabelText('Hole 1 scorecard row');
    const metadata = screen.getByLabelText('Hole 1 metadata');

    expect(holeRow).toContainElement(metadata);
    expect(metadata).toHaveTextContent('Par 5');
    expect(metadata).toHaveTextContent('SI 1');
    expect(metadata).toHaveTextContent('120 yards');
  });

  it('keeps start and edit callbacks unchanged', async () => {
    const onStartRound = vi.fn();
    const onEditCourse = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        onBack={() => undefined}
        onStartRound={onStartRound}
        onEditCourse={onEditCourse}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit course' }));

    expect(onStartRound).toHaveBeenCalledWith('course-1');
    expect(onEditCourse).toHaveBeenCalledWith('course-1');
  });
});
```

- [ ] **Step 2: Run the failing CourseDetail test**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx
```

Expected: FAIL because the course detail rows do not expose `Hole 1 scorecard row` or `Hole 1 metadata` yet.

- [ ] **Step 3: Group course detail hole metadata**

In `src/components/CourseDetail.tsx`, replace the hole card body:

```tsx
          <div key={hole.number} className="hole-card">
            <strong>Hole {hole.number}</strong>
            <span>Par {hole.par}</span>
            {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
            {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
          </div>
```

with:

```tsx
          <div
            key={hole.number}
            className="hole-card course-detail-hole-card"
            aria-label={`Hole ${hole.number} scorecard row`}
          >
            <strong>Hole {hole.number}</strong>
            <div className="course-detail-hole-meta" aria-label={`Hole ${hole.number} metadata`}>
              <span>Par {hole.par}</span>
              {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
              {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
            </div>
          </div>
```

- [ ] **Step 4: Add targeted course detail spacing CSS**

In `src/styles.css`, add these rules after `.course-row small`:

```css
.course-detail-hole-card {
  display: grid;
  gap: 8px;
}

.course-detail-hole-card strong {
  line-height: 1.2;
}

.course-detail-hole-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: #52675f;
}

.course-detail-hole-meta span {
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the CourseDetail test**

Run:

```powershell
npm test -- --run src/components/CourseDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/components/CourseDetail.tsx src/components/CourseDetail.test.tsx src/styles.css
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "fix: improve course detail mobile rows"
```

Expected: commit succeeds.

---

### Task 3: Compact Last-Hole Review Action

**Files:**
- Modify: `src/components/ActiveRound.test.tsx`
- Modify: `src/components/ActiveRound.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `ActiveRound` selected-hole state and `onFinishRound` review gate.
- Produces: visible last-hole primary button text `Review`.
- Preserves: accessible button name `Review scorecard`.

- [ ] **Step 1: Add the failing compact-label assertion**

In `src/components/ActiveRound.test.tsx`, inside the test named `moves with previous and next controls and opens review from the last hole`, replace:

```tsx
    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));
```

with:

```tsx
    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    const reviewScorecardButton = screen.getByRole('button', { name: 'Review scorecard' });
    expect(reviewScorecardButton).toHaveTextContent(/^Review$/);
    await userEvent.click(reviewScorecardButton);
```

- [ ] **Step 2: Run the failing ActiveRound test**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx
```

Expected: FAIL because the visible button text is currently `Review scorecard`.

- [ ] **Step 3: Add an `isLastHole` render helper**

In `src/components/ActiveRound.tsx`, after `const displayStrokes = getDisplayStrokes(selectedScore?.strokes);`, add:

```tsx
  const isLastHole = selectedIndex >= holes.length - 1;
```

- [ ] **Step 4: Use compact visible text while preserving the accessible name**

In `src/components/ActiveRound.tsx`, replace the second button inside `.hole-navigation-controls`:

```tsx
        <button
          className="primary-button"
          type="button"
          aria-label={selectedIndex >= holes.length - 1 ? 'Review scorecard' : 'Next hole'}
          onClick={goToNextHole}
        >
          <span>{selectedIndex >= holes.length - 1 ? 'Review scorecard' : 'Next'}</span>
          {selectedIndex >= holes.length - 1 ? null : <ChevronRight aria-hidden="true" size={20} />}
        </button>
```

with:

```tsx
        <button
          className="primary-button"
          type="button"
          aria-label={isLastHole ? 'Review scorecard' : 'Next hole'}
          onClick={goToNextHole}
        >
          <span>{isLastHole ? 'Review' : 'Next'}</span>
          {isLastHole ? null : <ChevronRight aria-hidden="true" size={20} />}
        </button>
```

- [ ] **Step 5: Tighten narrow navigation button spacing**

In `src/styles.css`, update the existing `.hole-navigation-controls button` rule from:

```css
.hole-navigation-controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
```

to:

```css
.hole-navigation-controls button {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
```

Inside the existing `@media (max-width: 380px)` block, add these rules after `.score-value`:

```css
  .hole-navigation-controls {
    gap: 8px;
  }

  .hole-navigation-controls button {
    padding-inline: 8px;
    font-size: 0.92rem;
  }
```

- [ ] **Step 6: Run the ActiveRound test**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/components/ActiveRound.tsx src/components/ActiveRound.test.tsx src/styles.css
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "fix: keep review action compact on mobile"
```

Expected: commit succeeds.

---

### Task 4: Full Verification And Rendered QA

**Files:**
- No source files should change in this task.

**Interfaces:**
- Consumes: all commits from Tasks 1-3.
- Produces: verification evidence for tests, build, e2e, and mobile rendered QA.

- [ ] **Step 1: Run focused affected tests**

Run:

```powershell
npm test -- --run src/App.test.tsx src/components/ActiveRound.test.tsx src/components/CourseDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full unit and component tests**

Run:

```powershell
npm test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: PASS with TypeScript compilation and Vite production build completing.

- [ ] **Step 4: Run the mobile browser workflow**

Run:

```powershell
npm run e2e
```

Expected: PASS for the seeded 9-hole and provided 18-hole mobile scoring workflows.

- [ ] **Step 5: Start the local dev server for rendered QA**

Run in a long-running terminal session:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Expected: Vite reports `http://127.0.0.1:5173/`.

- [ ] **Step 6: Verify rendered mobile polish at 390px**

Use the Browser plugin against `http://127.0.0.1:5173/` with viewport `390x844`.

Check:

- Page title is `Golf Scorecard`.
- The app is not blank.
- No Vite, React, or framework error overlay is visible.
- Browser console has no app errors or warnings.
- Selecting `Lakeview Nine` shows app header `Course scorecard`.
- Course detail rows show spaced metadata, not concatenated metadata.
- Starting the round shows app header `Score round`.
- Opening review shows app header `Score round` and in-screen heading `Scorecard review`.

- [ ] **Step 7: Verify rendered mobile polish at 320px**

Use the Browser plugin against the same local page with viewport `320x740`.

Check:

- The last-hole primary action has accessible name `Review scorecard`.
- The visible last-hole primary action text is `Review`.
- The previous/review control row fits without clipped text.
- Course detail rows still wrap metadata with visible gaps.
- No horizontal page overflow is introduced.

- [ ] **Step 8: Stop the local dev server**

Stop the Vite process started in Step 5.

Expected: no long-running dev server remains.

---

## Self-Review Notes

- Spec coverage: Task 1 implements accurate top-level headings for scoring, review, course detail, course setup, summary, history, and default play states. Task 2 implements readable course detail metadata spacing. Task 3 implements the 320px last-hole review action polish while preserving the accessible name. Task 4 verifies tests, build, e2e, and rendered mobile behavior.
- Scope check: The plan does not change scoring data, persistence, provider search, course import, accounts, sync, bottom navigation, or theme behavior.
- Type consistency: `getPageTitle(): string`, `CourseDetailProps`, `ActiveRoundProps`, `aria-label="Review scorecard"`, and the test query names all match existing component contracts.
- Test coverage: App-level tests cover contextual headings, component tests cover course detail metadata grouping and compact review action, e2e preserves the main mobile scoring workflows, and Browser QA covers the visual polish findings.
