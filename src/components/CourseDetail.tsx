import { calculateCoursePar } from '../domain/courses';
import type { Course } from '../domain/types';

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
            {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
            {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
          </div>
        ))}
      </div>
      <button className="primary-button" onClick={() => onStartRound(course.id)}>Start round</button>
      {course.source === 'custom' ? (
        <button className="secondary-button" onClick={() => onEditCourse(course.id)}>Edit course</button>
      ) : null}
    </section>
  );
}
