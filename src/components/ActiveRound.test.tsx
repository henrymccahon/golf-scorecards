import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveRound } from './ActiveRound';
import { createRoundFromCourse, setHoleStrokes } from '../domain/rounds';
import type { Course, Round } from '../domain/types';
import { renderApp } from '../test/render';

function makeCourse(holeCount: 9 | 18 = 9): Course {
  return {
    id: 'course-1',
    name: 'Test Course',
    source: 'custom',
    holeCount,
    holes: Array.from({ length: holeCount }, (_, index) => ({
      number: index + 1,
      par: index === 0 ? 5 : 4,
      strokeIndex: index + 1,
      teeDistance: 120 + index,
      teeDistanceUnit: 'yards'
    }))
  };
}

function makeRound(holeCount: 9 | 18 = 9): Round {
  return createRoundFromCourse(makeCourse(holeCount), {
    id: 'round-1',
    startedAt: '2026-07-18T01:00:00.000Z'
  });
}

function makeCompleteRound(holeCount: 9 | 18 = 9): Round {
  const round = makeRound(holeCount);
  return round.scores.reduce((currentRound, score) => (
    setHoleStrokes(currentRound, score.holeNumber, 4)
  ), round);
}

describe('ActiveRound mobile scoring', () => {
  it('opens to an initial scoring target when one is provided', () => {
    renderApp(
      <ActiveRound
        round={makeRound()}
        initialTarget={{ mode: 'scoring', holeNumber: 4 }}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Hole 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hole 4, unplayed, selected' })).toBeInTheDocument();
  });

  it('opens to review when the initial target is review', () => {
    renderApp(
      <ActiveRound
        round={makeCompleteRound()}
        initialTarget={{ mode: 'review' }}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Scorecard review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish round' })).toBeEnabled();
  });

  it('opens to hole 1 with metadata and an unplayed score displayed as zero', () => {
    renderApp(
      <ActiveRound
        round={makeRound()}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.getByText('Par 5')).toBeInTheDocument();
    expect(screen.getByText('SI 1')).toBeInTheDocument();
    expect(screen.getByText('120 yards')).toBeInTheDocument();
    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('0');
    expect(screen.getByText('No score yet')).toBeInTheDocument();
  });

  it('shows even score context for a hole scored at par', () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 5)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('5');
    expect(screen.getByText('Even on this hole')).toBeInTheDocument();
  });

  it('shows over-par score context for a hole scored above par', () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 6)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('6');
    expect(screen.getByText('+1 on this hole')).toBeInTheDocument();
  });

  it('shows under-par score context for a hole scored below par', () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 4)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('4');
    expect(screen.getByText('-1 on this hole')).toBeInTheDocument();
  });

  it('increments and decrements through domain stroke values without storing zero', async () => {
    const onChangeStrokes = vi.fn();
    const firstRender = renderApp(
      <ActiveRound
        round={makeRound()}
        onBack={() => undefined}
        onChangeStrokes={onChangeStrokes}
        onFinishRound={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    expect(onChangeStrokes).toHaveBeenLastCalledWith(1, 1);

    firstRender.unmount();
    const roundWithOneStroke = setHoleStrokes(makeRound(), 1, 1);
    renderApp(
      <ActiveRound
        round={roundWithOneStroke}
        onBack={() => undefined}
        onChangeStrokes={onChangeStrokes}
        onFinishRound={() => undefined}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Decrease hole 1 strokes' }));

    expect(onChangeStrokes).toHaveBeenLastCalledWith(1, undefined);
  });

  it('moves with previous and next controls and opens review from the last hole', async () => {
    renderApp(
      <ActiveRound
        round={makeRound()}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Previous hole' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next hole' }));
    expect(screen.getByRole('heading', { name: 'Hole 2' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous hole' }));
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    const reviewScorecardButton = screen.getByRole('button', { name: 'Review scorecard' });
    expect(reviewScorecardButton).toHaveTextContent(/^Review$/);
    await userEvent.click(reviewScorecardButton);

    expect(screen.getByRole('heading', { name: 'Scorecard review' })).toBeInTheDocument();
  });

  it('jumps through the compact navigator and marks played state', async () => {
    const round = setHoleStrokes(makeRound(), 1, 4);
    renderApp(
      <ActiveRound
        round={round}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Hole 1, 4 strokes, selected' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hole 3, unplayed' }));

    expect(screen.getByRole('heading', { name: 'Hole 3' })).toBeInTheDocument();
  });

  it('keeps finish disabled in review until all holes are played and can return to the first missing hole', async () => {
    renderApp(
      <ActiveRound
        round={setHoleStrokes(makeRound(), 1, 4)}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={() => undefined}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, unplayed/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));

    expect(screen.getByRole('button', { name: 'Finish round' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Go to hole 2' }));

    expect(screen.getByRole('heading', { name: 'Hole 2' })).toBeInTheDocument();
  });

  it('finishes only from the review screen', async () => {
    const onFinishRound = vi.fn();
    renderApp(
      <ActiveRound
        round={makeCompleteRound()}
        onBack={() => undefined}
        onChangeStrokes={() => undefined}
        onFinishRound={onFinishRound}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hole 9, 4 strokes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));

    expect(onFinishRound).toHaveBeenCalledTimes(1);
  });
});
