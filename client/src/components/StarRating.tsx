interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const STARS = [1, 2, 3, 4, 5];

export function StarRating({ value, onChange, size = 'md', label }: StarRatingProps) {
  const rating = value ?? 0;
  const readOnly = !onChange;

  // Clicking the half you're already on clears the rating, so it can be undone.
  const select = (next: number) => onChange?.(next === value ? null : next);

  return (
    <div
      className={`stars stars-${size} ${readOnly ? 'stars-readonly' : ''}`}
      role={readOnly ? 'img' : 'group'}
      aria-label={
        readOnly ? `${value ?? 'No'} out of 5 stars` : (label ?? 'Overall rating out of 5 stars')
      }
    >
      {STARS.map((star) => {
        const fill = Math.max(0, Math.min(1, rating - (star - 1)));
        return (
          <span className="star" key={star}>
            <span className="star-glyph star-empty">★</span>
            <span className="star-glyph star-filled" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="star-hit star-hit-half"
                  onClick={() => select(star - 0.5)}
                  aria-label={`Rate ${star - 0.5} out of 5`}
                />
                <button
                  type="button"
                  className="star-hit star-hit-full"
                  onClick={() => select(star)}
                  aria-label={`Rate ${star} out of 5`}
                />
              </>
            )}
          </span>
        );
      })}
      {!readOnly && <span className="stars-value">{value === null ? 'Not rated' : value.toFixed(1)}</span>}
    </div>
  );
}
