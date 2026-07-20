import { calculateCoursePar, getCourseSourceLabel } from '../domain/courses';
import type { Course } from '../domain/types';

export type CourseDetailRoundAction =
  | { type: 'start' }
  | { type: 'resume'; roundId: string; courseName: string; progressLabel: string }
  | { type: 'blocked'; roundId: string; courseName: string; progressLabel: string };

interface CourseDetailProps {
  course: Course;
  roundAction?: CourseDetailRoundAction;
  onBack(): void;
  onStartRound(courseId: string): void;
  onResumeRound(roundId: string): void;
  onEditCourse(courseId: string): void;
}

export function CourseDetail({
  course,
  roundAction = { type: 'start' },
  onBack,
  onStartRound,
  onResumeRound,
  onEditCourse
}: CourseDetailProps) {
  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{course.name}</h1>
        <p>{course.holeCount} holes · Par {calculateCoursePar(course)} · {getCourseSourceLabel(course)}</p>
      </header>
      <div className="scorecard-grid">
        {course.holes.map((hole) => (
          <div
            key={hole.number}
            className="hole-card course-detail-hole-card"
            data-testid={`course-detail-hole-${hole.number}`}
          >
            <strong>Hole {hole.number}</strong>
            <div className="course-detail-hole-meta" data-testid={`course-detail-hole-${hole.number}-metadata`}>
              <span>Par {hole.par}</span>
              {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
              {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
            </div>
          </div>
        ))}
      </div>
      {roundAction.type === 'start' ? (
        <button className="primary-button" onClick={() => onStartRound(course.id)}>Start round</button>
      ) : null}
      {roundAction.type === 'resume' ? (
        <div className="round-action-panel">
          <p className="round-action-note">{roundAction.progressLabel}</p>
          <button className="primary-button" onClick={() => onResumeRound(roundAction.roundId)}>Resume round</button>
        </div>
      ) : null}
      {roundAction.type === 'blocked' ? (
        <div className="blocked-round-panel" role="status">
          <p>Finish or abandon {roundAction.courseName} before starting another round.</p>
          <p className="round-action-note">{roundAction.progressLabel}</p>
          <button className="secondary-button" onClick={() => onResumeRound(roundAction.roundId)}>
            Resume {roundAction.courseName}
          </button>
        </div>
      ) : null}
      {course.source === 'custom' ? (
        <button className="secondary-button" onClick={() => onEditCourse(course.id)}>Edit course</button>
      ) : null}
    </section>
  );
}
