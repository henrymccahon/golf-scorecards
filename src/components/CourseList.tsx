import { calculateCoursePar, getCourseSearchText } from '../domain/courses';
import type { Course, Round } from '../domain/types';

interface CourseListProps {
  courses: Course[];
  query: string;
  inProgressRound?: Round;
  onQueryChange(query: string): void;
  onSelectCourse(courseId: string): void;
  onResumeRound(roundId: string): void;
}

export function CourseList({
  courses,
  query,
  inProgressRound,
  onQueryChange,
  onSelectCourse,
  onResumeRound
}: CourseListProps) {
  const filteredCourses = courses.filter((course) =>
    getCourseSearchText(course).includes(query.trim().toLowerCase())
  );

  return (
    <section className="screen">
      {inProgressRound ? (
        <button className="resume-banner" onClick={() => onResumeRound(inProgressRound.id)}>
          Resume {inProgressRound.courseSnapshot.name}
        </button>
      ) : null}
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
    </section>
  );
}
