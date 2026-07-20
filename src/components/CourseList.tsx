import { calculateCoursePar, getCourseSearchText } from '../domain/courses';
import { getRoundResumeTarget, getRoundTotals } from '../domain/rounds';
import type { Course, Round } from '../domain/types';
import { createProviderIdentityKey } from '../providers/providerCourseMapper';
import type { CourseSearchResult } from '../providers/types';
import { AbandonRoundConfirmation } from './AbandonRoundConfirmation';

export type ProviderSearchStatus = 'idle' | 'searching' | 'loading' | 'error';

interface CourseListProps {
  courses: Course[];
  query: string;
  inProgressRounds: Round[];
  abandonCandidateRoundId?: string;
  providerResults?: CourseSearchResult[];
  providerStatus?: ProviderSearchStatus;
  providerError?: string;
  onQueryChange(query: string): void;
  onSelectCourse(courseId: string): void;
  onResumeRound(roundId: string): void;
  onRequestAbandonRound(roundId: string): void;
  onCancelAbandonRound(): void;
  onConfirmAbandonRound(roundId: string): void;
  onSelectProviderResult?(result: CourseSearchResult): void;
  onCreateCourse?(): void;
}

export function CourseList({
  courses,
  query,
  inProgressRounds,
  abandonCandidateRoundId,
  providerResults = [],
  providerStatus = 'idle',
  providerError,
  onQueryChange,
  onSelectCourse,
  onResumeRound,
  onRequestAbandonRound,
  onCancelAbandonRound,
  onConfirmAbandonRound,
  onSelectProviderResult,
  onCreateCourse
}: CourseListProps) {
  const filteredCourses = courses.filter((course) =>
    getCourseSearchText(course).includes(query.trim().toLowerCase())
  );

  return (
    <section className="screen">
      {inProgressRounds.map((round) => {
        const totals = getRoundTotals(round);
        const resumeTarget = getRoundResumeTarget(round);
        const nextAction = resumeTarget.mode === 'review' ? 'Ready to review' : `Next: Hole ${resumeTarget.holeNumber}`;
        const progress = `${totals.completedHoles}/${round.courseSnapshot.holeCount} holes`;
        const totalLabel = `Total ${totals.totalStrokes}`;
        const scoreLabel = formatScoreToPar(totals.scoreToPar);

        return (
          <div key={round.id} className="resume-card">
            <button
              className="resume-banner"
              aria-label={`Resume ${round.courseSnapshot.name}, ${progress}, ${totalLabel}, ${scoreLabel}, ${nextAction}`}
              onClick={() => onResumeRound(round.id)}
            >
              <span>
                <strong>{round.courseSnapshot.name}</strong>
                <small>{progress} · {totalLabel} · {scoreLabel}</small>
              </span>
              <span className="resume-action">{nextAction}</span>
            </button>
            <div className="resume-card-actions">
              <button
                className="text-button abandon-action"
                type="button"
                aria-label={`Abandon ${round.courseSnapshot.name}`}
                onClick={() => onRequestAbandonRound(round.id)}
              >
                Abandon
              </button>
            </div>
            {abandonCandidateRoundId === round.id ? (
              <AbandonRoundConfirmation
                courseName={round.courseSnapshot.name}
                onCancel={onCancelAbandonRound}
                onConfirm={() => onConfirmAbandonRound(round.id)}
              />
            ) : null}
          </div>
        );
      })}
      <label className="field">
        <span>Search courses</span>
        <input
          aria-label="Search courses"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div className="course-list">
        {filteredCourses.map((course) => (
          <button key={course.id} className="course-row" onClick={() => onSelectCourse(course.id)}>
            <span>
              <strong>{course.name}</strong>
              <small>
                {course.holeCount} holes · Par {calculateCoursePar(course)} · {course.source}
              </small>
            </span>
          </button>
        ))}
      </div>
      {providerStatus === 'searching' ? <p className="provider-status">Searching provided courses...</p> : null}
      {providerError ? <p className="error-list" role="alert">{providerError}</p> : null}
      {providerResults.length > 0 ? (
        <section className="provider-results" aria-label="Provided courses">
          <h2>Provided courses</h2>
          <div className="course-list">
            {providerResults.map((result) => (
              <button
                key={createProviderIdentityKey(result.providerId, result.externalCourseId)}
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
    </section>
  );
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
