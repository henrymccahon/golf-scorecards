# Golf Scorecard App V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA where a single golfer can find or create a course scorecard, start an autosaved round, enter strokes, finish the round, and review completed rounds.

**Architecture:** Use a React + TypeScript + Vite app with a strict split between domain logic, local storage, and UI components. Courses remain editable records; rounds store scorecard snapshots so completed and in-progress rounds are not changed by course edits.

**Tech Stack:** React 18, TypeScript 5, Vite, Vitest, React Testing Library, Playwright, browser `localStorage`, CSS modules or plain CSS.

## Global Constraints

- V1 is a mobile-first progressive web app.
- V1 is local-first and must not require sign-in, cloud sync, or a backend.
- V1 supports one primary player only.
- V1 supports seeded sample courses and user-created custom courses.
- V1 supports both 9-hole and 18-hole scorecards.
- Course holes store required par, optional stroke index, and optional tee distance.
- V1 scoring requires strokes only in the UI.
- In-progress rounds autosave and can be resumed after reload.
- Round creation must copy a course snapshot into the round.
- Editing a course must not mutate existing round snapshots.
- Completed rounds appear in history.
- Do not build external course import, monetisation, account settings, multi-player scoring, handicap scoring, or detailed stats in V1.
- Current workspace note: normal `.git` metadata is permission-blocked, so commit commands below use `git --git-dir='work\\golf-scorecard-design.git' --work-tree='.'`.

---

## File Structure

Create a Vite React app in the workspace root. Keep implementation files focused:

- `package.json`: scripts and dependencies.
- `index.html`: app mount point.
- `vite.config.ts`: Vite, Vitest, and React plugin configuration.
- `tsconfig.json`: TypeScript settings.
- `playwright.config.ts`: browser workflow test configuration.
- `public/manifest.webmanifest`: PWA manifest.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: top-level app state and screen routing.
- `src/styles.css`: mobile-first app styles.
- `src/domain/types.ts`: shared domain types.
- `src/domain/courses.ts`: course validation and course totals.
- `src/domain/courses.test.ts`: course domain tests.
- `src/domain/rounds.ts`: round creation, score updates, completion, and totals.
- `src/domain/rounds.test.ts`: round domain tests.
- `src/data/seedCourses.ts`: built-in sample courses.
- `src/storage/localStore.ts`: local persistence adapter.
- `src/storage/localStore.test.ts`: storage tests with a fake `Storage` object.
- `src/components/BottomNav.tsx`: Play/Courses/History navigation.
- `src/components/CourseList.tsx`: searchable course list and resume prompt.
- `src/components/CourseDetail.tsx`: selected scorecard detail.
- `src/components/CourseForm.tsx`: custom course create/edit form.
- `src/components/ActiveRound.tsx`: score entry workflow.
- `src/components/RoundSummary.tsx`: completed round summary.
- `src/components/RoundHistory.tsx`: completed round list.
- `src/test/setup.ts`: Vitest DOM matcher setup.
- `src/test/render.tsx`: React Testing Library helper.
- `src/App.test.tsx`: app-level workflow component tests.
- `e2e/score-round.spec.ts`: Playwright smoke test.

---

### Task 1: Project Scaffold And Course Domain

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `playwright.config.ts`
- Create: `public/manifest.webmanifest`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/domain/types.ts`
- Create: `src/domain/courses.ts`
- Create: `src/domain/courses.test.ts`
- Create: `src/data/seedCourses.ts`
- Create: `src/test/setup.ts`

**Interfaces:**
- Produces: `Course`, `Hole`, `CourseSource`, `HoleCount`, `TeeDistanceUnit` types from `src/domain/types.ts`.
- Produces: `validateCourse(course: Course): string[]`.
- Produces: `calculateCoursePar(course: Course): number`.
- Produces: `getCourseSearchText(course: Course): string`.
- Produces: `seedCourses: Course[]`.

- [ ] **Step 1: Create project config and installable package metadata**

Create `package.json` with this content:

```json
{
  "name": "golf-scorecard-pwa",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "typescript": "^5.5.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.3",
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^24.1.1",
    "vitest": "^2.0.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "playwright.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] }
    }
  ]
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#174A3C" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>Golf Scorecard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `public/manifest.webmanifest`:

```json
{
  "name": "Golf Scorecard",
  "short_name": "Scorecard",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F7F4EA",
  "theme_color": "#174A3C",
  "icons": []
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: npm creates `package-lock.json` and installs the packages listed in `package.json`. If network is blocked, request network permission and rerun the same command.

- [ ] **Step 3: Write failing course domain tests**

Create `src/domain/courses.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateCoursePar, getCourseSearchText, validateCourse } from './courses';
import type { Course } from './types';

const validNine: Course = {
  id: 'course-nine',
  name: 'Lakeview Nine',
  source: 'custom',
  holeCount: 9,
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
  holes: Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    par: index === 1 ? 5 : index === 4 ? 3 : 4,
    strokeIndex: index + 1,
    teeDistance: 300 + index * 10,
    teeDistanceUnit: 'meters'
  }))
};

describe('course domain', () => {
  it('accepts a complete 9-hole course', () => {
    expect(validateCourse(validNine)).toEqual([]);
    expect(calculateCoursePar(validNine)).toBe(36);
  });

  it('rejects missing names, wrong hole counts, duplicate stroke indexes, and invalid distances', () => {
    const course: Course = {
      ...validNine,
      name: ' ',
      holeCount: 18,
      holes: [
        { number: 1, par: 0, strokeIndex: 1, teeDistance: -20, teeDistanceUnit: 'meters' },
        { number: 2, par: 4, strokeIndex: 1 }
      ]
    };

    expect(validateCourse(course)).toEqual([
      'Course name is required.',
      'Course must contain exactly 18 holes.',
      'Hole 1 must have a positive par value.',
      'Hole 1 tee distance must be a positive number.',
      'Stroke index 1 is used more than once.'
    ]);
  });

  it('builds searchable text from course name and source', () => {
    expect(getCourseSearchText(validNine)).toBe('lakeview nine custom 9');
  });
});
```

- [ ] **Step 4: Run the course tests and verify they fail**

Run:

```bash
npm test -- --run src/domain/courses.test.ts
```

Expected: FAIL because `src/domain/courses.ts` and `src/domain/types.ts` do not exist yet.

- [ ] **Step 5: Implement course types, validation, seed data, and app shell**

Create `src/domain/types.ts`:

```ts
export type CourseSource = 'seeded' | 'custom' | 'imported';
export type HoleCount = 9 | 18;
export type TeeDistanceUnit = 'meters' | 'yards';

export interface Hole {
  number: number;
  par: number;
  strokeIndex?: number;
  teeDistance?: number;
  teeDistanceUnit?: TeeDistanceUnit;
}

export interface Course {
  id: string;
  name: string;
  source: CourseSource;
  holeCount: HoleCount;
  holes: Hole[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseSnapshot {
  id: string;
  name: string;
  source: CourseSource;
  holeCount: HoleCount;
  holes: Hole[];
}

export type RoundStatus = 'in_progress' | 'completed';

export interface ScoreEntry {
  holeNumber: number;
  strokes?: number;
  putts?: number;
  penalties?: number;
  fairwayHit?: boolean;
  greenInRegulation?: boolean;
}

export interface Round {
  id: string;
  status: RoundStatus;
  courseId?: string;
  courseSnapshot: CourseSnapshot;
  startedAt: string;
  completedAt?: string;
  player: string;
  scores: ScoreEntry[];
}
```

Create `src/domain/courses.ts`:

```ts
import type { Course } from './types';

export function calculateCoursePar(course: Course): number {
  return course.holes.reduce((total, hole) => total + hole.par, 0);
}

export function getCourseSearchText(course: Course): string {
  return `${course.name} ${course.source} ${course.holeCount}`.toLowerCase();
}

export function validateCourse(course: Course): string[] {
  const errors: string[] = [];

  if (course.name.trim().length === 0) {
    errors.push('Course name is required.');
  }

  if (course.holes.length !== course.holeCount) {
    errors.push(`Course must contain exactly ${course.holeCount} holes.`);
  }

  const seenStrokeIndexes = new Map<number, number>();

  for (const hole of course.holes) {
    if (!Number.isInteger(hole.par) || hole.par <= 0) {
      errors.push(`Hole ${hole.number} must have a positive par value.`);
    }

    if (hole.strokeIndex !== undefined) {
      if (!Number.isInteger(hole.strokeIndex) || hole.strokeIndex <= 0) {
        errors.push(`Hole ${hole.number} stroke index must be a positive integer.`);
      } else {
        const priorHole = seenStrokeIndexes.get(hole.strokeIndex);
        if (priorHole !== undefined) {
          errors.push(`Stroke index ${hole.strokeIndex} is used more than once.`);
        }
        seenStrokeIndexes.set(hole.strokeIndex, hole.number);
      }
    }

    if (hole.teeDistance !== undefined && (!Number.isFinite(hole.teeDistance) || hole.teeDistance <= 0)) {
      errors.push(`Hole ${hole.number} tee distance must be a positive number.`);
    }
  }

  return errors;
}
```

Create `src/data/seedCourses.ts`:

```ts
import type { Course } from '../domain/types';

export const seedCourses: Course[] = [
  {
    id: 'seed-lakeview-nine',
    name: 'Lakeview Nine',
    source: 'seeded',
    holeCount: 9,
    holes: [
      { number: 1, par: 4, strokeIndex: 5, teeDistance: 322, teeDistanceUnit: 'meters' },
      { number: 2, par: 5, strokeIndex: 1, teeDistance: 475, teeDistanceUnit: 'meters' },
      { number: 3, par: 4, strokeIndex: 7, teeDistance: 331, teeDistanceUnit: 'meters' },
      { number: 4, par: 4, strokeIndex: 3, teeDistance: 360, teeDistanceUnit: 'meters' },
      { number: 5, par: 3, strokeIndex: 9, teeDistance: 145, teeDistanceUnit: 'meters' },
      { number: 6, par: 4, strokeIndex: 4, teeDistance: 342, teeDistanceUnit: 'meters' },
      { number: 7, par: 3, strokeIndex: 8, teeDistance: 158, teeDistanceUnit: 'meters' },
      { number: 8, par: 5, strokeIndex: 2, teeDistance: 492, teeDistanceUnit: 'meters' },
      { number: 9, par: 4, strokeIndex: 6, teeDistance: 350, teeDistanceUnit: 'meters' }
    ]
  },
  {
    id: 'seed-parklands-championship',
    name: 'Parklands Championship',
    source: 'seeded',
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => ({
      number: index + 1,
      par: [4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4][index],
      strokeIndex: [7, 1, 9, 17, 5, 11, 3, 15, 13, 8, 10, 2, 18, 6, 12, 4, 16, 14][index],
      teeDistance: [356, 501, 338, 154, 372, 344, 486, 162, 351, 360, 333, 510, 142, 378, 347, 498, 155, 364][index],
      teeDistanceUnit: 'meters'
    }))
  }
];
```

Create `src/main.tsx`, `src/App.tsx`, and `src/styles.css` as a minimal compiling shell:

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```tsx
// src/App.tsx
import { seedCourses } from './data/seedCourses';

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Golf Scorecard</p>
        <h1>Start a round</h1>
      </header>
      <section className="panel">
        <h2>Seeded courses</h2>
        <ul className="plain-list">
          {seedCourses.map((course) => (
            <li key={course.id}>{course.name}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

```css
/* src/styles.css */
:root {
  color: #17362f;
  background: #f7f4ea;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 16px 92px;
}

.app-header {
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #5f6f68;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

.panel {
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fffdf7;
  padding: 16px;
}

.plain-list {
  margin: 0;
  padding-left: 18px;
}
```

- [ ] **Step 6: Create test setup file**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Run tests and build**

Run:

```bash
npm test -- --run src/domain/courses.test.ts
npm run build
```

Expected: both commands PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add package.json package-lock.json index.html vite.config.ts tsconfig.json playwright.config.ts public src
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: scaffold scorecard app and course domain"
```

Expected: commit succeeds and includes only the scaffold, course domain, seed data, and tests.

---

### Task 2: Round Domain And Local Persistence

**Files:**
- Create: `src/domain/rounds.ts`
- Create: `src/domain/rounds.test.ts`
- Create: `src/storage/localStore.ts`
- Create: `src/storage/localStore.test.ts`

**Interfaces:**
- Consumes: `Course`, `Round`, `ScoreEntry` from `src/domain/types.ts`.
- Produces: `createRoundFromCourse(course: Course, options: { id: string; startedAt: string; player?: string }): Round`.
- Produces: `setHoleStrokes(round: Round, holeNumber: number, strokes: number | undefined): Round`.
- Produces: `getRoundTotals(round: Round): RoundTotals`.
- Produces: `canCompleteRound(round: Round): boolean`.
- Produces: `completeRound(round: Round, completedAt: string): Round`.
- Produces: `createLocalScorecardStore(storage: Storage, key?: string): ScorecardStore`.

- [ ] **Step 1: Write failing round tests**

Create `src/domain/rounds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRoundFromCourse, completeRound, getRoundTotals, setHoleStrokes } from './rounds';
import type { Course } from './types';

const course: Course = {
  id: 'course-1',
  name: 'Test Links',
  source: 'custom',
  holeCount: 9,
  holes: Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    par: index === 0 ? 5 : 4,
    strokeIndex: index + 1
  }))
};

describe('round domain', () => {
  it('creates a round with a scorecard snapshot', () => {
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });

    expect(round.status).toBe('in_progress');
    expect(round.courseSnapshot.name).toBe('Test Links');
    expect(round.scores).toHaveLength(9);

    course.holes[0].par = 3;
    expect(round.courseSnapshot.holes[0].par).toBe(5);
  });

  it('calculates running totals against completed holes only', () => {
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });
    const updated = setHoleStrokes(setHoleStrokes(round, 1, 6), 2, 4);

    expect(getRoundTotals(updated)).toEqual({
      completedHoles: 2,
      totalStrokes: 10,
      playedPar: 9,
      scoreToPar: 1,
      totalPar: 37,
      frontNineStrokes: 10,
      frontNinePar: 9,
      backNineStrokes: 0,
      backNinePar: 0
    });
  });

  it('rejects invalid strokes and incomplete completion', () => {
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });

    expect(() => setHoleStrokes(round, 1, 0)).toThrow('Strokes must be a positive integer.');
    expect(() => completeRound(round, '2026-07-17T03:00:00.000Z')).toThrow('Every hole needs a valid stroke value before the round can be completed.');
  });
});
```

- [ ] **Step 2: Run round tests and verify they fail**

Run:

```bash
npm test -- --run src/domain/rounds.test.ts
```

Expected: FAIL because `src/domain/rounds.ts` does not exist yet.

- [ ] **Step 3: Implement round domain logic**

Create `src/domain/rounds.ts`:

```ts
import type { Course, Round } from './types';

export interface RoundTotals {
  completedHoles: number;
  totalStrokes: number;
  playedPar: number;
  scoreToPar: number;
  totalPar: number;
  frontNineStrokes: number;
  frontNinePar: number;
  backNineStrokes: number;
  backNinePar: number;
}

export function createRoundFromCourse(
  course: Course,
  options: { id: string; startedAt: string; player?: string }
): Round {
  return {
    id: options.id,
    status: 'in_progress',
    courseId: course.id,
    courseSnapshot: {
      id: course.id,
      name: course.name,
      source: course.source,
      holeCount: course.holeCount,
      holes: course.holes.map((hole) => ({ ...hole }))
    },
    startedAt: options.startedAt,
    player: options.player ?? 'Player',
    scores: course.holes.map((hole) => ({ holeNumber: hole.number }))
  };
}

export function setHoleStrokes(round: Round, holeNumber: number, strokes: number | undefined): Round {
  if (!round.scores.some((score) => score.holeNumber === holeNumber)) {
    throw new Error(`Hole ${holeNumber} does not exist in this round.`);
  }

  if (strokes !== undefined && (!Number.isInteger(strokes) || strokes <= 0)) {
    throw new Error('Strokes must be a positive integer.');
  }

  return {
    ...round,
    scores: round.scores.map((score) =>
      score.holeNumber === holeNumber ? { ...score, strokes } : score
    )
  };
}

export function getRoundTotals(round: Round): RoundTotals {
  const completedScores = round.scores.filter((score) => Number.isInteger(score.strokes) && score.strokes! > 0);
  const holeByNumber = new Map(round.courseSnapshot.holes.map((hole) => [hole.number, hole]));

  const totalPar = round.courseSnapshot.holes.reduce((sum, hole) => sum + hole.par, 0);
  const totalStrokes = completedScores.reduce((sum, score) => sum + score.strokes!, 0);
  const playedPar = completedScores.reduce((sum, score) => sum + (holeByNumber.get(score.holeNumber)?.par ?? 0), 0);

  const frontScores = completedScores.filter((score) => score.holeNumber <= 9);
  const backScores = completedScores.filter((score) => score.holeNumber > 9);

  return {
    completedHoles: completedScores.length,
    totalStrokes,
    playedPar,
    scoreToPar: totalStrokes - playedPar,
    totalPar,
    frontNineStrokes: frontScores.reduce((sum, score) => sum + score.strokes!, 0),
    frontNinePar: frontScores.reduce((sum, score) => sum + (holeByNumber.get(score.holeNumber)?.par ?? 0), 0),
    backNineStrokes: backScores.reduce((sum, score) => sum + score.strokes!, 0),
    backNinePar: backScores.reduce((sum, score) => sum + (holeByNumber.get(score.holeNumber)?.par ?? 0), 0)
  };
}

export function canCompleteRound(round: Round): boolean {
  return round.scores.length === round.courseSnapshot.holeCount &&
    round.scores.every((score) => Number.isInteger(score.strokes) && score.strokes! > 0);
}

export function completeRound(round: Round, completedAt: string): Round {
  if (!canCompleteRound(round)) {
    throw new Error('Every hole needs a valid stroke value before the round can be completed.');
  }

  return {
    ...round,
    status: 'completed',
    completedAt
  };
}
```

- [ ] **Step 4: Write failing local storage tests**

Create `src/storage/localStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLocalScorecardStore } from './localStore';
import type { Course, Round } from '../domain/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const course: Course = {
  id: 'course-1',
  name: 'Local Course',
  source: 'custom',
  holeCount: 9,
  holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 }))
};

const round: Round = {
  id: 'round-1',
  status: 'in_progress',
  courseId: 'course-1',
  courseSnapshot: { id: 'course-1', name: 'Local Course', source: 'custom', holeCount: 9, holes: course.holes },
  startedAt: '2026-07-17T01:00:00.000Z',
  player: 'Player',
  scores: Array.from({ length: 9 }, (_, index) => ({ holeNumber: index + 1 }))
};

describe('local scorecard store', () => {
  it('saves and loads custom courses and rounds', () => {
    const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

    store.save({ customCourses: [course], rounds: [round] });

    expect(store.load()).toEqual({ customCourses: [course], rounds: [round] });
  });

  it('returns empty data when no prior state exists', () => {
    const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

    expect(store.load()).toEqual({ customCourses: [], rounds: [] });
  });
});
```

- [ ] **Step 5: Run storage tests and verify they fail**

Run:

```bash
npm test -- --run src/storage/localStore.test.ts
```

Expected: FAIL because `src/storage/localStore.ts` does not exist yet.

- [ ] **Step 6: Implement local storage adapter**

Create `src/storage/localStore.ts`:

```ts
import type { Course, Round } from '../domain/types';

export interface ScorecardData {
  customCourses: Course[];
  rounds: Round[];
}

export interface ScorecardStore {
  load(): ScorecardData;
  save(data: ScorecardData): void;
}

const emptyData: ScorecardData = {
  customCourses: [],
  rounds: []
};

export function createLocalScorecardStore(
  storage: Storage,
  key = 'golf-scorecard-v1'
): ScorecardStore {
  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) {
        return emptyData;
      }

      const parsed = JSON.parse(raw) as Partial<ScorecardData>;
      return {
        customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
        rounds: Array.isArray(parsed.rounds) ? parsed.rounds : []
      };
    },
    save(data) {
      storage.setItem(key, JSON.stringify(data));
    }
  };
}
```

- [ ] **Step 7: Run domain and storage tests**

Run:

```bash
npm test -- --run src/domain/courses.test.ts src/domain/rounds.test.ts src/storage/localStore.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/domain src/storage
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add round domain and local persistence"
```

Expected: commit succeeds.

---

### Task 3: Course Search And Custom Course UI

**Files:**
- Create: `src/components/BottomNav.tsx`
- Create: `src/components/CourseList.tsx`
- Create: `src/components/CourseDetail.tsx`
- Create: `src/components/CourseForm.tsx`
- Create: `src/test/render.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/App.test.tsx`

**Interfaces:**
- Consumes: `seedCourses`, `validateCourse`, `calculateCoursePar`, `createLocalScorecardStore`.
- Produces UI flows for Play, Courses, course detail, and custom course creation.
- Produces accessible labels used by tests: `Search courses`, `Create course`, `Course name`, `Save course`, `Start round`.

- [ ] **Step 1: Write failing app tests for course search and custom creation**

Create `src/test/render.tsx`:

```tsx
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderApp(ui: ReactElement) {
  localStorage.clear();
  return render(ui);
}

export function renderAppWithExistingStorage(ui: ReactElement) {
  return render(ui);
}
```

Create `src/App.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { renderApp, renderAppWithExistingStorage } from './test/render';

describe('App course flows', () => {
  it('searches seeded courses', async () => {
    renderApp(<App />);
    await userEvent.type(screen.getByLabelText('Search courses'), 'Parklands');
    expect(screen.getByText('Parklands Championship')).toBeInTheDocument();
    expect(screen.queryByText('Lakeview Nine')).not.toBeInTheDocument();
  });

  it('creates a custom 9-hole course and shows it in the course list', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
    await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');

    for (let hole = 1; hole <= 9; hole += 1) {
      await userEvent.clear(screen.getByLabelText(`Hole ${hole} par`));
      await userEvent.type(screen.getByLabelText(`Hole ${hole} par`), hole === 3 ? '3' : '4');
    }

    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    expect(screen.getByText('Saturday Nine')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run app tests and verify they fail**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because the app shell does not yet expose search, navigation, or course creation controls.

- [ ] **Step 3: Implement navigation and course components**

Create `src/components/BottomNav.tsx`:

```tsx
import { BookOpen, History, Play } from 'lucide-react';

export type AppTab = 'play' | 'courses' | 'history';

interface BottomNavProps {
  activeTab: AppTab;
  onSelect(tab: AppTab): void;
}

export function BottomNav({ activeTab, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button className={activeTab === 'play' ? 'active' : ''} onClick={() => onSelect('play')}>
        <Play size={18} /> Play
      </button>
      <button className={activeTab === 'courses' ? 'active' : ''} onClick={() => onSelect('courses')}>
        <BookOpen size={18} /> Courses
      </button>
      <button className={activeTab === 'history' ? 'active' : ''} onClick={() => onSelect('history')}>
        <History size={18} /> History
      </button>
    </nav>
  );
}
```

Create `src/components/CourseList.tsx`:

```tsx
import type { Course, Round } from '../domain/types';
import { calculateCoursePar, getCourseSearchText } from '../domain/courses';

interface CourseListProps {
  courses: Course[];
  query: string;
  inProgressRound?: Round;
  onQueryChange(query: string): void;
  onSelectCourse(courseId: string): void;
  onResumeRound(roundId: string): void;
}

export function CourseList({ courses, query, inProgressRound, onQueryChange, onSelectCourse, onResumeRound }: CourseListProps) {
  const filteredCourses = courses.filter((course) => getCourseSearchText(course).includes(query.trim().toLowerCase()));

  return (
    <section className="screen">
      {inProgressRound && (
        <button className="resume-banner" onClick={() => onResumeRound(inProgressRound.id)}>
          Resume {inProgressRound.courseSnapshot.name}
        </button>
      )}
      <label className="field">
        <span>Search courses</span>
        <input
          aria-label="Search courses"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div className="course-list">
        {filteredCourses.map((course) => (
          <button key={course.id} className="course-row" onClick={() => onSelectCourse(course.id)}>
            <span>
              <strong>{course.name}</strong>
              <small>{course.holeCount} holes · Par {calculateCoursePar(course)} · {course.source}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

Create `src/components/CourseDetail.tsx`:

```tsx
import type { Course } from '../domain/types';
import { calculateCoursePar } from '../domain/courses';

interface CourseDetailProps {
  course: Course;
  onBack(): void;
  onStartRound(courseId: string): void;
  onEditCourse(courseId: string): void;
}

export function CourseDetail({ course, onBack, onStartRound, onEditCourse }: CourseDetailProps) {
  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{course.name}</h1>
        <p>{course.holeCount} holes · Par {calculateCoursePar(course)} · {course.source}</p>
      </header>
      <div className="scorecard-grid">
        {course.holes.map((hole) => (
          <div key={hole.number} className="hole-card">
            <strong>Hole {hole.number}</strong>
            <span>Par {hole.par}</span>
            {hole.strokeIndex && <span>SI {hole.strokeIndex}</span>}
            {hole.teeDistance && <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span>}
          </div>
        ))}
      </div>
      <button className="primary-button" onClick={() => onStartRound(course.id)}>Start round</button>
      {course.source === 'custom' && (
        <button className="secondary-button" onClick={() => onEditCourse(course.id)}>Edit course</button>
      )}
    </section>
  );
}
```

Create `src/components/CourseForm.tsx` with controlled fields for name, hole count, par, stroke index, and tee distance. The save handler must construct a `Course`, call `validateCourse`, render validation errors in `.error-list`, and call `onSave(course)` only when there are no validation errors. Use deterministic local ids in this format when creating courses: `custom-${Date.now()}`.

The form must use these labels exactly:

```tsx
<label>Course name<input aria-label="Course name" /></label>
<input aria-label={`Hole ${hole.number} par`} />
<input aria-label={`Hole ${hole.number} stroke index`} />
<input aria-label={`Hole ${hole.number} tee distance`} />
```

The save button text must be `Save course`.

- [ ] **Step 4: Wire app state for courses**

Replace `src/App.tsx` with a component that:

- Creates `store = createLocalScorecardStore(window.localStorage)`.
- Loads `{ customCourses, rounds }` once on initial render.
- Combines `seedCourses` and `customCourses` for search.
- Tracks `activeTab`, `query`, `selectedCourseId`, and `editingCourseId`.
- Saves custom courses back to storage after create/edit.
- Renders `CourseList`, `CourseDetail`, `CourseForm`, `BottomNav`, and a temporary history screen with the text `No completed rounds yet.`.

The primary handlers must use these names inside `App.tsx`:

```ts
function saveCustomCourse(course: Course): void
function selectCourse(courseId: string): void
function editCourse(courseId: string): void
```

- [ ] **Step 5: Extend mobile styles**

Modify `src/styles.css` to include classes used by components:

```css
.screen {
  display: grid;
  gap: 16px;
}

.screen-header p {
  color: #64736c;
}

.field {
  display: grid;
  gap: 6px;
  font-weight: 700;
}

.field input,
.field select,
.hole-form input,
.hole-form select {
  width: 100%;
  min-height: 44px;
  border: 1px solid #cfc6b4;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fffdf7;
}

.course-list,
.scorecard-grid,
.form-grid {
  display: grid;
  gap: 10px;
}

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

.course-row small {
  display: block;
  color: #64736c;
  margin-top: 4px;
}

.primary-button,
.secondary-button,
.text-button {
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 10px 14px;
  font-weight: 800;
}

.primary-button {
  background: #174a3c;
  color: #ffffff;
}

.secondary-button {
  background: #ffffff;
  color: #174a3c;
  border-color: #174a3c;
}

.text-button {
  background: transparent;
  color: #174a3c;
  justify-self: start;
}

.bottom-nav {
  position: fixed;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  width: min(520px, calc(100% - 24px));
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  border: 1px solid #d8d0bf;
  border-radius: 12px;
  background: #fffdf7;
  padding: 8px;
  box-shadow: 0 10px 30px rgba(23, 54, 47, 0.16);
}

.bottom-nav button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #465750;
  font-weight: 800;
}

.bottom-nav button.active {
  background: #e4efe8;
  color: #174a3c;
}

.error-list {
  color: #9d2f26;
  margin: 0;
}
```

- [ ] **Step 6: Run app tests**

Run:

```bash
npm test -- --run src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts src/storage/localStore.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add course search and custom course UI"
```

Expected: commit succeeds.

---

### Task 4: Active Round, Autosave, Summary, And History

**Files:**
- Create: `src/components/ActiveRound.tsx`
- Create: `src/components/RoundSummary.tsx`
- Create: `src/components/RoundHistory.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `createRoundFromCourse`, `setHoleStrokes`, `getRoundTotals`, `completeRound`.
- Produces UI labels: `Hole 1 strokes`, `Finish round`, `Round history`.
- Produces app behavior: start round, autosave each stroke edit, resume in-progress round, complete round, show completed round in history.

- [ ] **Step 1: Add failing tests for the scoring workflow**

Append these tests to `src/App.test.tsx`:

```tsx
it('starts a seeded course round, records strokes, finishes it, and shows history', async () => {
  renderApp(<App />);

  await userEvent.click(screen.getByText('Lakeview Nine'));
  await userEvent.click(screen.getByRole('button', { name: 'Start round' }));

  for (let hole = 1; hole <= 9; hole += 1) {
    await userEvent.clear(screen.getByLabelText(`Hole ${hole} strokes`));
    await userEvent.type(screen.getByLabelText(`Hole ${hole} strokes`), '4');
  }

  await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));
  expect(screen.getByText('Total 36')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByText('Lakeview Nine')).toBeInTheDocument();
  expect(screen.getByText(/Total 36/)).toBeInTheDocument();
});

it('resumes an in-progress autosaved round after remount', async () => {
  const firstRender = renderApp(<App />);

  await userEvent.click(screen.getByText('Lakeview Nine'));
  await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await userEvent.clear(screen.getByLabelText('Hole 1 strokes'));
  await userEvent.type(screen.getByLabelText('Hole 1 strokes'), '5');

  firstRender.unmount();
  renderAppWithExistingStorage(<App />);

  await userEvent.click(screen.getByRole('button', { name: /Resume Lakeview Nine/ }));
  expect(screen.getByLabelText('Hole 1 strokes')).toHaveValue(5);
});
```

- [ ] **Step 2: Run scoring workflow tests and verify they fail**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because active round, summary, and history screens are not implemented.

- [ ] **Step 3: Implement active round component**

Create `src/components/ActiveRound.tsx`:

```tsx
import type { Round } from '../domain/types';
import { canCompleteRound, getRoundTotals } from '../domain/rounds';

interface ActiveRoundProps {
  round: Round;
  onBack(): void;
  onChangeStrokes(holeNumber: number, strokes: number | undefined): void;
  onFinishRound(): void;
}

export function ActiveRound({ round, onBack, onChangeStrokes, onFinishRound }: ActiveRoundProps) {
  const totals = getRoundTotals(round);

  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{round.courseSnapshot.name}</h1>
        <p>{totals.completedHoles}/{round.courseSnapshot.holeCount} holes · Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
      </header>
      <div className="score-entry-list">
        {round.courseSnapshot.holes.map((hole) => {
          const score = round.scores.find((entry) => entry.holeNumber === hole.number);
          return (
            <label key={hole.number} className="score-entry-row">
              <span>
                <strong>Hole {hole.number}</strong>
                <small>Par {hole.par}{hole.strokeIndex ? ` · SI ${hole.strokeIndex}` : ''}</small>
              </span>
              <input
                aria-label={`Hole ${hole.number} strokes`}
                inputMode="numeric"
                type="number"
                min="1"
                value={score?.strokes ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onChangeStrokes(hole.number, value === '' ? undefined : Number(value));
                }}
              />
            </label>
          );
        })}
      </div>
      <button className="primary-button" disabled={!canCompleteRound(round)} onClick={onFinishRound}>
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

- [ ] **Step 4: Implement round summary and history components**

Create `src/components/RoundSummary.tsx`:

```tsx
import type { Round } from '../domain/types';
import { getRoundTotals } from '../domain/rounds';

interface RoundSummaryProps {
  round: Round;
  onBack(): void;
}

export function RoundSummary({ round, onBack }: RoundSummaryProps) {
  const totals = getRoundTotals(round);

  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{round.courseSnapshot.name}</h1>
        <p>Total {totals.totalStrokes} · {totals.scoreToPar === 0 ? 'E' : totals.scoreToPar > 0 ? `+${totals.scoreToPar}` : totals.scoreToPar}</p>
      </header>
      <div className="summary-strip">
        <span>Total {totals.totalStrokes}</span>
        <span>Par {totals.totalPar}</span>
        {round.courseSnapshot.holeCount === 18 && (
          <span>Out {totals.frontNineStrokes} · In {totals.backNineStrokes}</span>
        )}
      </div>
      <div className="scorecard-grid">
        {round.courseSnapshot.holes.map((hole) => {
          const score = round.scores.find((entry) => entry.holeNumber === hole.number);
          return (
            <div key={hole.number} className="hole-card">
              <strong>Hole {hole.number}</strong>
              <span>Par {hole.par}</span>
              <span>{score?.strokes ?? '-'} strokes</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

Create `src/components/RoundHistory.tsx`:

```tsx
import type { Round } from '../domain/types';
import { getRoundTotals } from '../domain/rounds';

interface RoundHistoryProps {
  rounds: Round[];
  onOpenRound(roundId: string): void;
}

export function RoundHistory({ rounds, onOpenRound }: RoundHistoryProps) {
  const completedRounds = rounds.filter((round) => round.status === 'completed');

  return (
    <section className="screen" aria-label="Round history">
      <header className="screen-header">
        <h1>Round history</h1>
      </header>
      {completedRounds.length === 0 ? (
        <p>No completed rounds yet.</p>
      ) : (
        <div className="course-list">
          {completedRounds.map((round) => {
            const totals = getRoundTotals(round);
            return (
              <button key={round.id} className="course-row" onClick={() => onOpenRound(round.id)}>
                <strong>{round.courseSnapshot.name}</strong>
                <small>Total {totals.totalStrokes} · {new Date(round.completedAt ?? round.startedAt).toLocaleDateString()}</small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Wire round state in App**

Modify `src/App.tsx` so it:

- Stores `rounds` in state.
- Persists `{ customCourses, rounds }` after any round change.
- Implements `startRound(courseId: string): void`.
- Implements `changeRoundStrokes(roundId: string, holeNumber: number, strokes: number | undefined): void`.
- Implements `finishRound(roundId: string): void`.
- Shows `ActiveRound` when a round is selected.
- Shows `RoundSummary` after finishing or opening a completed round.
- Shows `RoundHistory` in the History tab.
- Passes the first in-progress round into `CourseList` for resume.

Use ids in this format:

```ts
const id = `round-${Date.now()}`;
```

When storage operations throw, set a visible message with this exact text:

```ts
'Scores cannot be saved on this device right now.'
```

- [ ] **Step 6: Add active round styles**

Append to `src/styles.css`:

```css
.score-entry-list {
  display: grid;
  gap: 10px;
}

.score-entry-row {
  display: grid;
  grid-template-columns: 1fr 88px;
  align-items: center;
  gap: 12px;
  border: 1px solid #d8d0bf;
  border-radius: 8px;
  background: #fffdf7;
  padding: 12px;
}

.score-entry-row small {
  display: block;
  color: #64736c;
  margin-top: 3px;
}

.score-entry-row input {
  width: 100%;
  min-height: 44px;
  border: 1px solid #cfc6b4;
  border-radius: 8px;
  padding: 8px;
  text-align: center;
}

.primary-button:disabled {
  opacity: 0.55;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.summary-strip span {
  border-radius: 8px;
  background: #e4efe8;
  padding: 12px;
  font-weight: 800;
}
```

- [ ] **Step 7: Run all component and domain tests**

Run:

```bash
npm test -- --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add autosaved scoring workflow and history"
```

Expected: commit succeeds.

---

### Task 5: End-To-End Workflow, Build Verification, And Mobile Polish

**Files:**
- Create: `e2e/score-round.spec.ts`
- Modify: `src/styles.css`
- Modify: `public/manifest.webmanifest` only if icons or display fields need correction after build verification.

**Interfaces:**
- Consumes complete app workflow from Tasks 1-4.
- Produces browser-level proof that a user can search, start, score, finish, and review a round.

- [ ] **Step 1: Write failing Playwright workflow test**

Create `e2e/score-round.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('mobile user scores a seeded 9-hole round', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search courses').fill('Lakeview');
  await page.getByText('Lakeview Nine').click();
  await page.getByRole('button', { name: 'Start round' }).click();

  for (let hole = 1; hole <= 9; hole += 1) {
    await page.getByLabel(`Hole ${hole} strokes`).fill('4');
  }

  await page.getByRole('button', { name: 'Finish round' }).click();
  await expect(page.getByText('Total 36')).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByLabel('Round history')).toContainText('Lakeview Nine');
  await expect(page.getByLabel('Round history')).toContainText('Total 36');
});
```

- [ ] **Step 2: Run Playwright test and verify current behavior**

Run:

```bash
npm run e2e
```

Expected: PASS if Tasks 1-4 are complete. If browser binaries are missing, run `npx playwright install chromium` and rerun `npm run e2e`.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and Vite writes production assets to `dist/`.

- [ ] **Step 4: Verify mobile layout manually**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173` in a mobile-sized browser viewport. Verify:

- Search input is visible without horizontal scrolling.
- Bottom navigation fits at 320px width.
- Score entry rows keep labels and numeric inputs readable.
- The Finish round button remains reachable after entering scores.
- Round history rows do not overlap text.

- [ ] **Step 5: Apply mobile layout fixes if verification exposes overlap**

If any item from Step 4 fails, change only `src/styles.css`. Use these constraints:

```css
@media (max-width: 380px) {
  .app-shell {
    padding-left: 12px;
    padding-right: 12px;
  }

  .score-entry-row {
    grid-template-columns: 1fr 72px;
  }

  .bottom-nav {
    width: calc(100% - 16px);
    gap: 4px;
  }

  .bottom-nav button {
    font-size: 0.82rem;
  }
}
```

- [ ] **Step 6: Rerun full verification**

Run:

```bash
npm test -- --run
npm run build
npm run e2e
```

Expected: all commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add e2e src public package.json package-lock.json playwright.config.ts
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "test: verify mobile scoring workflow"
```

Expected: commit succeeds.

---

## Self-Review Notes

- Spec coverage: tasks cover seeded/custom courses, 9/18-hole support, par/stroke index/tee distance, strokes-only scoring, round snapshots, autosave/resume, completion, history, validation, local-first storage, and PWA build verification.
- Scope check: native mobile, backend sync, external course lookup, multi-player scoring, handicap scoring, monetisation, and detailed stats are excluded from implementation tasks.
- Type consistency: `Course`, `Hole`, `Round`, `ScoreEntry`, `validateCourse`, `calculateCoursePar`, `createRoundFromCourse`, `setHoleStrokes`, `getRoundTotals`, `completeRound`, and `createLocalScorecardStore` are defined before use by later tasks.
