import { getDisplayStrokes } from '../domain/rounds';
import type { Hole, ScoreEntry } from '../domain/types';

interface HoleNavigatorProps {
  holes: Hole[];
  scores: ScoreEntry[];
  selectedHoleNumber: number;
  onSelectHole(holeNumber: number): void;
}

export function HoleNavigator({ holes, scores, selectedHoleNumber, onSelectHole }: HoleNavigatorProps) {
  const scoreByHole = new Map(scores.map((score) => [score.holeNumber, score]));

  return (
    <nav className="hole-navigator" aria-label="Hole navigator">
      {holes.map((hole) => {
        const displayStrokes = getDisplayStrokes(scoreByHole.get(hole.number)?.strokes);
        const selected = hole.number === selectedHoleNumber;
        const stateLabel = displayStrokes > 0 ? `${displayStrokes} strokes` : 'unplayed';
        const selectedLabel = selected ? ', selected' : '';

        return (
          <button
            key={hole.number}
            type="button"
            className={selected ? 'selected' : displayStrokes > 0 ? 'played' : ''}
            aria-current={selected ? 'step' : undefined}
            aria-label={`Hole ${hole.number}, ${stateLabel}${selectedLabel}`}
            onClick={() => onSelectHole(hole.number)}
          >
            <span>{hole.number}</span>
            <small>{displayStrokes}</small>
          </button>
        );
      })}
    </nav>
  );
}
