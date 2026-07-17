import type { Course } from './types';

export function calculateCoursePar(course: Course): number {
  return course.holes.reduce((total, hole) => total + hole.par, 0);
}

export function getCourseSearchText(course: Course): string {
  return `${course.name} ${course.source} ${course.holeCount}`.toLowerCase();
}

export function validateCourse(course: Course): string[] {
  const errors: string[] = [];

  if (course.name.trim().length === 0) {
    errors.push('Course name is required.');
  }

  if (course.holes.length !== course.holeCount) {
    errors.push(`Course must contain exactly ${course.holeCount} holes.`);
  }

  const seenStrokeIndexes = new Map<number, number>();

  for (const hole of course.holes) {
    if (!Number.isInteger(hole.par) || hole.par <= 0) {
      errors.push(`Hole ${hole.number} must have a positive par value.`);
    }

    if (hole.strokeIndex !== undefined) {
      if (!Number.isInteger(hole.strokeIndex) || hole.strokeIndex <= 0) {
        errors.push(`Hole ${hole.number} stroke index must be a positive integer.`);
      } else {
        const priorHole = seenStrokeIndexes.get(hole.strokeIndex);
        if (priorHole !== undefined) {
          errors.push(`Stroke index ${hole.strokeIndex} is used more than once.`);
        }
        seenStrokeIndexes.set(hole.strokeIndex, hole.number);
      }
    }

    if (hole.teeDistance !== undefined && (!Number.isFinite(hole.teeDistance) || hole.teeDistance <= 0)) {
      errors.push(`Hole ${hole.number} tee distance must be a positive number.`);
    }
  }

  return errors;
}
