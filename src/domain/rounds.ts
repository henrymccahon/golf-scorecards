import type { Course, Round } from './types';

export interface RoundTotals {
  completedHoles: number;
  totalStrokes: number;
  playedPar: number;
  scoreToPar: number;
  totalPar: number;
  frontNineStrokes: number;
  frontNinePar: number;
  backNineStrokes: number;
  backNinePar: number;
}

export type RoundResumeTarget = { mode: 'scoring'; holeNumber: number } | { mode: 'review' };

export function normalizeStrokes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function getDisplayStrokes(value: unknown): number {
  return normalizeStrokes(value) ?? 0;
}

export function getFirstUnplayedHoleNumber(round: Round): number | undefined {
  const scoreByHole = new Map(round.scores.map((score) => [score.holeNumber, score]));
  const firstUnplayedHole = round.courseSnapshot.holes.find((hole) =>
    normalizeStrokes(scoreByHole.get(hole.number)?.strokes) === undefined
  );

  return firstUnplayedHole?.number;
}

export function getRoundResumeTarget(round: Round): RoundResumeTarget {
  const firstUnplayedHoleNumber = getFirstUnplayedHoleNumber(round);

  if (firstUnplayedHoleNumber !== undefined) {
    return { mode: 'scoring', holeNumber: firstUnplayedHoleNumber };
  }

  if (round.courseSnapshot.holes.length === 0) {
    return { mode: 'scoring', holeNumber: 1 };
  }

  return { mode: 'review' };
}

export function adjustStrokes(value: unknown, delta: 1 | -1): number | undefined {
  const nextValue = getDisplayStrokes(value) + delta;
  return nextValue > 0 ? nextValue : undefined;
}

export function createRoundFromCourse(
  course: Course,
  options: { id: string; startedAt: string; player?: string }
): Round {
  return {
    id: options.id,
    status: 'in_progress',
    courseId: course.id,
    courseSnapshot: {
      id: course.id,
      name: course.name,
      source: course.source,
      holeCount: course.holeCount,
      providerRef: course.providerRef ? { ...course.providerRef } : undefined,
      holes: course.holes.map((hole) => ({ ...hole }))
    },
    startedAt: options.startedAt,
    player: options.player ?? 'Player',
    scores: course.holes.map((hole) => ({ holeNumber: hole.number }))
  };
}

export function setHoleStrokes(round: Round, holeNumber: number, strokes: number | undefined): Round {
  if (!round.scores.some((score) => score.holeNumber === holeNumber)) {
    throw new Error(`Hole ${holeNumber} does not exist in this round.`);
  }

  if (strokes !== undefined && (!Number.isInteger(strokes) || strokes <= 0)) {
    throw new Error('Strokes must be a positive integer.');
  }

  return {
    ...round,
    scores: round.scores.map((score) =>
      score.holeNumber === holeNumber ? { ...score, strokes } : score
    )
  };
}

export function getRoundTotals(round: Round): RoundTotals {
  const completedScores = round.scores
    .map((score) => ({ ...score, strokes: normalizeStrokes(score.strokes) }))
    .filter((score) => score.strokes !== undefined);
  const holeByNumber = new Map(round.courseSnapshot.holes.map((hole) => [hole.number, hole]));

  const totalPar = round.courseSnapshot.holes.reduce((sum, hole) => sum + hole.par, 0);
  const totalStrokes = completedScores.reduce((sum, score) => sum + score.strokes!, 0);
  const playedPar = completedScores.reduce((sum, score) => sum + (holeByNumber.get(score.holeNumber)?.par ?? 0), 0);

  const frontScores = completedScores.filter((score) => score.holeNumber <= 9);
  const backScores = completedScores.filter((score) => score.holeNumber > 9);

  return {
    completedHoles: completedScores.length,
    totalStrokes,
    playedPar,
    scoreToPar: totalStrokes - playedPar,
    totalPar,
    frontNineStrokes: frontScores.reduce((sum, score) => sum + score.strokes!, 0),
    frontNinePar: frontScores.reduce((sum, score) => sum + (holeByNumber.get(score.holeNumber)?.par ?? 0), 0),
    backNineStrokes: backScores.reduce((sum, score) => sum + score.strokes!, 0),
    backNinePar: backScores.reduce((sum, score) => sum + (holeByNumber.get(score.holeNumber)?.par ?? 0), 0)
  };
}

export function canCompleteRound(round: Round): boolean {
  return round.scores.length === round.courseSnapshot.holeCount &&
    round.scores.every((score) => normalizeStrokes(score.strokes) !== undefined);
}

export function completeRound(round: Round, completedAt: string): Round {
  if (!canCompleteRound(round)) {
    throw new Error('Every hole needs a valid stroke value before the round can be completed.');
  }

  return {
    ...round,
    status: 'completed',
    completedAt
  };
}
