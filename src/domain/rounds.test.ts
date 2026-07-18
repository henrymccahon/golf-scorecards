import { describe, expect, it } from 'vitest';
import { adjustStrokes, canCompleteRound, completeRound, createRoundFromCourse, getDisplayStrokes, getRoundTotals, normalizeStrokes, setHoleStrokes } from './rounds';
import type { Course, Round } from './types';

function makeCourse(): Course {
  return {
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
}

describe('round domain', () => {
  it('creates a round with a scorecard snapshot', () => {
    const course = makeCourse();
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

  it('copies provider metadata into the round snapshot', () => {
    const course: Course = {
      id: 'provided-demo-augusta-national',
      name: 'Augusta National',
      source: 'imported',
      holeCount: 9,
      providerRef: {
        providerId: 'demo',
        externalCourseId: 'augusta-national',
        providerName: 'Demo Provider',
        country: 'United States',
        region: 'Georgia',
        locality: 'Augusta',
        lastFetchedAt: '2026-07-18T00:00:00.000Z',
        attribution: 'Demo data'
      },
      holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 }))
    };

    const round = createRoundFromCourse(course, {
      id: 'round-provider',
      startedAt: '2026-07-18T01:00:00.000Z'
    });

    expect(round.courseSnapshot.providerRef).toEqual(course.providerRef);
  });

  it('calculates running totals against completed holes only', () => {
    const course = makeCourse();
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
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });

    expect(() => setHoleStrokes(round, 1, 0)).toThrow('Strokes must be a positive integer.');
    expect(() => completeRound(round, '2026-07-17T03:00:00.000Z')).toThrow('Every hole needs a valid stroke value before the round can be completed.');
  });

  it('normalizes nullish and invalid stroke values for display', () => {
    expect(normalizeStrokes(undefined)).toBeUndefined();
    expect(normalizeStrokes(null)).toBeUndefined();
    expect(normalizeStrokes(0)).toBeUndefined();
    expect(normalizeStrokes(-1)).toBeUndefined();
    expect(normalizeStrokes(2.5)).toBeUndefined();
    expect(normalizeStrokes('4')).toBeUndefined();
    expect(normalizeStrokes(4)).toBe(4);

    expect(getDisplayStrokes(undefined)).toBe(0);
    expect(getDisplayStrokes(null)).toBe(0);
    expect(getDisplayStrokes(0)).toBe(0);
    expect(getDisplayStrokes(4)).toBe(4);
  });

  it('adjusts displayed strokes without storing zero', () => {
    expect(adjustStrokes(undefined, 1)).toBe(1);
    expect(adjustStrokes(null, 1)).toBe(1);
    expect(adjustStrokes(4, 1)).toBe(5);
    expect(adjustStrokes(4, -1)).toBe(3);
    expect(adjustStrokes(1, -1)).toBeUndefined();
    expect(adjustStrokes(undefined, -1)).toBeUndefined();
    expect(adjustStrokes(0, -1)).toBeUndefined();
  });

  it('keeps completion blocked while any hole is unplayed', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });
    const almostComplete = round.scores.reduce((currentRound, score) => (
      score.holeNumber === 9 ? currentRound : setHoleStrokes(currentRound, score.holeNumber, 4)
    ), round);

    expect(canCompleteRound(almostComplete)).toBe(false);
    expect(canCompleteRound(setHoleStrokes(almostComplete, 9, 4))).toBe(true);
  });

  it('calculates totals from positive integer strokes only', () => {
    const course = makeCourse();
    const round = createRoundFromCourse(course, {
      id: 'round-1',
      startedAt: '2026-07-17T01:00:00.000Z'
    });
    const loadedRound = {
      ...round,
      scores: round.scores.map((score) => {
        if (score.holeNumber === 1) return { ...score, strokes: 5 };
        if (score.holeNumber === 2) return { ...score, strokes: null };
        if (score.holeNumber === 3) return { ...score, strokes: 0 };
        return score;
      })
    } as unknown as Round;

    expect(getRoundTotals(loadedRound)).toMatchObject({
      completedHoles: 1,
      totalStrokes: 5,
      playedPar: 5,
      scoreToPar: 0
    });
    expect(canCompleteRound(loadedRound)).toBe(false);
  });
});
