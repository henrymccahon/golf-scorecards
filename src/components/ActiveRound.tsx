import type { Round } from '../domain/types';
import { canCompleteRound, getRoundTotals } from '../domain/rounds';

interface ActiveRoundProps {
  round: Round;
  onBack(): void;
  onChangeStrokes(holeNumber: number, strokes: number | undefined): void;
  onFinishRound(): void;
}

export function ActiveRound({ round, onBack, onChangeStrokes, onFinishRound }: ActiveRoundProps) {
  const totals = getRoundTotals(round);

  return (
    <section className="screen">
      <button className="text-button" onClick={onBack}>Back</button>
      <header className="screen-header">
        <h1>{round.courseSnapshot.name}</h1>
        <p>{totals.completedHoles}/{round.courseSnapshot.holeCount} holes · Total {totals.totalStrokes} · {formatScoreToPar(totals.scoreToPar)}</p>
      </header>
      <div className="score-entry-list">
        {round.courseSnapshot.holes.map((hole) => {
          const score = round.scores.find((entry) => entry.holeNumber === hole.number);
          return (
            <label key={hole.number} className="score-entry-row">
              <span>
                <strong>Hole {hole.number}</strong>
                <small>Par {hole.par}{hole.strokeIndex ? ` · SI ${hole.strokeIndex}` : ''}</small>
              </span>
              <input
                aria-label={`Hole ${hole.number} strokes`}
                inputMode="numeric"
                type="number"
                min="1"
                value={score?.strokes ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onChangeStrokes(hole.number, value === '' ? undefined : Number(value));
                }}
              />
            </label>
          );
        })}
      </div>
      <button className="primary-button" disabled={!canCompleteRound(round)} onClick={onFinishRound}>
        Finish round
      </button>
    </section>
  );
}

function formatScoreToPar(scoreToPar: number) {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}
