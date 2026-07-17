import { describe, expect, it } from 'vitest';
import { createRoundFromCourse, completeRound, getRoundTotals, setHoleStrokes } from './rounds';
import type { Course } from './types';

const course: Course = {
  id: 'course-1',
  name: 'Test Links',
  source: 'custom',
  holeCount: 9,
  holes: Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    par: index === 0 ? 5 : 4,
    strokeIndex: index + 1
  }))
};

describe('round domain', () => {
  it('creates a round with a scorecard snapshot', () => {
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });

    expect(round.status).toBe('in_progress');
    expect(round.courseSnapshot.name).toBe('Test Links');
    expect(round.scores).toHaveLength(9);

    course.holes[0].par = 3;
    expect(round.courseSnapshot.holes[0].par).toBe(5);
  });

  it('calculates running totals against completed holes only', () => {
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });
    const updated = setHoleStrokes(setHoleStrokes(round, 1, 6), 2, 4);

    expect(getRoundTotals(updated)).toEqual({
      completedHoles: 2,
      totalStrokes: 10,
      playedPar: 9,
      scoreToPar: 1,
      totalPar: 37,
      frontNineStrokes: 10,
      frontNinePar: 9,
      backNineStrokes: 0,
      backNinePar: 0
    });
  });

  it('rejects invalid strokes and incomplete completion', () => {
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });

    expect(() => setHoleStrokes(round, 1, 0)).toThrow('Strokes must be a positive integer.');
    expect(() => completeRound(round, '2026-07-17T03:00:00.000Z')).toThrow('Every hole needs a valid stroke value before the round can be completed.');
  });
});
