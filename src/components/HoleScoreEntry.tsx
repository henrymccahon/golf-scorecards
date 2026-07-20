import { Minus, Plus } from 'lucide-react';
import type { Hole } from '../domain/types';

interface HoleScoreEntryProps {
  hole: Hole;
  displayStrokes: number;
  scoreContext: string;
  onIncrement(): void;
  onDecrement(): void;
}

export function HoleScoreEntry({ hole, displayStrokes, scoreContext, onIncrement, onDecrement }: HoleScoreEntryProps) {
  return (
    <section className="hole-score-entry" aria-labelledby={`hole-${hole.number}-title`}>
      <div className="hole-title-row">
        <div>
          <p className="eyebrow">Current hole</p>
          <h2 id={`hole-${hole.number}-title`}>Hole {hole.number}</h2>
        </div>
        <div className="hole-meta" aria-label={`Hole ${hole.number} details`}>
          <span>Par {hole.par}</span>
          {hole.strokeIndex ? <span>SI {hole.strokeIndex}</span> : null}
          {hole.teeDistance ? <span>{hole.teeDistance} {hole.teeDistanceUnit ?? 'meters'}</span> : null}
        </div>
      </div>
      <div className="score-control" aria-label={`Hole ${hole.number} score controls`}>
        <button
          className="score-stepper-button"
          type="button"
          aria-label={`Decrease hole ${hole.number} strokes`}
          disabled={displayStrokes === 0}
          onClick={onDecrement}
        >
          <Minus aria-hidden="true" size={28} />
        </button>
        <div className="score-value-group">
          <output className="score-value" aria-label={`Hole ${hole.number} displayed score`}>
            {displayStrokes}
          </output>
          <p className="score-context">{scoreContext}</p>
        </div>
        <button
          className="score-stepper-button"
          type="button"
          aria-label={`Increase hole ${hole.number} strokes`}
          onClick={onIncrement}
        >
          <Plus aria-hidden="true" size={28} />
        </button>
      </div>
    </section>
  );
}
