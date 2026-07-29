interface ScoreSliderProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

/** A 0-10 sub-score with an explicit "not rated" state (null). */
export function ScoreSlider({ label, value, onChange }: ScoreSliderProps) {
  const rated = value !== null;

  return (
    <div className={`score ${rated ? '' : 'score-unset'}`}>
      <label className="score-label" htmlFor={`score-${label}`}>
        {label}
      </label>
      <input
        id={`score-${label}`}
        className="score-range"
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value ?? 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="score-value">{rated ? value.toFixed(1) : '—'}</span>
      <button
        type="button"
        className="score-clear"
        onClick={() => onChange(null)}
        disabled={!rated}
        title={`Clear ${label} score`}
        aria-label={`Clear ${label} score`}
      >
        ✕
      </button>
    </div>
  );
}
