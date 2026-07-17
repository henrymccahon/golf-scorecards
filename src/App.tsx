import { useState } from 'react';
import { BottomNav, type AppTab } from './components/BottomNav';
import { ActiveRound } from './components/ActiveRound';
import { CourseDetail } from './components/CourseDetail';
import { CourseForm } from './components/CourseForm';
import { CourseList } from './components/CourseList';
import { RoundHistory } from './components/RoundHistory';
import { RoundSummary } from './components/RoundSummary';
import { seedCourses } from './data/seedCourses';
import { completeRound, createRoundFromCourse, setHoleStrokes } from './domain/rounds';
import type { Course, Round } from './domain/types';
import { createLocalScorecardStore } from './storage/localStore';

const storageErrorMessage = 'Scores cannot be saved on this device right now.';

export function App() {
  const store = createLocalScorecardStore(window.localStorage);
  const [initialState] = useState(() => {
    try {
      return { data: store.load(), storageError: '' };
    } catch {
      return { data: { customCourses: [], rounds: [] }, storageError: storageErrorMessage };
    }
  });
  const [customCourses, setCustomCourses] = useState(initialState.data.customCourses);
  const [rounds, setRounds] = useState<Round[]>(initialState.data.rounds);
  const [storageError, setStorageError] = useState(initialState.storageError);
  const [activeTab, setActiveTab] = useState<AppTab>('play');
  const [query, setQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>();
  const [editingCourseId, setEditingCourseId] = useState<string>();
  const [activeRoundId, setActiveRoundId] = useState<string>();
  const [summaryRoundId, setSummaryRoundId] = useState<string>();
  const courses = [...seedCourses, ...customCourses];
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const editingCourse = customCourses.find((course) => course.id === editingCourseId);
  const inProgressRound = rounds.find((round) => round.status === 'in_progress');
  const activeRound = rounds.find((round) => round.id === activeRoundId);
  const summaryRound = rounds.find((round) => round.id === summaryRoundId);

  function persist(nextCourses: Course[], nextRounds: Round[]): void {
    try {
      store.save({ customCourses: nextCourses, rounds: nextRounds });
      setStorageError('');
    } catch {
      setStorageError(storageErrorMessage);
    }
  }

  function saveCustomCourse(course: Course): void {
    const nextCourses = customCourses.some((existingCourse) => existingCourse.id === course.id)
      ? customCourses.map((existingCourse) => existingCourse.id === course.id ? course : existingCourse)
      : [...customCourses, course];

    setCustomCourses(nextCourses);
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

  function showCourseList(tab: AppTab = activeTab): void {
    setActiveTab(tab);
    setSelectedCourseId(undefined);
    setEditingCourseId(undefined);
    setActiveRoundId(undefined);
    setSummaryRoundId(undefined);
  }

  function startRound(courseId: string): void {
    const course = courses.find((existingCourse) => existingCourse.id === courseId);
    if (!course) return;

    const round = createRoundFromCourse(course, {
      id: `round-${Date.now()}`,
      startedAt: new Date().toISOString()
    });
    const nextRounds = [...rounds, round];

    setRounds(nextRounds);
    persist(customCourses, nextRounds);
    setSelectedCourseId(undefined);
    setActiveRoundId(round.id);
    setSummaryRoundId(undefined);
    setActiveTab('play');
  }

  function changeRoundStrokes(roundId: string, holeNumber: number, strokes: number | undefined): void {
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
    persist(customCourses, nextRounds);
  }

  function finishRound(roundId: string): void {
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
    persist(customCourses, nextRounds);
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Golf Scorecard</p>
        <h1>{activeTab === 'history' ? 'History' : activeTab === 'courses' ? 'Courses' : 'Start a round'}</h1>
      </header>
      {storageError ? <p className="error-list" role="alert">{storageError}</p> : null}
      {activeRound ? <ActiveRound round={activeRound} onBack={() => showCourseList('play')} onChangeStrokes={(holeNumber, strokes) => changeRoundStrokes(activeRound.id, holeNumber, strokes)} onFinishRound={() => finishRound(activeRound.id)} /> : null}
      {!activeRound && summaryRound ? <RoundSummary round={summaryRound} onBack={() => showCourseList(activeTab)} /> : null}
      {!activeRound && !summaryRound && editingCourseId ? <CourseForm course={editingCourse} onSave={saveCustomCourse} onCancel={() => showCourseList('courses')} /> : null}
      {!activeRound && !summaryRound && !editingCourseId && selectedCourse ? <CourseDetail course={selectedCourse} onBack={() => setSelectedCourseId(undefined)} onStartRound={startRound} onEditCourse={editCourse} /> : null}
      {!activeRound && !summaryRound && !editingCourseId && !selectedCourse && activeTab !== 'history' ? (
        <>
          {activeTab === 'courses' ? <button className="primary-button" onClick={createCourse}>Create course</button> : null}
          <CourseList courses={courses} query={query} inProgressRound={inProgressRound} onQueryChange={setQuery} onSelectCourse={selectCourse} onResumeRound={resumeRound} />
        </>
      ) : null}
      {!activeRound && !summaryRound && !editingCourseId && !selectedCourse && activeTab === 'history' ? <RoundHistory rounds={rounds} onOpenRound={openCompletedRound} /> : null}
      {!activeRound ? <BottomNav activeTab={activeTab} onSelect={showCourseList} /> : null}
    </main>
  );
}
