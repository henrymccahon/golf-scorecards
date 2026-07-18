# Course Search Foundation Design

## Summary

Build the next course-data package as a provider-backed course search foundation. The product should feel like users are expected to search and select provided course scorecards first, with custom course creation kept as a secondary fallback for missing or inaccurate courses.

The architecture should be global-ready from the start, but implementation should integrate one provider at a time. V1 must not promise complete global coverage until provider quality, licensing, scorecard completeness, and operating cost are verified.

## Goals

- Add a clear provider boundary for searching and loading provided course scorecards.
- Keep the current local-first scoring flow working without sign-in or backend infrastructure.
- Cache selected provided courses locally so users can start rounds without re-searching every time.
- Preserve immutable round snapshots exactly as the current app does.
- Support future global providers without hard-coding the product around Australia, the United States, or any single vendor.
- Keep custom course creation available, but make it visually and conceptually secondary.
- Keep the data model ready for provider attribution, country, region, and external IDs.

## Non-Goals

- Do not add CSV upload or file import in this package.
- Do not build a full global course database.
- Do not claim complete global course coverage.
- Do not require accounts, cloud sync, paid plans, or a backend for this package.
- Do not add course maps, GPS shot tracking, booking, tee times, reviews, or rich course profiles.
- Do not build a complex imported-course management area.
- Do not remove the existing custom course fallback.

## Recommended Approach

Use a global-ready provider layer and start with a single concrete provider adapter once the interface is in place.

Alternatives considered:

- Australia-first hard-coded data flow: useful for local product testing, but it would shape the app too narrowly and make later global expansion more expensive.
- Full global provider integration now: closer to the long-term product idea, but too risky for this stage because provider coverage, scorecard completeness, licensing, pricing, and reliability are still uncertain.
- Provider foundation first, one provider at a time: best balance. The user experience can be designed around provided courses while the implementation stays small and testable.

## Provider Research Notes

Initial research found several possible course-data sources:

- OpenGolfAPI: strong open technical fit, free/keyless read access, ODbL-licensed, and detailed scorecard data, but currently focused on United States courses.
- RYZE Golf API: states worldwide coverage and scorecard data through RapidAPI, but pricing, terms, rate limits, and data quality need validation.
- GolfCourseAPI: states nearly 30,000 worldwide courses with free and paid tiers, but request limits and scorecard completeness need validation.
- iGolf: established licensed global course and scorecard data, likely more production-grade but probably commercial/partner-led.

The design should not bake in any one provider. It should make provider choice a configuration and mapping concern.

## User Experience

The Play screen remains the main entry point.

Course search should prioritize provided courses:

- The primary search input searches the local course list immediately.
- When the query is long enough, the app may also ask the active provider for matching course results.
- Results should make it clear when a course is already saved locally versus available from the provider.
- Selecting a provider result should load enough scorecard detail to validate it and save it locally before starting a round.
- If provider search fails, returns no useful scorecard, or is offline, the app should show a plain message and leave custom course creation available.

Custom course creation should move lower in emphasis:

- Keep the Courses tab and "Create course" action.
- Treat it as "Can't find a course?" fallback copy rather than a primary V1 feature.
- Existing custom-course edit behavior and historical round snapshot behavior remain unchanged.

## Data Model

The existing `Course` model should remain the canonical scorecard shape used by scoring.

Provider-loaded courses should map into `Course` records with:

- `source: 'imported'` for compatibility with the current type.
- A stable local `id` derived from provider ID and provider course ID.
- `name`, `holeCount`, and validated `holes`.
- Optional metadata for provider identity and geography.

Add a provider metadata object to `Course`:

```ts
interface CourseProviderRef {
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

Extend `Course` with:

```ts
providerRef?: CourseProviderRef;
```

UI labels should avoid making "import" feel like a separate product feature. A provider-loaded course can display as "provided" or show the provider name, while the internal `source: 'imported'` value remains an implementation detail.

## Provider Interfaces

Add provider-facing types that are separate from `Course`:

```ts
interface CourseSearchQuery {
  text: string;
  country?: string;
  region?: string;
}

interface CourseSearchResult {
  providerId: string;
  externalCourseId: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  holeCount?: 9 | 18;
  hasScorecard: boolean;
}

interface CourseProvider {
  id: string;
  name: string;
  attribution?: string;
  searchCourses(query: CourseSearchQuery): Promise<CourseSearchResult[]>;
  loadCourse(result: CourseSearchResult): Promise<Course>;
}
```

The UI should only depend on the interface. Provider-specific HTTP response shapes belong in provider adapter files.

## Storage

The current store persists `customCourses` and `rounds`. This package should migrate to persisted user-saved courses that can include both custom and provider-loaded courses.

Recommended storage shape:

```ts
interface ScorecardData {
  savedCourses: Course[];
  rounds: Round[];
}
```

Migration requirement:

- Existing stored `customCourses` must load into `savedCourses`.
- Existing rounds must remain valid.
- The app must continue to recover safely from malformed storage.
- Seeded courses remain bundled in code and are not persisted unless the user starts from or saves a provider-backed equivalent later.

This package should implement the migration to `savedCourses` rather than continuing to overload `customCourses`.

## Validation And Mapping

Every provider-loaded course must pass the same `validateCourse(course)` checks before it can be saved or used to start a round.

Mapping rules:

- Missing par for any hole makes the provider scorecard unusable for scoring.
- Unsupported hole counts are excluded from V1 search details unless they can be represented as 9 or 18 holes.
- Stroke indexes are optional, but if present they must be positive and unique.
- Tee distances are optional and must be positive when present.
- Tee distance units must map to `meters` or `yards`.
- Provider data should never mutate existing completed or in-progress round snapshots.

## Error Handling

Handle provider failures without blocking local scoring:

- Empty query: show local courses only.
- Network error: show a non-blocking provider search error.
- No results: show a clear no-results state and the custom-course fallback.
- Result without valid scorecard: do not save it; explain that the scorecard is incomplete.
- Duplicate provider result already saved locally: show the saved local version rather than creating another copy.
- Storage failure: use the existing storage error message pattern.

## Testing Strategy

Unit tests:

- Provider result mapping creates valid `Course` objects.
- Invalid provider scorecards are rejected before save/start.
- Provider IDs produce stable local course IDs.
- Storage migration loads old `customCourses` data into the new saved-course shape.
- Search text includes provider geography where appropriate.

Component tests:

- Searching shows local courses immediately.
- Provider results appear separately from saved local courses.
- Selecting a provider result saves it locally and opens course detail.
- Provider failure leaves custom course creation available.
- Saved provider courses can start rounds and round snapshots remain immutable.

E2E test:

- Use a fake or seeded provider adapter in test mode.
- Search for a provided course, save/select it, start a round, enter strokes, finish, and verify history.

## Implementation Boundaries

Keep files focused:

- `src/providers/types.ts`: provider interfaces.
- `src/providers/staticProvider.ts` or `src/providers/fakeProvider.ts`: first testable provider adapter.
- `src/providers/providerCourseMapper.ts`: mapping and validation helpers.
- `src/storage/localStore.ts`: migration and persisted saved courses.
- `src/components/CourseList.tsx`: provider search results and fallback UI.
- `src/App.tsx`: orchestration and persistence.

Avoid provider HTTP implementation until the foundation is tested with a deterministic provider. The first real API adapter should be a follow-up task after the UI, storage, and mapping boundaries are stable.

## Success Criteria

- Users see provider search as the primary path to finding courses.
- Custom course creation remains available but secondary.
- A provider course can be selected, validated, saved locally, and used to start a round.
- Rounds continue to store immutable course snapshots.
- Existing local data survives migration.
- The app remains usable offline with already saved courses and custom courses.
- The design can support Australia, US, and global providers without changing scoring code.

## Open Decisions For Later

- Which real provider to integrate first.
- Whether Australia should be a launch QA market, marketing focus, or first paid-data target.
- Whether provider-backed courses should support user corrections directly or require duplicating to a custom course.
- How provider attribution should appear in production UI.
- Whether cached provider courses should refresh automatically or only when manually reselected.
