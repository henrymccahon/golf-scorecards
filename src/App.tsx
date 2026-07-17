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
