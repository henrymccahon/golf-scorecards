import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Round } from '../domain/types';
import { adjustStrokes, getDisplayStrokes, getRoundTotals } from '../domain/rounds';
import { HoleNavigator } from './HoleNavigator';
import { HoleScoreEntry } from './HoleScoreEntry';
import { ScorecardReview } from './ScorecardReview';

interface ActiveRoundProps {
  round: Round;
  onBack(): void;
  onChangeStrokes(holeNumber: number, strokes: number | undefined): void;
  onFinishRound(): void;
}

type ActiveRoundMode = 'scoring' | 'review';

export function ActiveRound({ round, onBack, onChangeStrokes, onFinishRound }: ActiveRoundProps) {
  const holes = round.courseSnapshot.holes;
  const firstHoleNumber = holes[0]?.number ?? 1;
  const [mode, setMode] = useState<ActiveRoundMode>('scoring');
  const [selectedHoleNumber, setSelectedHoleNumber] = useState(firstHoleNumber);

  useEffect(() => {
    setMode('scoring');
    setSelectedHoleNumber(firstHoleNumber);
  }, [firstHoleNumber, round.id]);

  const totals = getRoundTotals(round);
  const selectedIndex = Math.max(0, holes.findIndex((hole) => hole.number === selectedHoleNumber));
  const selectedHole = holes[selectedIndex] ?? holes[0];
  const selectedScore = round.scores.find((entry) => entry.holeNumber === selectedHole?.number);
  const displayStrokes = getDisplayStrokes(selectedScore?.strokes);

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
          aria-label={selectedIndex >= holes.length - 1 ? 'Review scorecard' : 'Next hole'}
          onClick={goToNextHole}
        >
          <span>{selectedIndex >= holes.length - 1 ? 'Review scorecard' : 'Next'}</span>
          {selectedIndex >= holes.length - 1 ? null : <ChevronRight aria-hidden="true" size={20} />}
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

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
