import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundHistory } from './RoundHistory';
import { RoundSummary } from './RoundSummary';
import type { Round } from '../domain/types';
import { renderApp } from '../test/render';

function makeRound(holeCount: 9 | 18, status: Round['status'] = 'completed'): Round {
  return {
    id: 'round-1',
    status,
    courseId: 'course-1',
    courseSnapshot: {
      id: 'course-1',
      name: 'Test Course',
      source: 'custom',
      holeCount,
      holes: Array.from({ length: holeCount }, (_, index) => ({
        number: index + 1,
        par: 4,
        teeDistance: 100 + index,
        teeDistanceUnit: 'yards'
      }))
    },
    startedAt: '2026-07-17T01:00:00.000Z',
    completedAt: status === 'completed' ? '2026-07-17T03:00:00.000Z' : undefined,
    player: 'Player',
    scores: Array.from({ length: holeCount }, (_, index) => ({ holeNumber: index + 1, strokes: 5 }))
  };
}

describe('round details', () => {
  it('shows the completed date in a round summary', () => {
    renderApp(<RoundSummary round={makeRound(9)} onBack={() => undefined} />);

    expect(screen.getByText(/Played/)).toBeInTheDocument();
  });

  it('shows score versus par in round history', () => {
    renderApp(<RoundHistory rounds={[makeRound(9)]} onOpenRound={() => undefined} />);

    expect(screen.getByText(/Total 45.*\+9/)).toBeInTheDocument();
  });
});
