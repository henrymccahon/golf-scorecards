import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Round } from '../domain/types';
import { adjustStrokes, getDisplayStrokes, getRoundTotals, type RoundResumeTarget } from '../domain/rounds';
import { HoleNavigator } from './HoleNavigator';
import { HoleScoreEntry } from './HoleScoreEntry';
import { ScorecardReview } from './ScorecardReview';

interface ActiveRoundProps {
  round: Round;
  initialTarget?: RoundResumeTarget;
  onBack(): void;
  onChangeStrokes(holeNumber: number, strokes: number | undefined): void;
  onFinishRound(): void;
}

type ActiveRoundMode = 'scoring' | 'review';

export function ActiveRound({ round, initialTarget, onBack, onChangeStrokes, onFinishRound }: ActiveRoundProps) {
  const holes = round.courseSnapshot.holes;
  const firstHoleNumber = holes[0]?.number ?? 1;
  const [mode, setMode] = useState<ActiveRoundMode>(() => getInitialMode(initialTarget));
  const [selectedHoleNumber, setSelectedHoleNumber] = useState(() => getInitialHoleNumber(initialTarget, firstHoleNumber));
  const initialTargetHoleNumber = initialTarget?.mode === 'scoring' ? initialTarget.holeNumber : undefined;

  useEffect(() => {
    setMode(getInitialMode(initialTarget));
    setSelectedHoleNumber(getInitialHoleNumber(initialTarget, firstHoleNumber));
  }, [firstHoleNumber, round.id, initialTarget?.mode, initialTargetHoleNumber]);

  const totals = getRoundTotals(round);
  const selectedIndex = Math.max(0, holes.findIndex((hole) => hole.number === selectedHoleNumber));
  const selectedHole = holes[selectedIndex] ?? holes[0];
  const selectedScore = round.scores.find((entry) => entry.holeNumber === selectedHole?.number);
  const displayStrokes = getDisplayStrokes(selectedScore?.strokes);
  const isLastHole = selectedIndex >= holes.length - 1;

  function changeSelectedStrokes(delta: 1 | -1): void {
    if (!selectedHole) return;
    onChangeStrokes(selectedHole.number, adjustStrokes(selectedScore?.strokes, delta));
  }

  function selectHole(holeNumber: number): void {
    setSelectedHoleNumber(holeNumber);
    setMode('scoring');
  }

  function goToPreviousHole(): void {
    if (selectedIndex <= 0) return;
    setSelectedHoleNumber(holes[selectedIndex - 1].number);
  }

  function goToNextHole(): void {
    if (selectedIndex >= holes.length - 1) {
      setMode('review');
      return;
    }
    setSelectedHoleNumber(holes[selectedIndex + 1].number);
  }

  if (mode === 'review') {
    return (
      <ScorecardReview
        round={round}
        onBackToScoring={() => setMode('scoring')}
        onEditHole={selectHole}
        onFinishRound={onFinishRound}
      />
    );
  }

  return (
    <section className="screen active-round-screen">
      <button className="text-button" type="button" onClick={onBack}>Back</button>
      <header className="screen-header active-round-header">
        <div>
          <h1>{round.courseSnapshot.name}</h1>
          <p>{totals.completedHoles}/{round.courseSnapshot.holeCount} holes · Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
        </div>
      </header>
      {selectedHole ? (
        <HoleScoreEntry
          hole={selectedHole}
          displayStrokes={displayStrokes}
          scoreContext={getHoleScoreContext(selectedScore?.strokes, selectedHole.par)}
          onIncrement={() => changeSelectedStrokes(1)}
          onDecrement={() => changeSelectedStrokes(-1)}
        />
      ) : null}
      <div className="hole-navigation-controls">
        <button
          className="secondary-button"
          type="button"
          aria-label="Previous hole"
          disabled={selectedIndex <= 0}
          onClick={goToPreviousHole}
        >
          <ChevronLeft aria-hidden="true" size={20} />
          <span>Previous</span>
        </button>
        <button
          className="primary-button"
          type="button"
          aria-label={isLastHole ? 'Review scorecard' : 'Next hole'}
          onClick={goToNextHole}
        >
          <span>{isLastHole ? 'Review' : 'Next'}</span>
          {isLastHole ? null : <ChevronRight aria-hidden="true" size={20} />}
        </button>
      </div>
      <HoleNavigator
        holes={holes}
        scores={round.scores}
        selectedHoleNumber={selectedHole?.number ?? firstHoleNumber}
        onSelectHole={selectHole}
      />
    </section>
  );
}

function getInitialMode(initialTarget: RoundResumeTarget | undefined): ActiveRoundMode {
  return initialTarget?.mode ?? 'scoring';
}

function getInitialHoleNumber(initialTarget: RoundResumeTarget | undefined, firstHoleNumber: number): number {
  return initialTarget?.mode === 'scoring' ? initialTarget.holeNumber : firstHoleNumber;
}

function getHoleScoreContext(strokes: number | undefined, par: number): string {
  if (strokes === undefined) return 'No score yet';

  const scoreToPar = strokes - par;
  if (scoreToPar === 0) return 'Even on this hole';
  return `${formatScoreToPar(scoreToPar)} on this hole`;
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
