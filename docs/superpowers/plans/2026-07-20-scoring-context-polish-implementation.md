# Scoring Context Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clearer per-hole scoring context to the active scoring and scorecard review screens without changing scoring behavior or persistence.

**Architecture:** Keep scoring state in `ActiveRound` and keep `HoleScoreEntry` presentational. Add display-only score-to-par copy for the selected hole, and render review-card metadata from `round.courseSnapshot.holes` so historical round details remain stable. CSS changes stay local to the existing scoring/review class names.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Playwright for rendered QA, localStorage persistence.

## Global Constraints

- Do not change the scoring model.
- Do not store `0` for unplayed holes.
- Do not add putts, penalties, fairways, greens, notes, shot prompts, or pro features.
- Do not add quick-score actions such as set-par, bogey, birdie, or pickup.
- Do not change resume, abandon, history, provider search, custom course editing, or round completion behavior.
- Do not redesign the bottom navigation, page shell, or app theme.
- Keep the displayed unplayed score as `0`.
- Use `No score yet` for the active-hole unplayed context label.
- Use `Even on this hole` for the active-hole at-par context label.
- Use signed labels such as `+1 on this hole` and `-1 on this hole` for active-hole over-par and under-par context labels.
- Add scorecard review metadata from `round.courseSnapshot.holes`, not from editable current course data.
- Text must wrap or stack at 320px rather than overflow.
- Use an isolated worktree from latest `origin/main` before implementation. Do not touch the unrelated dirty original workspace file `docs/superpowers/specs/2026-07-19-mobile-scoring-polish-design.md` or untracked `.superpowers/sdd/*` scratch files.

---

## File Structure

- `src/components/ActiveRound.tsx`: derive the selected hole's display-only context label from selected score and par, and pass it to `HoleScoreEntry`.
- `src/components/HoleScoreEntry.tsx`: render the context label near the large score output while preserving score controls and accessible labels.
- `src/components/ScorecardReview.tsx`: render compact optional review metadata for SI and tee distance on each review card.
- `src/components/ActiveRound.test.tsx`: cover active-hole unplayed/even/over/under labels and review metadata.
- `src/styles.css`: style the active-hole context label and compact review metadata for 320px readability.

---

### Task 1: Active Hole Score Context

**Files:**
- Modify: `src/components/ActiveRound.tsx`
- Modify: `src/components/HoleScoreEntry.tsx`
- Modify: `src/components/ActiveRound.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes existing `getDisplayStrokes(strokes)` from `src/domain/rounds.ts`.
- Extends `HoleScoreEntry` props with:

```ts
scoreContext: string;
```

- Produces helper in `src/components/ActiveRound.tsx`:

```ts
function getHoleScoreContext(strokes: number | undefined, par: number): string
```

Expected outputs:

- `getHoleScoreContext(undefined, 4)` returns `No score yet`.
- `getHoleScoreContext(4, 4)` returns `Even on this hole`.
- `getHoleScoreContext(5, 4)` returns `+1 on this hole`.
- `getHoleScoreContext(3, 4)` returns `-1 on this hole`.

- [ ] **Step 1: Add failing tests for active-hole score context**

In `src/components/ActiveRound.test.tsx`, change the test named `opens to hole 1 with metadata and an unplayed score displayed as zero` to include the unplayed context assertion:

```tsx
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
    expect(screen.getByText('No score yet')).toBeInTheDocument();
  });
```

Add these tests after that test:

```tsx
  it('shows even score context for a hole scored at par', () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 5)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('5');
    expect(screen.getByText('Even on this hole')).toBeInTheDocument();
  });

  it('shows over-par score context for a hole scored above par', () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 6)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('6');
    expect(screen.getByText('+1 on this hole')).toBeInTheDocument();
  });

  it('shows under-par score context for a hole scored below par', () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 4)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('4');
    expect(screen.getByText('-1 on this hole')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run active context tests to verify they fail**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx -t "unplayed score displayed|even score context|over-par score context|under-par score context"
```

Expected: FAIL because `No score yet`, `Even on this hole`, `+1 on this hole`, and `-1 on this hole` are not rendered yet.

- [ ] **Step 3: Extend `HoleScoreEntry` to render score context**

In `src/components/HoleScoreEntry.tsx`, replace the whole file with:

```tsx
import { Minus, Plus } from 'lucide-react';
import type { Hole } from '../domain/types';

interface HoleScoreEntryProps {
  hole: Hole;
  displayStrokes: number;
  scoreContext: string;
  onIncrement(): void;
  onDecrement(): void;
}

export function HoleScoreEntry({ hole, displayStrokes, scoreContext, onIncrement, onDecrement }: HoleScoreEntryProps) {
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
        <div className="score-value-group">
          <output className="score-value" aria-label={`Hole ${hole.number} displayed score`}>
            {displayStrokes}
          </output>
          <p className="score-context">{scoreContext}</p>
        </div>
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

- [ ] **Step 4: Pass score context from `ActiveRound`**

In `src/components/ActiveRound.tsx`, update the `HoleScoreEntry` render to include `scoreContext`:

```tsx
        <HoleScoreEntry
          hole={selectedHole}
          displayStrokes={displayStrokes}
          scoreContext={getHoleScoreContext(selectedScore?.strokes, selectedHole.par)}
          onIncrement={() => changeSelectedStrokes(1)}
          onDecrement={() => changeSelectedStrokes(-1)}
        />
```

Add this helper near the bottom of `src/components/ActiveRound.tsx`, above `formatScoreToPar`:

```tsx
function getHoleScoreContext(strokes: number | undefined, par: number): string {
  if (strokes === undefined) return 'No score yet';

  const scoreToPar = strokes - par;
  if (scoreToPar === 0) return 'Even on this hole';
  return `${formatScoreToPar(scoreToPar)} on this hole`;
}
```

- [ ] **Step 5: Add score context CSS**

In `src/styles.css`, replace the existing `.score-value` block:

```css
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
```

with:

```css
.score-value-group {
  min-width: 0;
  display: grid;
  gap: 8px;
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

.score-context {
  margin: 0;
  color: #52675f;
  font-weight: 800;
  text-align: center;
}
```

- [ ] **Step 6: Run active context tests to verify they pass**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx -t "unplayed score displayed|even score context|over-par score context|under-par score context"
```

Expected: PASS for the four selected tests.

- [ ] **Step 7: Run the full ActiveRound component suite**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx
```

Expected: PASS for all `ActiveRound mobile scoring` tests.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git status --short
git add src/components/ActiveRound.tsx src/components/HoleScoreEntry.tsx src/components/ActiveRound.test.tsx src/styles.css
git commit -m "feat: show active hole score context"
```

Expected: commit includes only the four Task 1 files.

---

### Task 2: Scorecard Review Metadata

**Files:**
- Modify: `src/components/ScorecardReview.tsx`
- Modify: `src/components/ActiveRound.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes `round.courseSnapshot.holes` metadata:

```ts
strokeIndex?: number;
teeDistance?: number;
teeDistanceUnit?: 'meters' | 'yards';
```

- Produces helper in `src/components/ScorecardReview.tsx`:

```ts
function getHoleMetadataLabel(hole: Round['courseSnapshot']['holes'][number]): string | undefined
```

Expected outputs:

- Hole with `strokeIndex: 1`, `teeDistance: 120`, `teeDistanceUnit: 'yards'` returns `SI 1 · 120 yards`.
- Hole with only `strokeIndex: 1` returns `SI 1`.
- Hole with only `teeDistance: 120`, `teeDistanceUnit: 'yards'` returns `120 yards`.
- Hole with neither returns `undefined`.

- [ ] **Step 1: Add failing review metadata test**

In `src/components/ActiveRound.test.tsx`, add this test after `keeps finish disabled in review until all holes are played and can return to the first missing hole`:

```tsx
  it('shows stroke index and distance metadata on scorecard review holes', async () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 5)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));

    expect(screen.getByRole('button', { name: /Hole 1/ })).toHaveTextContent('SI 1 · 120 yards');
    expect(screen.getByRole('button', { name: /Hole 2/ })).toHaveTextContent('SI 2 · 121 yards');
  });
```

- [ ] **Step 2: Run review metadata test to verify it fails**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx -t "stroke index and distance metadata"
```

Expected: FAIL because review cards do not render SI or tee distance metadata.

- [ ] **Step 3: Render review metadata in `ScorecardReview`**

In `src/components/ScorecardReview.tsx`, inside the existing `round.courseSnapshot.holes.map((hole) => {` block, add this line after the `scoreToPar` declaration:

```tsx
          const metadataLabel = getHoleMetadataLabel(hole);
```

Then replace the review card children:

```tsx
              <strong>Hole {hole.number}</strong>
              <span>Par {hole.par}</span>
              <span>{strokes}</span>
              <small>{scoreToPar === undefined ? 'Unplayed' : formatScoreToPar(scoreToPar)}</small>
```

with:

```tsx
              <strong>Hole {hole.number}</strong>
              <span>Par {hole.par}</span>
              <span>{strokes}</span>
              <small>{scoreToPar === undefined ? 'Unplayed' : formatScoreToPar(scoreToPar)}</small>
              {metadataLabel ? <small className="review-hole-meta">{metadataLabel}</small> : null}
```

Add this helper above `formatScoreToPar`:

```tsx
function getHoleMetadataLabel(hole: Round['courseSnapshot']['holes'][number]): string | undefined {
  const metadata = [
    hole.strokeIndex ? `SI ${hole.strokeIndex}` : undefined,
    hole.teeDistance ? `${hole.teeDistance} ${hole.teeDistanceUnit ?? 'meters'}` : undefined
  ].filter(Boolean);

  return metadata.length > 0 ? metadata.join(' · ') : undefined;
}
```

- [ ] **Step 4: Add review metadata CSS**

In `src/styles.css`, after the existing block:

```css
.review-hole span,
.review-hole small {
  color: #52675f;
}
```

add:

```css
.review-hole-meta {
  line-height: 1.25;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 5: Run review metadata test to verify it passes**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx -t "stroke index and distance metadata"
```

Expected: PASS for the review metadata test.

- [ ] **Step 6: Run the full ActiveRound component suite**

Run:

```powershell
npm test -- --run src/components/ActiveRound.test.tsx
```

Expected: PASS for all `ActiveRound mobile scoring` tests, including Task 1 tests.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git status --short
git add src/components/ScorecardReview.tsx src/components/ActiveRound.test.tsx src/styles.css
git commit -m "feat: show review hole metadata"
```

Expected: commit includes only the three Task 2 files.

---

### Task 3: Final Verification And Rendered QA

**Files:**
- Modify only if verification reveals a defect in files changed by Tasks 1-2.
- Save screenshots outside the repo, for example under `C:\tmp`.

**Interfaces:**
- Consumes completed Task 1 active-hole score context.
- Consumes completed Task 2 review-card metadata.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
npm test -- --run
npm run build
npm run e2e
```

Expected:

- Unit tests pass with 0 failures.
- Build exits 0.
- E2E exits 0.

- [ ] **Step 2: Start local Vite server for rendered QA**

Run:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.ms-playwright'
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected: Vite serves the app at `http://127.0.0.1:5173/golf-scorecards/`.

Keep this process running until rendered QA is complete. If port 5173 is busy, use 5174 and replace the URL in Step 3.

- [ ] **Step 3: Run mobile rendered QA smoke script**

In a separate shell, run this script from the repo root:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.ms-playwright'
@'
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotDir = 'C:/tmp';
  fs.mkdirSync(screenshotDir, { recursive: true });
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

  async function assertNoHorizontalOverflow(label) {
    const overflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth
    }));
    const maxScrollWidth = Math.max(overflow.documentScrollWidth, overflow.bodyScrollWidth);
    if (maxScrollWidth > overflow.viewportWidth + 1) {
      throw new Error(`${label} overflowed horizontally: viewport ${overflow.viewportWidth}, scroll ${maxScrollWidth}`);
    }
  }

  await page.goto('http://127.0.0.1:5173/golf-scorecards/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Lakeview Nine 9 holes/i }).click();
  await page.getByRole('button', { name: 'Start round' }).click();
  await expect(page.getByText('No score yet')).toBeVisible();
  await assertNoHorizontalOverflow('active unplayed state');
  await page.screenshot({ path: path.join(screenshotDir, 'scoring-context-unplayed-320.png'), fullPage: true });

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: 'Increase hole 1 strokes' }).click();
  }
  await expect(page.getByText('Even on this hole')).toBeVisible();
  await page.getByRole('button', { name: 'Increase hole 1 strokes' }).click();
  await expect(page.getByText('+1 on this hole')).toBeVisible();
  await assertNoHorizontalOverflow('active over-par state');
  await page.screenshot({ path: path.join(screenshotDir, 'scoring-context-over-par-320.png'), fullPage: true });

  await page.getByRole('button', { name: /Hole 9, unplayed/ }).click();
  await page.getByRole('button', { name: 'Review scorecard' }).click();
  await expect(page.getByRole('heading', { name: 'Scorecard review' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hole 1/ })).toContainText(/SI \d+/);
  await expect(page.getByRole('button', { name: /Hole 1/ })).toContainText(/meters|yards/);
  await assertNoHorizontalOverflow('review metadata state');
  await page.screenshot({ path: path.join(screenshotDir, 'scoring-context-review-320.png'), fullPage: true });

  await browser.close();
  console.log(JSON.stringify({
    activeUnplayed: true,
    activeEven: true,
    activeOverPar: true,
    reviewMetadata: true,
    logs
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@ | node
```

Expected JSON:

```json
{
  "activeUnplayed": true,
  "activeEven": true,
  "activeOverPar": true,
  "reviewMetadata": true,
  "logs": []
}
```

Expected screenshots:

- `C:\tmp\scoring-context-unplayed-320.png`
- `C:\tmp\scoring-context-over-par-320.png`
- `C:\tmp\scoring-context-review-320.png`

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
git diff --stat origin/main..HEAD
git diff --check origin/main..HEAD
git status --short --branch
```

Expected:

- Diff includes the approved spec commit, this implementation plan commit, and implementation commits.
- No whitespace errors.
- No staged files.
- Only intentional files are modified.

- [ ] **Step 6: Request final code review**

Use `superpowers:requesting-code-review` with this review brief:

```text
Review scoring context polish implementation.

Focus on:
- active-hole context labels exactly match the approved copy
- unplayed holes still display 0 but are not stored as 0
- no scoring model, persistence, resume, abandon, history, provider, or completion behavior changes
- review metadata comes from round.courseSnapshot.holes
- review metadata stays compact and does not create nested interactive controls
- 320px active scoring and review layouts do not overflow or overlap
```

- [ ] **Step 7: Apply review fixes if required**

If review finds Critical or Important issues, fix them with TDD:

1. Add or update the focused failing test.
2. Run the focused test and verify it fails for the expected reason.
3. Implement the smallest fix.
4. Rerun the focused test and verify it passes.
5. Rerun:

```powershell
npm test -- --run
npm run build
npm run e2e
```

Expected: all commands pass after any review fixes.

- [ ] **Step 8: Confirm final branch status**

Run:

```powershell
git log --oneline --decorate origin/main..HEAD
git status --short --branch
```

Expected:

- Branch is ahead of `origin/main`.
- Intentional commits appear after `origin/main`.
- No implementation changes remain unstaged.

---

## Implementation Notes

- Use `selectedScore?.strokes`, not `displayStrokes`, to distinguish an unplayed hole from a real score of `0`. The domain does not store `0`; this preserves the approved storage behavior.
- The active-hole context is display-only. It must not feed into totals, completion checks, resume targeting, or persistence.
- The review metadata should read from `round.courseSnapshot.holes` so prior rounds stay historically accurate after custom course edits.
- Keep `HoleScoreEntry` presentational. It should receive `scoreContext` and render it; it should not know about round totals or score storage.
- Keep review cards as one button per hole. Do not add nested buttons or links inside a review card.
