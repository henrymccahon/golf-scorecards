import { useState } from 'react';
import { validateCourse } from '../domain/courses';
import type { Course, Hole, HoleCount } from '../domain/types';

interface CourseFormProps {
  course?: Course;
  onSave(course: Course): void;
  onCancel(): void;
}

function makeHoles(holeCount: HoleCount, existingHoles: Hole[] = []): Hole[] {
  return Array.from({ length: holeCount }, (_, index) => {
    const existing = existingHoles[index];
    return existing ?? { number: index + 1, par: 4 };
  });
}

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}

export function CourseForm({ course, onSave, onCancel }: CourseFormProps) {
  const [name, setName] = useState(course?.name ?? '');
  const [holeCount, setHoleCount] = useState<HoleCount>(course?.holeCount ?? 9);
  const [holes, setHoles] = useState<Hole[]>(() => makeHoles(course?.holeCount ?? 9, course?.holes));
  const [errors, setErrors] = useState<string[]>([]);

  function updateHole(index: number, field: keyof Omit<Hole, 'number' | 'teeDistanceUnit'>, value: string): void {
    setHoles((currentHoles) => currentHoles.map((hole, holeIndex) => (
      holeIndex === index ? { ...hole, [field]: optionalNumber(value) } : hole
    )));
  }

  function changeHoleCount(value: HoleCount): void {
    setHoleCount(value);
    setHoles((currentHoles) => makeHoles(value, currentHoles));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const now = new Date().toISOString();
    const nextCourse: Course = {
      id: course?.id ?? `custom-${Date.now()}`,
      name,
      source: 'custom',
      holeCount,
      holes,
      createdAt: course?.createdAt ?? now,
      updatedAt: now
    };
    const validationErrors = validateCourse(nextCourse);

    setErrors(validationErrors);
    if (validationErrors.length === 0) {
      onSave(nextCourse);
    }
  }

  return (
    <section className="screen">
      <button className="text-button" onClick={onCancel}>Back</button>
      <header className="screen-header">
        <h1>{course ? 'Edit course' : 'Create course'}</h1>
      </header>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">Course name<input aria-label="Course name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field">
          Hole count
          <select value={holeCount} onChange={(event) => changeHoleCount(Number(event.target.value) as HoleCount)}>
            <option value={9}>9 holes</option>
            <option value={18}>18 holes</option>
          </select>
        </label>
        {holes.map((hole, index) => (
          <div key={hole.number} className="hole-form">
            <strong>Hole {hole.number}</strong>
            <label>Par<input aria-label={`Hole ${hole.number} par`} type="number" min="1" value={hole.par ?? ''} onChange={(event) => updateHole(index, 'par', event.target.value)} /></label>
            <label>Stroke index<input aria-label={`Hole ${hole.number} stroke index`} type="number" min="1" value={hole.strokeIndex ?? ''} onChange={(event) => updateHole(index, 'strokeIndex', event.target.value)} /></label>
            <label>Tee distance<input aria-label={`Hole ${hole.number} tee distance`} type="number" min="1" value={hole.teeDistance ?? ''} onChange={(event) => updateHole(index, 'teeDistance', event.target.value)} /></label>
          </div>
        ))}
        {errors.length > 0 ? <ul className="error-list">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
        <button className="primary-button" type="submit">Save course</button>
      </form>
    </section>
  );
}
