import type { Round } from '../domain/types';
import { getRoundTotals } from '../domain/rounds';

interface RoundSummaryProps {
  round: Round;
  onBack(): void;
}

export function RoundSummary({ round, onBack }: RoundSummaryProps) {
  const totals = getRoundTotals(round);

  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{round.courseSnapshot.name}</h1>
        <p>Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
        <p>Played {new Date(round.completedAt ?? round.startedAt).toLocaleDateString()}</p>
      </header>
      <div className="summary-strip">
        <span>Total {totals.totalStrokes}</span>
        <span>Par {totals.totalPar}</span>
        {round.courseSnapshot.holeCount === 18 && (
          <span>Out {totals.frontNineStrokes} · In {totals.backNineStrokes}</span>
        )}
      </div>
      <div className="scorecard-grid">
        {round.courseSnapshot.holes.map((hole) => {
          const score = round.scores.find((entry) => entry.holeNumber === hole.number);
          return (
            <div key={hole.number} className="hole-card">
              <strong>Hole {hole.number}</strong>
              <span>Par {hole.par}</span>
              <span>{score?.strokes ?? '-'} strokes</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
