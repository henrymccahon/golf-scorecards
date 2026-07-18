import { canCompleteRound, getDisplayStrokes, getRoundTotals } from '../domain/rounds';
import type { Round } from '../domain/types';

interface ScorecardReviewProps {
  round: Round;
  onBackToScoring(): void;
  onEditHole(holeNumber: number): void;
  onFinishRound(): void;
}

export function ScorecardReview({ round, onBackToScoring, onEditHole, onFinishRound }: ScorecardReviewProps) {
  const totals = getRoundTotals(round);
  const scoreByHole = new Map(round.scores.map((score) => [score.holeNumber, score]));
  const missingHole = round.courseSnapshot.holes.find((hole) =>
    getDisplayStrokes(scoreByHole.get(hole.number)?.strokes) === 0
  );

  return (
    <section className="screen scorecard-review">
      <button className="text-button" type="button" onClick={onBackToScoring}>Back to scoring</button>
      <header className="screen-header">
        <h2>Scorecard review</h2>
        <p>{totals.completedHoles}/{round.courseSnapshot.holeCount} holes · Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
      </header>
      <div className="summary-strip">
        <span>Total {totals.totalStrokes}</span>
        <span>Par {totals.totalPar}</span>
        {round.courseSnapshot.holeCount === 18 ? <span>Out {totals.frontNineStrokes} · In {totals.backNineStrokes}</span> : null}
      </div>
      {missingHole ? (
        <div className="review-alert" role="status">
          <span>Hole {missingHole.number} still needs a score.</span>
          <button className="secondary-button" type="button" onClick={() => onEditHole(missingHole.number)}>
            Go to hole {missingHole.number}
          </button>
        </div>
      ) : null}
      <div className="review-grid" aria-label="Scorecard review holes">
        {round.courseSnapshot.holes.map((hole) => {
          const strokes = getDisplayStrokes(scoreByHole.get(hole.number)?.strokes);
          const scoreToPar = strokes > 0 ? strokes - hole.par : undefined;

          return (
            <button
              key={hole.number}
              type="button"
              className={strokes > 0 ? 'review-hole played' : 'review-hole'}
              onClick={() => onEditHole(hole.number)}
            >
              <strong>Hole {hole.number}</strong>
              <span>Par {hole.par}</span>
              <span>{strokes}</span>
              <small>{scoreToPar === undefined ? 'Unplayed' : formatScoreToPar(scoreToPar)}</small>
            </button>
          );
        })}
      </div>
      <button className="primary-button" type="button" disabled={!canCompleteRound(round)} onClick={onFinishRound}>
        Finish round
      </button>
    </section>
  );
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
