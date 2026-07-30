import { useMemo, useState, type ReactNode } from 'react';

import type { Place } from '../types';
import { PlaceCard } from './PlaceCard';

export type SortKey = 'recent' | 'rating' | 'name' | 'visit';
export type RatedFilter = 'all' | 'rated' | 'unrated';
export type ReturnFilter = 'any' | 'yes' | 'no';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Newest' },
  { key: 'rating', label: 'Top rated' },
  { key: 'visit', label: 'Recent visit' },
  { key: 'name', label: 'A–Z' },
];

const RATED_FILTERS: { key: RatedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rated', label: 'Rated' },
  { key: 'unrated', label: 'Not rated' },
];

const RETURN_FILTERS: { key: ReturnFilter; label: string }[] = [
  { key: 'any', label: 'Any verdict' },
  { key: 'yes', label: 'Would return' },
  { key: 'no', label: 'Would not return' },
];

interface PlaceListProps {
  places: Place[];
  onOpen: (placeId: number) => void;
  /** Decides per place whether its Google synopsis appears on the card. */
  showSummaryFor: (place: Place) => boolean;
  /** Rating and verdict filters only make sense on the Visited tab. */
  showRatingFilters?: boolean;
  /**
   * Which rating "Top rated" orders by. Planned places have no rating of your
   * own yet, so there it sorts on Google's instead.
   */
  ratingSource?: 'yours' | 'google';
  defaultSort?: SortKey;
  emptyState: ReactNode;
  /** Rendered above the toolbar — used for the Planned tab's random pick. */
  children?: ReactNode;
}

export function PlaceList({
  places,
  onOpen,
  showSummaryFor,
  showRatingFilters = false,
  ratingSource = 'yours',
  defaultSort = 'recent',
  emptyState,
  children,
}: PlaceListProps) {
  const [filterText, setFilterText] = useState('');
  const [sort, setSort] = useState<SortKey>(defaultSort);
  const [ratedFilter, setRatedFilter] = useState<RatedFilter>('all');
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>('any');

  const visible = useMemo(() => {
    const needle = filterText.trim().toLowerCase();

    const matches = places.filter((place) => {
      if (showRatingFilters) {
        if (ratedFilter === 'rated' && place.rating === null) return false;
        if (ratedFilter === 'unrated' && place.rating !== null) return false;
        if (returnFilter === 'yes' && place.wouldReturn !== true) return false;
        if (returnFilter === 'no' && place.wouldReturn !== false) return false;
      }

      if (!needle) return true;
      return [place.name, place.address, place.notes]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });

    const sorted = [...matches];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'rating': {
          const score = (place: Place) =>
            (ratingSource === 'google' ? place.googleRating : place.rating) ?? -1;
          // Unrated places sink to the bottom rather than sorting as zero.
          return score(b) - score(a) || a.name.localeCompare(b.name);
        }
        case 'name':
          return a.name.localeCompare(b.name);
        case 'visit':
          return (b.visitDate ?? '').localeCompare(a.visitDate ?? '') || a.name.localeCompare(b.name);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return sorted;
  }, [places, filterText, sort, ratedFilter, returnFilter, showRatingFilters, ratingSource]);

  if (places.length === 0) return <>{children}{emptyState}</>;

  return (
    <>
      {children}

      <div className="toolbar">
        <input
          className="toolbar-search"
          type="search"
          placeholder="Search Restaurants…"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          aria-label="Filter places"
        />

        {showRatingFilters && (
          <>
            <label className="sort">
              <span className="visually-hidden">Filter by rating status</span>
              <select
                value={ratedFilter}
                onChange={(event) => setRatedFilter(event.target.value as RatedFilter)}
              >
                {RATED_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sort">
              <span className="visually-hidden">Filter by would-return verdict</span>
              <select
                value={returnFilter}
                onChange={(event) => setReturnFilter(event.target.value as ReturnFilter)}
              >
                {RETURN_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="sort">
          <span className="visually-hidden">Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No places match that filter.</p>
      ) : (
        <div className="grid">
          {visible.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              showSummary={showSummaryFor(place)}
              onOpen={() => onOpen(place.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
