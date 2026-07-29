import { useState } from 'react';

import type { Place } from '../types';
import { hostname, mapsLink, priceLabel } from '../utils';
import { PlaceList } from './PlaceList';

interface PlannedTabProps {
  places: Place[];
  onOpen: (placeId: number) => void;
  showSummaries: boolean;
}

export function PlannedTab({ places, onOpen, showSummaries }: PlannedTabProps) {
  const [pick, setPick] = useState<Place | null>(null);

  function pickRandom() {
    if (places.length === 0) return;

    // With more than one option, never hand back the same suggestion twice in
    // a row — re-rolling and getting the same place feels broken.
    const pool = places.length > 1 && pick ? places.filter((place) => place.id !== pick.id) : places;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  }

  const suggestion = pick && places.some((place) => place.id === pick.id) ? pick : null;

  return (
    <PlaceList
      places={places}
      onOpen={onOpen}
      showSummaries={showSummaries}
      defaultSort="recent"
      emptyState={
        <div className="empty">
          <p className="empty-title">Nothing on the list.</p>
          <p className="muted">
            Places you add show up here until you rate them or set a visit date.
          </p>
        </div>
      }
    >
      <div className="planned-head">
        <div>
          <h2 className="tab-title">Planned</h2>
          <p className="muted small">
            {places.length === 0
              ? 'Nowhere lined up yet.'
              : `${places.length} place${places.length === 1 ? '' : 's'} you haven't been to yet.`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={pickRandom}
          disabled={places.length === 0}
        >
          🎲 Pick random
        </button>
      </div>

      {suggestion && (
        <div className="suggestion">
          <div className="suggestion-body">
            <p className="suggestion-kicker">Tonight, try…</p>
            <h3 className="suggestion-name">{suggestion.name}</h3>
            {suggestion.address && <p className="muted">{suggestion.address}</p>}

            <p className="suggestion-meta">
              {suggestion.googleRating !== null && (
                <span className="chip chip-google">
                  G ★ {suggestion.googleRating.toFixed(1)}
                  {suggestion.userRatingCount !== null && (
                    <span className="chip-count">{suggestion.userRatingCount.toLocaleString()}</span>
                  )}
                </span>
              )}
              {priceLabel(suggestion.priceLevel) && (
                <span className="chip">{priceLabel(suggestion.priceLevel)}</span>
              )}
            </p>

            {suggestion.summary && <p className="suggestion-summary">{suggestion.summary}</p>}

            <div className="suggestion-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => onOpen(suggestion.id)}>
                Open
              </button>
              <a
                className="btn btn-ghost btn-sm"
                href={mapsLink(suggestion)}
                target="_blank"
                rel="noreferrer noopener"
              >
                Directions
              </a>
              {suggestion.website && (
                <a
                  className="btn btn-ghost btn-sm"
                  href={suggestion.website}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {hostname(suggestion.website)}
                </a>
              )}
              <button className="btn btn-ghost btn-sm" type="button" onClick={pickRandom}>
                Pick again
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPick(null)}>
                Dismiss
              </button>
            </div>
          </div>

          {(suggestion.coverUrl || suggestion.logoUrl) && (
            <img
              className="suggestion-image"
              src={suggestion.coverUrl ?? suggestion.logoUrl!}
              alt=""
              loading="lazy"
            />
          )}
        </div>
      )}
    </PlaceList>
  );
}
