import { useEffect, useRef, useState } from 'react';
import { BottomNav, type AppTab } from './components/BottomNav';
import { ActiveRound } from './components/ActiveRound';
import { CourseDetail } from './components/CourseDetail';
import { CourseForm } from './components/CourseForm';
import { CourseList } from './components/CourseList';
import { RoundHistory } from './components/RoundHistory';
import { RoundSummary } from './components/RoundSummary';
import { seedCourses } from './data/seedCourses';
import { validateCourse } from './domain/courses';
import { completeRound, createRoundFromCourse, setHoleStrokes } from './domain/rounds';
import type { Course, Round } from './domain/types';
import { createProviderIdentityKey } from './providers/providerCourseMapper';
import { staticCourseProvider } from './providers/staticCourseProvider';
import type { CourseProvider, CourseSearchResult } from './providers/types';
import { createLocalScorecardStore } from './storage/localStore';
import type { ProviderSearchStatus } from './components/CourseList';

const storageErrorMessage = 'Scores cannot be saved on this device right now.';

interface AppProps {
  courseProvider?: CourseProvider;
}

export function App({ courseProvider = staticCourseProvider }: AppProps) {
  const [store] = useState(() => createLocalScorecardStore(window.localStorage));
  const [initialState] = useState(() => {
    try {
      const loaded = store.load();
      return { ...loaded, storageError: '' };
    } catch {
      return { data: { savedCourses: [], rounds: [] }, recoveryRequired: false, storageError: storageErrorMessage };
    }
  });
  const [savedCourses, setSavedCourses] = useState(initialState.data.savedCourses);
  const savedCoursesRef = useRef(initialState.data.savedCourses);
  const [rounds, setRounds] = useState<Round[]>(initialState.data.rounds);
  const roundsRef = useRef(initialState.data.rounds);
  const [storageError, setStorageError] = useState(initialState.storageError);
  const [recoveryRequired, setRecoveryRequired] = useState(initialState.recoveryRequired);
  const [activeTab, setActiveTab] = useState<AppTab>('play');
  const [query, setQuery] = useState('');
  const [providerResults, setProviderResults] = useState<CourseSearchResult[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderSearchStatus>('idle');
  const [providerError, setProviderError] = useState('');
  const providerLoadRequestRef = useRef(0);
  const [selectedCourseId, setSelectedCourseId] = useState<string>();
  const [editingCourseId, setEditingCourseId] = useState<string>();
  const [activeRoundId, setActiveRoundId] = useState<string>();
  const [summaryRoundId, setSummaryRoundId] = useState<string>();
  const courses = [...seedCourses, ...savedCourses];
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const editingCourse = savedCourses.find((course) => course.id === editingCourseId && course.source === 'custom');
  const inProgressRounds = rounds.filter((round) => round.status === 'in_progress');
  const inProgressRound = inProgressRounds[0];
  const activeRound = rounds.find((round) => round.id === activeRoundId);
  const summaryRound = rounds.find((round) => round.id === summaryRoundId);

  useEffect(() => {
    providerLoadRequestRef.current += 1;
  }, [query]);

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
          .map((course) => course.providerRef
            ? createProviderIdentityKey(course.providerRef.providerId, course.providerRef.externalCourseId)
            : undefined)
          .filter(Boolean));
        setProviderResults(results.filter((result) => !savedProviderKeys.has(
          createProviderIdentityKey(result.providerId, result.externalCourseId)
        )));
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

  function persist(nextCourses: Course[], nextRounds: Round[]): void {
    if (recoveryRequired) return;
    try {
      store.save({ savedCourses: nextCourses, rounds: nextRounds });
      setStorageError('');
    } catch {
      setStorageError(storageErrorMessage);
    }
  }

  function replaceRounds(nextRounds: Round[]): void {
    roundsRef.current = nextRounds;
    setRounds(nextRounds);
  }

  function invalidateProviderLoad(): void {
    providerLoadRequestRef.current += 1;
  }

  function saveCustomCourse(course: Course): void {
    if (recoveryRequired) return;
    const nextCourses = savedCourses.some((existingCourse) => existingCourse.id === course.id)
      ? savedCourses.map((existingCourse) => existingCourse.id === course.id ? course : existingCourse)
      : [...savedCourses, course];

    savedCoursesRef.current = nextCourses;
    setSavedCourses(nextCourses);
    persist(nextCourses, roundsRef.current);
    invalidateProviderLoad();
    setEditingCourseId(undefined);
    setSelectedCourseId(undefined);
    setActiveTab('courses');
  }

  function selectCourse(courseId: string): void {
    invalidateProviderLoad();
    setSelectedCourseId(courseId);
    setEditingCourseId(undefined);
  }

  function editCourse(courseId: string): void {
    invalidateProviderLoad();
    setEditingCourseId(courseId);
    setSelectedCourseId(undefined);
  }

  function createCourse(): void {
    invalidateProviderLoad();
    setEditingCourseId('new');
    setSelectedCourseId(undefined);
  }

  function changeQuery(nextQuery: string): void {
    invalidateProviderLoad();
    setQuery(nextQuery);
  }

  function showCourseList(tab: AppTab = activeTab): void {
    invalidateProviderLoad();
    setActiveTab(tab);
    setSelectedCourseId(undefined);
    setEditingCourseId(undefined);
    setActiveRoundId(undefined);
    setSummaryRoundId(undefined);
  }

  function startRound(courseId: string): void {
    if (recoveryRequired) return;
    if (inProgressRound) {
      resumeRound(inProgressRound.id);
      return;
    }
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
    setActiveRoundId(round.id);
    setSummaryRoundId(undefined);
    setActiveTab('play');
  }

  function changeRoundStrokes(roundId: string, holeNumber: number, strokes: number | undefined): void {
    if (recoveryRequired) return;
    let changed = false;
    const nextRounds = roundsRef.current.map((round) => {
      if (round.id !== roundId) return round;

      try {
        changed = true;
        return setHoleStrokes(round, holeNumber, strokes);
      } catch {
        return round;
      }
    });

    if (!changed) return;
    replaceRounds(nextRounds);
    persist(savedCoursesRef.current, nextRounds);
  }

  function finishRound(roundId: string): void {
    if (recoveryRequired) return;
    let completedRound: Round | undefined;
    const nextRounds = roundsRef.current.map((round) => {
      if (round.id !== roundId) return round;

      try {
        completedRound = completeRound(round, new Date().toISOString());
        return completedRound;
      } catch {
        return round;
      }
    });

    if (!completedRound) return;
    replaceRounds(nextRounds);
    persist(savedCoursesRef.current, nextRounds);
    setActiveRoundId(undefined);
    setSummaryRoundId(completedRound.id);
  }

  function resumeRound(roundId: string): void {
    invalidateProviderLoad();
    setSelectedCourseId(undefined);
    setEditingCourseId(undefined);
    setSummaryRoundId(undefined);
    setActiveRoundId(roundId);
    setActiveTab('play');
  }

  function openCompletedRound(roundId: string): void {
    invalidateProviderLoad();
    setSummaryRoundId(roundId);
    setActiveRoundId(undefined);
  }

  async function selectProviderResult(result: CourseSearchResult): Promise<void> {
    if (recoveryRequired) return;

    const resultProviderKey = createProviderIdentityKey(result.providerId, result.externalCourseId);
    const existingCourse = savedCoursesRef.current.find((course) =>
      course.providerRef !== undefined &&
      createProviderIdentityKey(course.providerRef.providerId, course.providerRef.externalCourseId) === resultProviderKey
    );

    if (existingCourse) {
      selectCourse(existingCourse.id);
      return;
    }

    setProviderStatus('loading');
    setProviderError('');
    const requestId = ++providerLoadRequestRef.current;

    try {
      const course = await courseProvider.loadCourse(result);
      if (requestId !== providerLoadRequestRef.current) return;

      const validationErrors = validateCourse(course);
      if (validationErrors.length > 0) {
        setProviderStatus('error');
        setProviderError('This provider scorecard is incomplete. Create a custom course instead.');
        return;
      }

      const currentCourses = savedCoursesRef.current;
      const duplicateCourse = currentCourses.find((existing) =>
        existing.providerRef !== undefined &&
        createProviderIdentityKey(existing.providerRef.providerId, existing.providerRef.externalCourseId) === resultProviderKey
      );
      const nextCourses = duplicateCourse ? currentCourses : [...currentCourses, course];
      savedCoursesRef.current = nextCourses;
      setSavedCourses(nextCourses);
      persist(nextCourses, roundsRef.current);
      setSelectedCourseId(course.id);
      setEditingCourseId(undefined);
      setSummaryRoundId(undefined);
      setActiveRoundId(undefined);
      setProviderResults([]);
      setProviderStatus('idle');
    } catch {
      if (requestId !== providerLoadRequestRef.current) return;
      setProviderStatus('error');
      setProviderError('Provided course search is unavailable right now.');
    }
  }

  function resetSavedData(): void {
    try {
      invalidateProviderLoad();
      store.reset();
      savedCoursesRef.current = [];
      setSavedCourses([]);
      replaceRounds([]);
      setRecoveryRequired(false);
      setStorageError('');
    } catch {
      setStorageError(storageErrorMessage);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Golf Scorecard</p>
        <h1>{activeTab === 'history' ? 'History' : activeTab === 'courses' ? 'Courses' : 'Start a round'}</h1>
      </header>
      {recoveryRequired ? (
        <div className="recovery-panel" role="alert">
          <p>Saved scorecard data could not be read. It has been preserved as a recovery backup.</p>
          <button className="secondary-button" onClick={resetSavedData}>Reset saved data</button>
        </div>
      ) : null}
      {storageError ? <p className="error-list" role="alert">{storageError}</p> : null}
      {activeRound ? <ActiveRound round={activeRound} onBack={() => showCourseList('play')} onChangeStrokes={(holeNumber, strokes) => changeRoundStrokes(activeRound.id, holeNumber, strokes)} onFinishRound={() => finishRound(activeRound.id)} /> : null}
      {!activeRound && summaryRound ? <RoundSummary round={summaryRound} onBack={() => showCourseList(activeTab)} /> : null}
      {!activeRound && !summaryRound && editingCourseId ? <CourseForm course={editingCourse} hasPriorRounds={editingCourse !== undefined && rounds.some((round) => round.courseId === editingCourse.id || round.courseSnapshot.id === editingCourse.id)} onSave={saveCustomCourse} onCancel={() => showCourseList('courses')} /> : null}
      {!activeRound && !summaryRound && !editingCourseId && selectedCourse ? <CourseDetail course={selectedCourse} onBack={() => setSelectedCourseId(undefined)} onStartRound={startRound} onEditCourse={editCourse} /> : null}
      {!activeRound && !summaryRound && !editingCourseId && !selectedCourse && activeTab !== 'history' ? (
        <CourseList
          courses={courses}
          query={query}
          inProgressRounds={inProgressRounds}
          providerResults={providerResults}
          providerStatus={providerStatus}
          providerError={providerError}
          onQueryChange={changeQuery}
          onSelectCourse={selectCourse}
          onResumeRound={resumeRound}
          onSelectProviderResult={selectProviderResult}
          onCreateCourse={createCourse}
        />
      ) : null}
      {!activeRound && !summaryRound && !editingCourseId && !selectedCourse && activeTab === 'history' ? <RoundHistory rounds={rounds} onOpenRound={openCompletedRound} /> : null}
      <BottomNav activeTab={activeTab} onSelect={showCourseList} />
    </main>
  );
}
