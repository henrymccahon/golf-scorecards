# Course Search Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the provider-backed course search foundation so users can search provided course scorecards first, save selected provider courses locally, and keep custom courses as a secondary fallback.

**Architecture:** Keep `Course` as the canonical scorecard used by scoring, add provider metadata and provider-facing interfaces, then map deterministic provider data into validated local `Course` records. Migrate persisted courses from `customCourses` to `savedCourses` so custom and provider-loaded courses share the same local storage path while round snapshots remain immutable.

**Tech Stack:** React 18, TypeScript 5, Vite, Vitest, React Testing Library, Playwright, browser `localStorage`, deterministic in-app provider adapter.

## Global Constraints

- Add a clear provider boundary for searching and loading provided course scorecards.
- Keep the current local-first scoring flow working without sign-in or backend infrastructure.
- Cache selected provided courses locally so users can start rounds without re-searching every time.
- Preserve immutable round snapshots exactly as the current app does.
- Support future global providers without hard-coding the product around Australia, the United States, or any single vendor.
- Keep custom course creation available, but make it visually and conceptually secondary.
- Keep the data model ready for provider attribution, country, region, and external IDs.
- Do not add CSV upload or file import in this package.
- Do not build a full global course database.
- Do not claim complete global course coverage.
- Do not require accounts, cloud sync, paid plans, or a backend for this package.
- Do not add course maps, GPS shot tracking, booking, tee times, reviews, or rich course profiles.
- Do not build a complex imported-course management area.
- Do not remove the existing custom course fallback.
- Every provider-loaded course must pass the same `validateCourse(course)` checks before it can be saved or used to start a round.
- Existing stored `customCourses` must load into `savedCourses`.
- Current workspace note: normal `.git` metadata is permission-blocked, so commit commands below use `git --git-dir='work\\golf-scorecard-design.git' --work-tree='.'`.

---

## File Structure

- `src/domain/types.ts`: add provider metadata types and preserve provider metadata in `Course` and `CourseSnapshot`.
- `src/domain/courses.ts`: keep validation logic and make search text include provider geography.
- `src/domain/courses.test.ts`: verify provider metadata search text.
- `src/domain/rounds.ts`: copy provider metadata into round snapshots.
- `src/domain/rounds.test.ts`: verify provider metadata snapshot immutability.
- `src/providers/types.ts`: define provider-facing interfaces.
- `src/providers/providerCourseMapper.ts`: convert raw provider scorecards into validated `Course` records.
- `src/providers/providerCourseMapper.test.ts`: verify mapping, validation, and stable local IDs.
- `src/providers/staticCourseProvider.ts`: deterministic provider adapter used by the app and tests.
- `src/providers/staticCourseProvider.test.ts`: verify search and load behavior.
- `src/storage/localStore.ts`: migrate persisted shape to `savedCourses`.
- `src/storage/localStore.test.ts`: verify new shape, legacy migration, and recovery behavior.
- `src/components/CourseList.tsx`: display local courses, provider results, provider states, and custom fallback.
- `src/components/CourseDetail.tsx`: display provider-friendly source labels while preserving custom edit rules.
- `src/App.tsx`: orchestrate provider search, provider course saving, duplicate detection, and persisted `savedCourses`.
- `src/App.test.tsx`: verify provider search workflows and existing scoring flows.
- `src/styles.css`: add provider result and fallback styles.
- `e2e/score-round.spec.ts`: add browser workflow for a provided course.
- `README.md`: document the provider-search foundation and known coverage limitation.
- `docs/qa/v1-manual-walkthrough.md`: add provided-course smoke test steps.

---

### Task 1: Provider Types, Mapping, And Round Snapshot Metadata

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/courses.ts`
- Modify: `src/domain/courses.test.ts`
- Modify: `src/domain/rounds.ts`
- Modify: `src/domain/rounds.test.ts`
- Create: `src/providers/types.ts`
- Create: `src/providers/providerCourseMapper.ts`
- Create: `src/providers/providerCourseMapper.test.ts`

**Interfaces:**
- Produces: `CourseProviderRef`.
- Produces: `Course.providerRef?: CourseProviderRef`.
- Produces: `CourseSnapshot.providerRef?: CourseProviderRef`.
- Produces: `CourseSearchQuery`, `CourseSearchResult`, `CourseProvider`.
- Produces: `ProviderCourseRecord`, `ProviderHoleRecord`, `ProviderCourseMappingResult`.
- Produces: `createProviderCourseId(providerId: string, externalCourseId: string): string`.
- Produces: `mapProviderCourseToCourse(record: ProviderCourseRecord, fetchedAt?: string): ProviderCourseMappingResult`.
- Consumes: `validateCourse(course: Course): string[]`.

- [ ] **Step 1: Add failing course metadata search test**

Append this test to `src/domain/courses.test.ts`:

```ts
it('includes provider metadata in searchable text', () => {
  const providedCourse: Course = {
    ...validNine,
    id: 'provided-demo-augusta-national',
    name: 'Augusta National',
    source: 'imported',
    providerRef: {
      providerId: 'demo',
      externalCourseId: 'augusta-national',
      providerName: 'Demo Provider',
      country: 'United States',
      region: 'Georgia',
      locality: 'Augusta',
      lastFetchedAt: '2026-07-18T00:00:00.000Z',
      attribution: 'Demo data'
    }
  };

  expect(getCourseSearchText(providedCourse)).toBe(
    'augusta national imported 9 demo provider united states georgia augusta'
  );
});
```

- [ ] **Step 2: Add failing round snapshot metadata test**

Append this test to `src/domain/rounds.test.ts`:

```ts
it('copies provider metadata into the round snapshot', () => {
  const course: Course = {
    id: 'provided-demo-augusta-national',
    name: 'Augusta National',
    source: 'imported',
    holeCount: 9,
    providerRef: {
      providerId: 'demo',
      externalCourseId: 'augusta-national',
      providerName: 'Demo Provider',
      country: 'United States',
      region: 'Georgia',
      locality: 'Augusta',
      lastFetchedAt: '2026-07-18T00:00:00.000Z',
      attribution: 'Demo data'
    },
    holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 }))
  };

  const round = createRoundFromCourse(course, {
    id: 'round-provider',
    startedAt: '2026-07-18T01:00:00.000Z'
  });

  expect(round.courseSnapshot.providerRef).toEqual(course.providerRef);
});
```

- [ ] **Step 3: Create failing provider mapper tests**

Create `src/providers/providerCourseMapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createProviderCourseId, mapProviderCourseToCourse } from './providerCourseMapper';
import type { ProviderCourseRecord } from './providerCourseMapper';

const fetchedAt = '2026-07-18T00:00:00.000Z';

const validRecord: ProviderCourseRecord = {
  providerId: 'demo',
  externalCourseId: 'augusta-national',
  providerName: 'Demo Provider',
  name: 'Augusta National',
  country: 'United States',
  region: 'Georgia',
  locality: 'Augusta',
  attribution: 'Demo data',
  holes: [
    { number: 1, par: 4, teeDistance: 445, teeDistanceUnit: 'yards' },
    { number: 2, par: 5, teeDistance: 585, teeDistanceUnit: 'yards' },
    { number: 3, par: 4, teeDistance: 350, teeDistanceUnit: 'yards' },
    { number: 4, par: 3, teeDistance: 240, teeDistanceUnit: 'yards' },
    { number: 5, par: 4, teeDistance: 495, teeDistanceUnit: 'yards' },
    { number: 6, par: 3, teeDistance: 180, teeDistanceUnit: 'yards' },
    { number: 7, par: 4, teeDistance: 450, teeDistanceUnit: 'yards' },
    { number: 8, par: 5, teeDistance: 570, teeDistanceUnit: 'yards' },
    { number: 9, par: 4, teeDistance: 460, teeDistanceUnit: 'yards' }
  ]
};

describe('provider course mapper', () => {
  it('creates stable local ids from provider identity', () => {
    expect(createProviderCourseId('Demo Provider', 'Augusta National #1')).toBe(
      'provided-demo-provider-augusta-national-1'
    );
  });

  it('maps a valid provider scorecard to an imported course', () => {
    const result = mapProviderCourseToCourse(validRecord, fetchedAt);

    expect(result.errors).toEqual([]);
    expect(result.course).toMatchObject({
      id: 'provided-demo-augusta-national',
      name: 'Augusta National',
      source: 'imported',
      holeCount: 9,
      providerRef: {
        providerId: 'demo',
        externalCourseId: 'augusta-national',
        providerName: 'Demo Provider',
        country: 'United States',
        region: 'Georgia',
        locality: 'Augusta',
        lastFetchedAt: fetchedAt,
        attribution: 'Demo data'
      }
    });
    expect(result.course?.holes).toHaveLength(9);
    expect(result.course?.holes[0]).toEqual({
      number: 1,
      par: 4,
      teeDistance: 445,
      teeDistanceUnit: 'yards'
    });
  });

  it('rejects unsupported provider hole counts before saving', () => {
    const result = mapProviderCourseToCourse({
      ...validRecord,
      holes: validRecord.holes.slice(0, 3)
    }, fetchedAt);

    expect(result.course).toBeUndefined();
    expect(result.errors).toEqual(['Provider course "Augusta National" must contain 9 or 18 holes.']);
  });

  it('rejects provider scorecards that fail course validation', () => {
    const result = mapProviderCourseToCourse({
      ...validRecord,
      holes: validRecord.holes.map((hole, index) => index === 0 ? { ...hole, par: 0 } : hole)
    }, fetchedAt);

    expect(result.course).toBeUndefined();
    expect(result.errors).toContain('Hole 1 must have a positive par value.');
  });
});
```

- [ ] **Step 4: Run failing task tests**

Run:

```powershell
npm test -- --run src/domain/courses.test.ts src/domain/rounds.test.ts src/providers/providerCourseMapper.test.ts
```

Expected: FAIL because provider types, mapper, and snapshot metadata do not exist yet.

- [ ] **Step 5: Add provider metadata to domain types**

Modify `src/domain/types.ts` to add this interface after `TeeDistanceUnit`:

```ts
export interface CourseProviderRef {
  providerId: string;
  externalCourseId: string;
  providerName: string;
  country?: string;
  region?: string;
  locality?: string;
  lastFetchedAt: string;
  attribution?: string;
}
```

Then add `providerRef?: CourseProviderRef;` to both `Course` and `CourseSnapshot`:

```ts
export interface Course {
  id: string;
  name: string;
  source: CourseSource;
  holeCount: HoleCount;
  holes: Hole[];
  providerRef?: CourseProviderRef;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseSnapshot {
  id: string;
  name: string;
  source: CourseSource;
  holeCount: HoleCount;
  holes: Hole[];
  providerRef?: CourseProviderRef;
}
```

- [ ] **Step 6: Extend course search text**

Modify `getCourseSearchText` in `src/domain/courses.ts`:

```ts
export function getCourseSearchText(course: Course): string {
  return [
    course.name,
    course.source,
    String(course.holeCount),
    course.providerRef?.providerName,
    course.providerRef?.country,
    course.providerRef?.region,
    course.providerRef?.locality
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
```

- [ ] **Step 7: Preserve provider metadata in round snapshots**

Modify `createRoundFromCourse` in `src/domain/rounds.ts` so `courseSnapshot` includes `providerRef`:

```ts
    courseSnapshot: {
      id: course.id,
      name: course.name,
      source: course.source,
      holeCount: course.holeCount,
      providerRef: course.providerRef ? { ...course.providerRef } : undefined,
      holes: course.holes.map((hole) => ({ ...hole }))
    },
```

- [ ] **Step 8: Create provider interfaces**

Create `src/providers/types.ts`:

```ts
import type { Course } from '../domain/types';

export interface CourseSearchQuery {
  text: string;
  country?: string;
  region?: string;
}

export interface CourseSearchResult {
  providerId: string;
  externalCourseId: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  holeCount?: 9 | 18;
  hasScorecard: boolean;
}

export interface CourseProvider {
  id: string;
  name: string;
  attribution?: string;
  searchCourses(query: CourseSearchQuery): Promise<CourseSearchResult[]>;
  loadCourse(result: CourseSearchResult): Promise<Course>;
}
```

- [ ] **Step 9: Create provider mapper implementation**

Create `src/providers/providerCourseMapper.ts`:

```ts
import { validateCourse } from '../domain/courses';
import type { Course, Hole, HoleCount, TeeDistanceUnit } from '../domain/types';

export interface ProviderHoleRecord {
  number: number;
  par: number;
  strokeIndex?: number;
  teeDistance?: number;
  teeDistanceUnit?: TeeDistanceUnit;
}

export interface ProviderCourseRecord {
  providerId: string;
  externalCourseId: string;
  providerName: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  attribution?: string;
  holes: ProviderHoleRecord[];
}

export interface ProviderCourseMappingResult {
  course?: Course;
  errors: string[];
}

export function createProviderCourseId(providerId: string, externalCourseId: string): string {
  return `provided-${slugPart(providerId)}-${slugPart(externalCourseId)}`;
}

export function mapProviderCourseToCourse(
  record: ProviderCourseRecord,
  fetchedAt = new Date().toISOString()
): ProviderCourseMappingResult {
  if (record.holes.length !== 9 && record.holes.length !== 18) {
    return {
      errors: [`Provider course "${record.name}" must contain 9 or 18 holes.`]
    };
  }

  const holes: Hole[] = record.holes.map((hole) => ({
    number: hole.number,
    par: hole.par,
    strokeIndex: hole.strokeIndex,
    teeDistance: hole.teeDistance,
    teeDistanceUnit: hole.teeDistanceUnit
  }));

  const course: Course = {
    id: createProviderCourseId(record.providerId, record.externalCourseId),
    name: record.name,
    source: 'imported',
    holeCount: record.holes.length as HoleCount,
    holes,
    providerRef: {
      providerId: record.providerId,
      externalCourseId: record.externalCourseId,
      providerName: record.providerName,
      country: record.country,
      region: record.region,
      locality: record.locality,
      lastFetchedAt: fetchedAt,
      attribution: record.attribution
    }
  };

  const errors = validateCourse(course);
  return errors.length > 0 ? { errors } : { course, errors: [] };
}

function slugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}
```

- [ ] **Step 10: Run task tests**

Run:

```powershell
npm test -- --run src/domain/courses.test.ts src/domain/rounds.test.ts src/providers/providerCourseMapper.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit Task 1**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/domain src/providers
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add provider course mapping foundation"
```

Expected: commit succeeds.

---

### Task 2: Migrate Storage From Custom Courses To Saved Courses

**Files:**
- Modify: `src/storage/localStore.ts`
- Modify: `src/storage/localStore.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Replaces: `ScorecardData.customCourses: Course[]`.
- Produces: `ScorecardData.savedCourses: Course[]`.
- Consumes: `Course.source` values `custom` and `imported` for persisted user-saved courses.
- Preserves: existing storage key `golf-scorecard-v1`.
- Preserves: `createLocalScorecardStore(storage: Storage, key?: string): ScorecardStore`.

- [ ] **Step 1: Update storage tests to the new saved course shape**

In `src/storage/localStore.test.ts`, replace test expectations and save calls that use `customCourses` with `savedCourses`.

The first test should become:

```ts
it('saves and loads saved courses and rounds', () => {
  const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

  store.save({ savedCourses: [course], rounds: [round] });

  expect(store.load()).toEqual({
    data: { savedCourses: [course], rounds: [round] },
    recoveryRequired: false
  });
});
```

The empty-state expectations should use:

```ts
data: { savedCourses: [], rounds: [] }
```

The corrupt-data save assertion should use:

```ts
expect(() => store.save({ savedCourses: [course], rounds: [round] })).toThrow('reset saved data');
```

The reset test save call and expectation should use:

```ts
store.save({ savedCourses: [course], rounds: [round] });

expect(store.load()).toEqual({
  data: { savedCourses: [course], rounds: [round] },
  recoveryRequired: false
});
```

- [ ] **Step 2: Add legacy customCourses migration test**

Append this test to `src/storage/localStore.test.ts`:

```ts
it('migrates legacy customCourses into savedCourses', () => {
  const storage = new MemoryStorage();
  storage.setItem('test-key', JSON.stringify({ customCourses: [course], rounds: [round] }));
  const store = createLocalScorecardStore(storage, 'test-key');

  expect(store.load()).toEqual({
    data: { savedCourses: [course], rounds: [round] },
    recoveryRequired: false
  });
});
```

- [ ] **Step 3: Run failing storage tests**

Run:

```powershell
npm test -- --run src/storage/localStore.test.ts
```

Expected: FAIL because `ScorecardData` still exposes `customCourses`.

- [ ] **Step 4: Update storage data interfaces**

Modify the top of `src/storage/localStore.ts`:

```ts
export interface ScorecardData {
  savedCourses: Course[];
  rounds: Round[];
}
```

Update `createEmptyData()`:

```ts
function createEmptyData(): ScorecardData {
  return {
    savedCourses: [],
    rounds: []
  };
}
```

- [ ] **Step 5: Validate provider metadata in stored courses**

Add this helper near the other type guards in `src/storage/localStore.ts`:

```ts
function isProviderRef(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.providerId !== 'string') return false;
  if (typeof value.externalCourseId !== 'string') return false;
  if (typeof value.providerName !== 'string') return false;
  if (typeof value.lastFetchedAt !== 'string') return false;
  if (!isOptionalString(value.country)) return false;
  if (!isOptionalString(value.region)) return false;
  if (!isOptionalString(value.locality)) return false;
  return isOptionalString(value.attribution);
}
```

Then update `isCourse` so it accepts provider metadata:

```ts
  if (!isOptionalString(value.createdAt) || !isOptionalString(value.updatedAt)) return false;
  if (!isProviderRef(value.providerRef)) return false;
  return value.holes.every((hole, index) => isRecord(hole) && hole.number === index + 1);
```

- [ ] **Step 6: Update stored-data parsing and migration**

Replace `parseStoredData` with:

```ts
function parseStoredData(raw: string): ScorecardData | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.rounds)) return undefined;

    const savedCourses = Array.isArray(parsed.savedCourses)
      ? parsed.savedCourses
      : Array.isArray(parsed.customCourses)
        ? parsed.customCourses
        : undefined;

    if (!Array.isArray(savedCourses)) return undefined;
    if (!savedCourses.every((course) => isCourse(course, ['custom', 'imported']))) return undefined;
    if (!parsed.rounds.every(isRound)) return undefined;

    return {
      savedCourses: savedCourses as Course[],
      rounds: parsed.rounds as Round[]
    };
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 7: Update App state to use savedCourses**

In `src/App.tsx`, rename the `customCourses` state to `savedCourses` and update callers.

Use this state declaration:

```ts
  const [savedCourses, setSavedCourses] = useState(initialState.data.savedCourses);
```

Use these derived values:

```ts
  const courses = [...seedCourses, ...savedCourses];
  const editingCourse = savedCourses.find((course) => course.id === editingCourseId && course.source === 'custom');
```

Update `persist`:

```ts
  function persist(nextCourses: Course[], nextRounds: Round[]): void {
    if (recoveryRequired) return;
    try {
      store.save({ savedCourses: nextCourses, rounds: nextRounds });
      setStorageError('');
    } catch {
      setStorageError(storageErrorMessage);
    }
  }
```

Update `saveCustomCourse`:

```ts
  function saveCustomCourse(course: Course): void {
    if (recoveryRequired) return;
    const nextCourses = savedCourses.some((existingCourse) => existingCourse.id === course.id)
      ? savedCourses.map((existingCourse) => existingCourse.id === course.id ? course : existingCourse)
      : [...savedCourses, course];

    setSavedCourses(nextCourses);
    persist(nextCourses, rounds);
    setEditingCourseId(undefined);
    setSelectedCourseId(undefined);
    setActiveTab('courses');
  }
```

Update round persistence calls:

```ts
    persist(savedCourses, nextRounds);
```

Update reset:

```ts
      setSavedCourses([]);
```

- [ ] **Step 8: Update app tests that seed storage directly**

In `src/App.test.tsx`, replace direct localStorage writes that use `customCourses` with `savedCourses`.

Example:

```ts
localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [firstRound, secondRound] }));
```

Add this import at the top of `src/App.test.tsx`:

```ts
import type { Course } from './domain/types';
```

For the legacy behavior, add this test:

```ts
it('loads legacy custom courses after storage migration', async () => {
  const legacyCourse: Course = {
    id: 'custom-legacy',
    name: 'Legacy Local Nine',
    source: 'custom',
    holeCount: 9,
    holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 }))
  };
  localStorage.setItem('golf-scorecard-v1', JSON.stringify({ customCourses: [legacyCourse], rounds: [] }));

  renderAppWithExistingStorage(<App />);

  await userEvent.type(screen.getByLabelText('Search courses'), 'Legacy');
  expect(screen.getByText('Legacy Local Nine')).toBeInTheDocument();
});
```

- [ ] **Step 9: Run task tests**

Run:

```powershell
npm test -- --run src/storage/localStore.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src/storage src/App.tsx src/App.test.tsx
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: migrate saved course storage"
```

Expected: commit succeeds.

---

### Task 3: Provider Search UI And Local Course Caching

**Files:**
- Create: `src/providers/staticCourseProvider.ts`
- Create: `src/providers/staticCourseProvider.test.ts`
- Modify: `src/components/CourseList.tsx`
- Modify: `src/components/CourseDetail.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `CourseProvider`, `CourseSearchResult`.
- Consumes: `mapProviderCourseToCourse(record, fetchedAt?)`.
- Produces: `staticCourseProvider: CourseProvider`.
- Produces: `App({ courseProvider = staticCourseProvider }: AppProps)`.
- Produces UI copy: `Provided courses`, `Searching provided courses...`, `Provided course search is unavailable right now.`, `This provider scorecard is incomplete. Create a custom course instead.`, `Can't find it? Create a custom course`.

- [ ] **Step 1: Create static provider tests**

Create `src/providers/staticCourseProvider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { staticCourseProvider } from './staticCourseProvider';

describe('static course provider', () => {
  it('returns no results for short queries', async () => {
    await expect(staticCourseProvider.searchCourses({ text: 'au' })).resolves.toEqual([]);
  });

  it('searches deterministic provided courses by name and geography', async () => {
    const byName = await staticCourseProvider.searchCourses({ text: 'Augusta' });
    const byRegion = await staticCourseProvider.searchCourses({ text: 'Georgia' });

    expect(byName[0]).toMatchObject({
      providerId: 'static-demo',
      externalCourseId: 'augusta-national',
      name: 'Augusta National',
      country: 'United States',
      region: 'Georgia',
      locality: 'Augusta',
      holeCount: 18,
      hasScorecard: true
    });
    expect(byRegion.map((result) => result.name)).toContain('Augusta National');
  });

  it('loads a searched course as an imported scorecard', async () => {
    const [result] = await staticCourseProvider.searchCourses({ text: 'Augusta' });
    const course = await staticCourseProvider.loadCourse(result);

    expect(course).toMatchObject({
      id: 'provided-static-demo-augusta-national',
      name: 'Augusta National',
      source: 'imported',
      holeCount: 18,
      providerRef: {
        providerId: 'static-demo',
        externalCourseId: 'augusta-national',
        providerName: 'Static Demo Provider'
      }
    });
    expect(course.holes).toHaveLength(18);
  });
});
```

- [ ] **Step 2: Run failing provider tests**

Run:

```powershell
npm test -- --run src/providers/staticCourseProvider.test.ts
```

Expected: FAIL because `staticCourseProvider.ts` does not exist.

- [ ] **Step 3: Create deterministic provider implementation**

Create `src/providers/staticCourseProvider.ts`:

```ts
import type { Course } from '../domain/types';
import { mapProviderCourseToCourse, type ProviderCourseRecord } from './providerCourseMapper';
import type { CourseProvider, CourseSearchQuery, CourseSearchResult } from './types';

const providerId = 'static-demo';
const providerName = 'Static Demo Provider';
const attribution = 'Static demonstration scorecard data';

const records: ProviderCourseRecord[] = [
  {
    providerId,
    providerName,
    externalCourseId: 'augusta-national',
    name: 'Augusta National',
    country: 'United States',
    region: 'Georgia',
    locality: 'Augusta',
    attribution,
    holes: [
      { number: 1, par: 4, teeDistance: 445, teeDistanceUnit: 'yards' },
      { number: 2, par: 5, teeDistance: 585, teeDistanceUnit: 'yards' },
      { number: 3, par: 4, teeDistance: 350, teeDistanceUnit: 'yards' },
      { number: 4, par: 3, teeDistance: 240, teeDistanceUnit: 'yards' },
      { number: 5, par: 4, teeDistance: 495, teeDistanceUnit: 'yards' },
      { number: 6, par: 3, teeDistance: 180, teeDistanceUnit: 'yards' },
      { number: 7, par: 4, teeDistance: 450, teeDistanceUnit: 'yards' },
      { number: 8, par: 5, teeDistance: 570, teeDistanceUnit: 'yards' },
      { number: 9, par: 4, teeDistance: 460, teeDistanceUnit: 'yards' },
      { number: 10, par: 4, teeDistance: 495, teeDistanceUnit: 'yards' },
      { number: 11, par: 4, teeDistance: 520, teeDistanceUnit: 'yards' },
      { number: 12, par: 3, teeDistance: 155, teeDistanceUnit: 'yards' },
      { number: 13, par: 5, teeDistance: 545, teeDistanceUnit: 'yards' },
      { number: 14, par: 4, teeDistance: 440, teeDistanceUnit: 'yards' },
      { number: 15, par: 5, teeDistance: 550, teeDistanceUnit: 'yards' },
      { number: 16, par: 3, teeDistance: 170, teeDistanceUnit: 'yards' },
      { number: 17, par: 4, teeDistance: 440, teeDistanceUnit: 'yards' },
      { number: 18, par: 4, teeDistance: 465, teeDistanceUnit: 'yards' }
    ]
  },
  {
    providerId,
    providerName,
    externalCourseId: 'royal-melbourne-demo',
    name: 'Royal Melbourne Demo Composite',
    country: 'Australia',
    region: 'Victoria',
    locality: 'Black Rock',
    attribution,
    holes: Array.from({ length: 18 }, (_, index) => ({
      number: index + 1,
      par: [4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4][index],
      teeDistance: [360, 500, 340, 150, 380, 350, 490, 160, 355, 370, 340, 510, 145, 380, 350, 500, 160, 365][index],
      teeDistanceUnit: 'meters'
    }))
  }
];

export const staticCourseProvider: CourseProvider = {
  id: providerId,
  name: providerName,
  attribution,
  async searchCourses(query: CourseSearchQuery): Promise<CourseSearchResult[]> {
    const text = query.text.trim().toLowerCase();
    if (text.length < 3) return [];

    return records
      .filter((record) => [
        record.name,
        record.country,
        record.region,
        record.locality
      ].filter(Boolean).join(' ').toLowerCase().includes(text))
      .map((record) => ({
        providerId: record.providerId,
        externalCourseId: record.externalCourseId,
        name: record.name,
        country: record.country,
        region: record.region,
        locality: record.locality,
        holeCount: record.holes.length === 9 || record.holes.length === 18 ? record.holes.length : undefined,
        hasScorecard: record.holes.length === 9 || record.holes.length === 18
      }));
  },
  async loadCourse(result: CourseSearchResult): Promise<Course> {
    const record = records.find((course) =>
      course.providerId === result.providerId && course.externalCourseId === result.externalCourseId
    );
    if (!record) {
      throw new Error('Provider course result could not be loaded.');
    }

    const mapped = mapProviderCourseToCourse(record);
    if (!mapped.course) {
      throw new Error(mapped.errors.join(' '));
    }
    return mapped.course;
  }
};
```

- [ ] **Step 4: Update CourseList props and provider result UI**

Modify `src/components/CourseList.tsx`.

Add imports:

```ts
import type { CourseSearchResult } from '../providers/types';
```

Add these types before `CourseListProps`:

```ts
export type ProviderSearchStatus = 'idle' | 'searching' | 'loading' | 'error';
```

Replace `CourseListProps` with:

```ts
interface CourseListProps {
  courses: Course[];
  query: string;
  inProgressRounds: Round[];
  providerResults?: CourseSearchResult[];
  providerStatus?: ProviderSearchStatus;
  providerError?: string;
  onQueryChange(query: string): void;
  onSelectCourse(courseId: string): void;
  onResumeRound(roundId: string): void;
  onSelectProviderResult?(result: CourseSearchResult): void;
  onCreateCourse?(): void;
}
```

Destructure the new props with defaults:

```ts
  providerResults = [],
  providerStatus = 'idle',
  providerError,
  onSelectProviderResult,
  onCreateCourse
```

After the local `.course-list`, render provider states and fallback:

```tsx
      {providerStatus === 'searching' ? <p className="provider-status">Searching provided courses...</p> : null}
      {providerError ? <p className="error-list" role="alert">{providerError}</p> : null}
      {providerResults.length > 0 ? (
        <section className="provider-results" aria-label="Provided courses">
          <h2>Provided courses</h2>
          <div className="course-list">
            {providerResults.map((result) => (
              <button
                key={`${result.providerId}:${result.externalCourseId}`}
                className="course-row provider-row"
                onClick={() => onSelectProviderResult?.(result)}
              >
                <span>
                  <strong>{result.name}</strong>
                  <small>
                    {[result.locality, result.region, result.country].filter(Boolean).join(', ') || 'Provided course'}
                    {result.holeCount ? ` · ${result.holeCount} holes` : ''}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {onCreateCourse ? (
        <div className="custom-fallback">
          <span>Can't find it?</span>
          <button className="secondary-button" onClick={onCreateCourse}>Create a custom course</button>
        </div>
      ) : null}
```

- [ ] **Step 5: Add provider-friendly course source helper**

Modify `src/domain/courses.ts` to add:

```ts
export function getCourseSourceLabel(course: Course): string {
  if (course.providerRef) {
    return course.providerRef.providerName;
  }
  return course.source;
}
```

Modify `src/components/CourseDetail.tsx` to import and use it:

```ts
import { calculateCoursePar, getCourseSourceLabel } from '../domain/courses';
```

Replace the header source display:

```tsx
        <p>{course.holeCount} holes · Par {calculateCoursePar(course)} · {getCourseSourceLabel(course)}</p>
```

- [ ] **Step 6: Wire provider search in App**

Modify the React import in `src/App.tsx`:

```ts
import { useEffect, useState } from 'react';
```

Add imports:

```ts
import { validateCourse } from './domain/courses';
import { staticCourseProvider } from './providers/staticCourseProvider';
import type { CourseProvider, CourseSearchResult } from './providers/types';
import type { ProviderSearchStatus } from './components/CourseList';
```

Add props:

```ts
interface AppProps {
  courseProvider?: CourseProvider;
}

export function App({ courseProvider = staticCourseProvider }: AppProps) {
```

Add provider state:

```ts
  const [providerResults, setProviderResults] = useState<CourseSearchResult[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderSearchStatus>('idle');
  const [providerError, setProviderError] = useState('');
```

Add this effect after derived values:

```ts
  useEffect(() => {
    const text = query.trim();
    let cancelled = false;

    if (text.length < 3) {
      setProviderResults([]);
      setProviderStatus('idle');
      setProviderError('');
      return () => {
        cancelled = true;
      };
    }

    setProviderStatus('searching');
    setProviderError('');
    courseProvider.searchCourses({ text })
      .then((results) => {
        if (cancelled) return;
        const savedProviderKeys = new Set(savedCourses
          .map((course) => course.providerRef ? `${course.providerRef.providerId}:${course.providerRef.externalCourseId}` : undefined)
          .filter(Boolean));
        setProviderResults(results.filter((result) => !savedProviderKeys.has(`${result.providerId}:${result.externalCourseId}`)));
        setProviderStatus('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setProviderResults([]);
        setProviderStatus('error');
        setProviderError('Provided course search is unavailable right now.');
      });

    return () => {
      cancelled = true;
    };
  }, [courseProvider, query, savedCourses]);
```

Add this handler before `resetSavedData`:

```ts
  async function selectProviderResult(result: CourseSearchResult): Promise<void> {
    if (recoveryRequired) return;

    const existingCourse = savedCourses.find((course) =>
      course.providerRef?.providerId === result.providerId &&
      course.providerRef.externalCourseId === result.externalCourseId
    );

    if (existingCourse) {
      selectCourse(existingCourse.id);
      return;
    }

    setProviderStatus('loading');
    setProviderError('');

    try {
      const course = await courseProvider.loadCourse(result);
      const validationErrors = validateCourse(course);
      if (validationErrors.length > 0) {
        setProviderStatus('error');
        setProviderError('This provider scorecard is incomplete. Create a custom course instead.');
        return;
      }

      const nextCourses = [...savedCourses, course];
      setSavedCourses(nextCourses);
      persist(nextCourses, rounds);
      setSelectedCourseId(course.id);
      setEditingCourseId(undefined);
      setSummaryRoundId(undefined);
      setActiveRoundId(undefined);
      setProviderResults([]);
      setProviderStatus('idle');
    } catch {
      setProviderStatus('error');
      setProviderError('Provided course search is unavailable right now.');
    }
  }
```

Update the `CourseList` render:

```tsx
          <CourseList
            courses={courses}
            query={query}
            inProgressRounds={inProgressRounds}
            providerResults={providerResults}
            providerStatus={providerStatus}
            providerError={providerError}
            onQueryChange={setQuery}
            onSelectCourse={selectCourse}
            onResumeRound={resumeRound}
            onSelectProviderResult={selectProviderResult}
            onCreateCourse={createCourse}
          />
```

Remove the separate top-level Courses-tab `Create course` button from the fragment.

- [ ] **Step 7: Add provider UI tests**

Append these tests to `src/App.test.tsx`:

```tsx
it('searches provided courses, saves one locally, and starts a round from it', async () => {
  renderApp(<App />);

  await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');
  await screen.findByLabelText('Provided courses');
  await userEvent.click(screen.getByRole('button', { name: /Augusta National/ }));

  expect(await screen.findByRole('heading', { name: 'Augusta National' })).toBeInTheDocument();
  expect(screen.getByText(/Static Demo Provider/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
  expect(screen.getByLabelText('Hole 18 strokes')).toBeInTheDocument();

  const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
  expect(stored.savedCourses[0]).toMatchObject({
    name: 'Augusta National',
    source: 'imported',
    providerRef: {
      providerId: 'static-demo',
      externalCourseId: 'augusta-national'
    }
  });
});

it('keeps custom course creation available as the course fallback', async () => {
  renderApp(<App />);

  await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
  expect(screen.getByText("Can't find it?")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));

  expect(screen.getByRole('heading', { name: 'Create course' })).toBeInTheDocument();
});

it('shows a non-blocking provider error when search fails', async () => {
  const failingProvider = {
    id: 'failing-provider',
    name: 'Failing Provider',
    async searchCourses() {
      throw new Error('network unavailable');
    },
    async loadCourse() {
      throw new Error('network unavailable');
    }
  };

  renderApp(<App courseProvider={failingProvider} />);

  await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');

  expect(await screen.findByText('Provided course search is unavailable right now.')).toBeInTheDocument();
  expect(screen.getByText("Can't find it?")).toBeInTheDocument();
});

it('does not duplicate provider courses that are already saved locally', async () => {
  renderApp(<App />);

  await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');
  await userEvent.click(await screen.findByRole('button', { name: /Augusta National/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await userEvent.clear(screen.getByLabelText('Search courses'));
  await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');

  expect(screen.getByText('Augusta National')).toBeInTheDocument();
  expect(screen.queryByLabelText('Provided courses')).not.toBeInTheDocument();
});
```

- [ ] **Step 8: Add provider and fallback styles**

Append to `src/styles.css`:

```css
.provider-results {
  display: grid;
  gap: 10px;
}

.provider-results h2 {
  font-size: 1rem;
  margin: 4px 0 0;
}

.provider-row small {
  color: #52675f;
}

.provider-status {
  color: #52675f;
  margin: 0;
}

.custom-fallback {
  display: grid;
  gap: 8px;
  border-top: 1px solid #d8d0bf;
  padding-top: 12px;
}

.custom-fallback span {
  color: #64736c;
  font-weight: 700;
}
```

- [ ] **Step 9: Run task tests**

Run:

```powershell
npm test -- --run src/providers/staticCourseProvider.test.ts src/App.test.tsx src/domain/courses.test.ts src/domain/rounds.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add src
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "feat: add provided course search flow"
```

Expected: commit succeeds.

---

### Task 4: E2E, Documentation, And Full Verification

**Files:**
- Modify: `e2e/score-round.spec.ts`
- Modify: `README.md`
- Modify: `docs/qa/v1-manual-walkthrough.md`

**Interfaces:**
- Consumes: provider search UI from Task 3.
- Produces browser-level proof that a user can search a provided course, save/select it, start a round, finish scoring, and see history.
- Keeps existing seeded-course browser workflow coverage.

- [ ] **Step 1: Add provided-course Playwright workflow**

Append this test to `e2e/score-round.spec.ts`:

```ts
test('mobile user scores a provided 18-hole round', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search courses').fill('Augusta');
  await page.getByLabel('Provided courses').getByText('Augusta National').click();
  await page.getByRole('button', { name: 'Start round' }).click();

  for (let hole = 1; hole <= 18; hole += 1) {
    await page.getByLabel(`Hole ${hole} strokes`).fill('4');
  }

  await page.getByRole('button', { name: 'Finish round' }).click();
  await expect(page.getByText('Total 72')).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByLabel('Round history')).toContainText('Augusta National');
  await expect(page.getByLabel('Round history')).toContainText('Total 72');
});
```

- [ ] **Step 2: Update README feature and limitation copy**

In `README.md`, update the Current V1 Features list.

Replace:

```md
- Search seeded course scorecards.
```

with:

```md
- Search seeded and provider-backed course scorecards.
```

Add this bullet after it:

```md
- Save selected provided courses locally for scoring.
```

In Known V1 Limitations, replace:

```md
- Course data is currently seeded or manually entered; there is no live course database integration yet.
```

with:

```md
- Provider-backed course search currently uses deterministic demo data; live course database integration is the next provider step.
```

- [ ] **Step 3: Update manual QA checklist**

In `docs/qa/v1-manual-walkthrough.md`, add this section before `## Seeded Course Flow`:

```md
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
```

- [ ] **Step 4: Run unit and component verification**

Run:

```powershell
npm test -- --run
```

Expected: PASS with all Vitest suites.

- [ ] **Step 5: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS and Vite writes production assets to `dist/`.

- [ ] **Step 6: Run browser workflow verification**

Run:

```powershell
npm run e2e
```

Expected: PASS with the seeded-course workflow and the provided-course workflow.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' add e2e README.md docs/qa/v1-manual-walkthrough.md
git --git-dir='work\\golf-scorecard-design.git' --work-tree='.' commit -m "test: verify provided course scoring workflow"
```

Expected: commit succeeds.

---

## Self-Review Notes

- Spec coverage: Task 1 implements provider boundaries, provider metadata, validation mapping, stable IDs, and immutable round snapshot metadata. Task 2 implements `savedCourses` migration and legacy `customCourses` loading. Task 3 implements provider-first search UI, local caching, duplicate detection, non-blocking provider errors, and secondary custom fallback. Task 4 implements E2E proof and documentation.
- Scope check: CSV upload, live API HTTP integration, accounts, backend sync, maps, GPS, booking, and full global coverage are excluded.
- Type consistency: `CourseProviderRef`, `CourseSearchQuery`, `CourseSearchResult`, `CourseProvider`, `ProviderCourseRecord`, `ProviderHoleRecord`, `ProviderCourseMappingResult`, `createProviderCourseId`, and `mapProviderCourseToCourse` are defined before use.
- Test coverage: Unit tests cover mapper and storage migration; component tests cover provider search and caching; E2E tests cover browser scoring from a provided course.
