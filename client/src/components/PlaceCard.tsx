import type { Place } from '../types';
import { formatVisitDate, priceLabel, subScoreAverage } from '../utils';
import { StarRating } from './StarRating';

interface PlaceCardProps {
  place: Place;
  onOpen: () => void;
  showSummary?: boolean;
}

export function PlaceCard({ place, onOpen, showSummary = true }: PlaceCardProps) {
  const average = subScoreAverage(place);
  const visited = formatVisitDate(place.visitDate);

  // Your own photo of the place beats Google's stock shot when you have one.
  const cover = place.photos[0]?.url ?? place.coverUrl;

  return (
    <button className="card" type="button" onClick={onOpen}>
      <div className="card-media">
        {cover ? (
          <img className="card-photo" src={cover} alt="" loading="lazy" />
        ) : (
          <div className="card-photo card-photo-empty" aria-hidden="true">
            🍕
          </div>
        )}

        {place.logoUrl && (
          <span className="card-logo">
            <img src={place.logoUrl} alt={`${place.name} logo`} loading="lazy" />
          </span>
        )}
      </div>

      <div className={`card-body ${place.logoUrl ? 'card-body-with-logo' : ''}`}>
        <div className="card-head">
          <h3 className="card-title">{place.name}</h3>
          {place.wouldReturn !== null && (
            <span className={`pill ${place.wouldReturn ? 'pill-yes' : 'pill-no'}`}>
              {place.wouldReturn ? 'Would return' : 'Would not return'}
            </span>
          )}
        </div>

        {place.address && <p className="card-address muted">{place.address}</p>}

        <div className="card-rating">
          <StarRating value={place.rating} size="sm" />
          {average !== null && (
            <span className="chip" title="Average of your sub-scores">
              {average.toFixed(1)}/10
            </span>
          )}
          {place.googleRating !== null && (
            <span
              className="chip chip-google"
              title={`Google rating${place.userRatingCount ? ` from ${place.userRatingCount.toLocaleString()} reviews` : ''}`}
            >
              G ★ {place.googleRating.toFixed(1)}
              {place.userRatingCount !== null && (
                <span className="chip-count">{place.userRatingCount.toLocaleString()}</span>
              )}
            </span>
          )}
          {priceLabel(place.priceLevel) && <span className="chip">{priceLabel(place.priceLevel)}</span>}
        </div>

        {showSummary && place.summary && <p className="card-summary">{place.summary}</p>}
        {place.notes && <p className="card-notes">{place.notes}</p>}

        <div className="card-foot muted">
          {visited ? <span>Visited {visited}</span> : <span>No visit date</span>}
          {place.photos.length > 0 && (
            <span>
              {place.photos.length} photo{place.photos.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
