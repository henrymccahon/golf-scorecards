import { useState } from 'react';
import { BottomNav, type AppTab } from './components/BottomNav';
import { CourseDetail } from './components/CourseDetail';
import { CourseForm } from './components/CourseForm';
import { CourseList } from './components/CourseList';
import { seedCourses } from './data/seedCourses';
import type { Course, Round } from './domain/types';
import { createLocalScorecardStore } from './storage/localStore';

export function App() {
  const store = createLocalScorecardStore(window.localStorage);
  const [storedData] = useState(() => store.load());
  const [customCourses, setCustomCourses] = useState(storedData.customCourses);
  const [rounds] = useState<Round[]>(storedData.rounds);
  const [activeTab, setActiveTab] = useState<AppTab>('play');
  const [query, setQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>();
  const [editingCourseId, setEditingCourseId] = useState<string>();
  const courses = [...seedCourses, ...customCourses];
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const editingCourse = customCourses.find((course) => course.id === editingCourseId);
  const inProgressRound = rounds.find((round) => round.status === 'in_progress');

  function saveCustomCourse(course: Course): void {
    const nextCourses = customCourses.some((existingCourse) => existingCourse.id === course.id)
      ? customCourses.map((existingCourse) => existingCourse.id === course.id ? course : existingCourse)
      : [...customCourses, course];

    setCustomCourses(nextCourses);
    store.save({ customCourses: nextCourses, rounds });
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
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Golf Scorecard</p>
        <h1>{activeTab === 'history' ? 'History' : activeTab === 'courses' ? 'Courses' : 'Start a round'}</h1>
      </header>
      {editingCourseId ? <CourseForm course={editingCourse} onSave={saveCustomCourse} onCancel={() => showCourseList('courses')} /> : null}
      {!editingCourseId && selectedCourse ? <CourseDetail course={selectedCourse} onBack={() => setSelectedCourseId(undefined)} onStartRound={() => undefined} onEditCourse={editCourse} /> : null}
      {!editingCourseId && !selectedCourse && activeTab !== 'history' ? (
        <>
          {activeTab === 'courses' ? <button className="primary-button" onClick={createCourse}>Create course</button> : null}
          <CourseList courses={courses} query={query} inProgressRound={inProgressRound} onQueryChange={setQuery} onSelectCourse={selectCourse} onResumeRound={() => undefined} />
        </>
      ) : null}
      {!editingCourseId && !selectedCourse && activeTab === 'history' ? <section className="screen"><p>No completed rounds yet.</p></section> : null}
      <BottomNav activeTab={activeTab} onSelect={showCourseList} />
    </main>
  );
}
