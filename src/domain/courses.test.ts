import { describe, expect, it } from 'vitest';
import { calculateCoursePar, getCourseSearchText, validateCourse } from './courses';
import type { Course } from './types';

const validNine: Course = {
  id: 'course-nine',
  name: 'Lakeview Nine',
  source: 'custom',
  holeCount: 9,
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
  holes: Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    par: index === 1 ? 5 : index === 4 ? 3 : 4,
    strokeIndex: index + 1,
    teeDistance: 300 + index * 10,
    teeDistanceUnit: 'meters'
  }))
};

describe('course domain', () => {
  it('accepts a complete 9-hole course', () => {
    expect(validateCourse(validNine)).toEqual([]);
    expect(calculateCoursePar(validNine)).toBe(36);
  });

  it('rejects missing names, wrong hole counts, duplicate stroke indexes, and invalid distances', () => {
    const course: Course = {
      ...validNine,
      name: ' ',
      holeCount: 18,
      holes: [
        { number: 1, par: 0, strokeIndex: 1, teeDistance: -20, teeDistanceUnit: 'meters' },
        { number: 2, par: 4, strokeIndex: 1 }
      ]
    };

    expect(validateCourse(course)).toEqual([
      'Course name is required.',
      'Course must contain exactly 18 holes.',
      'Hole 1 must have a positive par value.',
      'Hole 1 tee distance must be a positive number.',
      'Stroke index 1 is used more than once.'
    ]);
  });

  it('builds searchable text from course name and source', () => {
    expect(getCourseSearchText(validNine)).toBe('lakeview nine custom 9');
  });
});
