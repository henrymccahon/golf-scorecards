import type { Round } from '../domain/types';
import { getRoundTotals } from '../domain/rounds';

interface RoundHistoryProps {
  rounds: Round[];
  onOpenRound(roundId: string): void;
}

export function RoundHistory({ rounds, onOpenRound }: RoundHistoryProps) {
  const completedRounds = rounds.filter((round) => round.status === 'completed');

  return (
    <section className="screen" aria-label="Round history">
      <header className="screen-header">
        <h1>Round history</h1>
      </header>
      {completedRounds.length === 0 ? (
        <p>No completed rounds yet.</p>
      ) : (
        <div className="course-list">
          {completedRounds.map((round) => {
            const totals = getRoundTotals(round);
            return (
              <button key={round.id} className="course-row" onClick={() => onOpenRound(round.id)}>
                <strong>{round.courseSnapshot.name}</strong>
                <small>Total {totals.totalStrokes} · {new Date(round.completedAt ?? round.startedAt).toLocaleDateString()}</small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
