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

  function persist(nextCourses: Course[], nextRounds: Round[]): void {
    if (recoveryRequired) return;
    try {
      store.save({ savedCourses: nextCourses, rounds: nextRounds });
      setStorageError('');
    } catch {
      setStorageError(storageErrorMessage);
    }
  }

  function saveCustomCourse(course: Course): void {
    if (recoveryRequired) return;
    const nextCourses = savedCourses.some((existingCourse) => existingCourse.id === course.id)
      ? savedCourses.map((existingCourse) => existingCourse.id === course.id ? course : existingCourse)
      : [...savedCourses, course];

    savedCoursesRef.current = nextCourses;
    setSavedCourses(nextCourses);
    persist(nextCourses, rounds);
    setEditingCourseId(undefined);
    setSelectedCourseId(undefined);
    setActiveTab('courses');
  }

  function selectCourse(courseId: string): void {
    setSelectedCourseId(courseId);
    setEditingCourseId(undefined);
  }

  function editCourse(courseId: string): void {
    setEditingCourseId(courseId);
    setSelectedCourseId(undefined);
  }

  function createCourse(): void {
    setEditingCourseId('new');
    setSelectedCourseId(undefined);
  }

  function changeQuery(nextQuery: string): void {
    providerLoadRequestRef.current += 1;
    setQuery(nextQuery);
  }

  function showCourseList(tab: AppTab = activeTab): void {
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

    const round = createRoundFromCourse(course, {
      id: `round-${Date.now()}`,
      startedAt: new Date().toISOString()
    });
    const nextRounds = [...rounds, round];

    setRounds(nextRounds);
    persist(savedCourses, nextRounds);
    setSelectedCourseId(undefined);
    setActiveRoundId(round.id);
    setSummaryRoundId(undefined);
    setActiveTab('play');
  }

  function changeRoundStrokes(roundId: string, holeNumber: number, strokes: number | undefined): void {
    if (recoveryRequired) return;
    let changed = false;
    const nextRounds = rounds.map((round) => {
      if (round.id !== roundId) return round;

      try {
        changed = true;
        return setHoleStrokes(round, holeNumber, strokes);
      } catch {
        return round;
      }
    });

    if (!changed) return;
    setRounds(nextRounds);
    persist(savedCourses, nextRounds);
  }

  function finishRound(roundId: string): void {
    if (recoveryRequired) return;
    let completedRound: Round | undefined;
    const nextRounds = rounds.map((round) => {
      if (round.id !== roundId) return round;

      try {
        completedRound = completeRound(round, new Date().toISOString());
        return completedRound;
      } catch {
        return round;
      }
    });

    if (!completedRound) return;
    setRounds(nextRounds);
    persist(savedCourses, nextRounds);
    setActiveRoundId(undefined);
    setSummaryRoundId(completedRound.id);
  }

  function resumeRound(roundId: string): void {
    setSelectedCourseId(undefined);
    setEditingCourseId(undefined);
    setSummaryRoundId(undefined);
    setActiveRoundId(roundId);
    setActiveTab('play');
  }

  function openCompletedRound(roundId: string): void {
    setSummaryRoundId(roundId);
    setActiveRoundId(undefined);
  }

  async function selectProviderResult(result: CourseSearchResult): Promise<void> {
    if (recoveryRequired) return;

    const existingCourse = savedCoursesRef.current.find((course) =>
      course.providerRef?.providerId === result.providerId &&
      course.providerRef.externalCourseId === result.externalCourseId
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
        existing.providerRef?.providerId === result.providerId &&
        existing.providerRef.externalCourseId === result.externalCourseId
      );
      const nextCourses = duplicateCourse ? currentCourses : [...currentCourses, course];
      savedCoursesRef.current = nextCourses;
      setSavedCourses(nextCourses);
      persist(nextCourses, rounds);
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
      store.reset();
      savedCoursesRef.current = [];
      setSavedCourses([]);
      setRounds([]);
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
