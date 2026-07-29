import { useState, type FormEvent } from 'react';

import { api } from '../api';
import type { AppConfig, Place, SearchResult } from '../types';
import { hostname, priceLabel } from '../utils';

interface SearchPanelProps {
  config: AppConfig | null;
  onSaved: (place: Place, alreadySaved: boolean) => void;
  onOpenPlace: (placeId: number) => void;
}

export function SearchPanel({ config, onSaved, onOpenPlace }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [near, setNear] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setBusy(true);
    setError(null);
    try {
      const response = await api.search(query, near);
      setResults(response.results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  async function save(result: SearchResult) {
    if (result.savedPlaceId) {
      onOpenPlace(result.savedPlaceId);
      return;
    }

    setSavingId(result.providerPlaceId);
    setError(null);
    try {
      const { place, alreadySaved } = await api.createPlace({
        provider: result.provider,
        providerPlaceId: result.providerPlaceId,
        name: result.name,
        address: result.address,
        website: result.website,
        phone: result.phone,
        lat: result.lat,
        lng: result.lng,
        mapsUrl: result.mapsUrl,
        googleRating: result.googleRating,
        priceLevel: result.priceLevel,
      });

      setResults((current) =>
        current?.map((item) =>
          item.providerPlaceId === result.providerPlaceId ? { ...item, savedPlaceId: place.id } : item,
        ) ?? null,
      );
      onSaved(place, alreadySaved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save that place.');
    } finally {
      setSavingId(null);
    }
  }

  async function addManually() {
    const name = query.trim();
    if (!name) return;

    setSavingId('manual');
    try {
      const { place } = await api.createPlace({ provider: 'manual', name, address: near.trim() || null });
      onSaved(place, false);
      onOpenPlace(place.id);
      setQuery('');
      setNear('');
      setResults(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add that place.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="panel search-panel">
      <form className="search-form" onSubmit={runSearch}>
        <div className="field grow">
          <label htmlFor="search-query">Pizza place</label>
          <input
            id="search-query"
            placeholder="e.g. Lucali, or just “pizza”"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="search-near">Near</label>
          <input
            id="search-near"
            placeholder="City or neighborhood"
            value={near}
            onChange={(event) => setNear(event.target.value)}
            autoComplete="off"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !query.trim()}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {config && !config.googleConfigured && (
        <p className="notice">
          <strong>Demo search.</strong> Results come from a small built-in list of well-known
          pizzerias, and their details are unverified sample data. Add a{' '}
          <code>GOOGLE_MAPS_API_KEY</code> to <code>.env</code> and restart to search all of Google
          Places — see the README.
        </p>
      )}

      {error && <p className="notice notice-error">{error}</p>}

      {results && (
        <div className="results">
          <div className="results-head">
            <span>
              {results.length} result{results.length === 1 ? '' : 's'}
            </span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setResults(null)}>
              Clear
            </button>
          </div>

          {results.length === 0 && (
            <p className="empty-inline">
              Nothing matched “{query}”.{' '}
              <button className="link-btn" type="button" onClick={addManually}>
                Add it manually instead
              </button>
              .
            </p>
          )}

          <ul className="result-list">
            {results.map((result) => (
              <li className="result" key={result.providerPlaceId}>
                <div className="result-main">
                  <h3>{result.name}</h3>
                  {result.address && <p className="muted">{result.address}</p>}
                  <p className="result-meta">
                    {result.googleRating !== null && (
                      <span title="Google rating">★ {result.googleRating.toFixed(1)}</span>
                    )}
                    {result.userRatingCount !== null && (
                      <span className="muted">({result.userRatingCount.toLocaleString()})</span>
                    )}
                    {priceLabel(result.priceLevel) && <span>{priceLabel(result.priceLevel)}</span>}
                    {result.website && (
                      <a href={result.website} target="_blank" rel="noreferrer noopener">
                        {hostname(result.website)}
                      </a>
                    )}
                  </p>
                </div>
                <button
                  className={`btn ${result.savedPlaceId ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                  type="button"
                  onClick={() => save(result)}
                  disabled={savingId === result.providerPlaceId}
                >
                  {result.savedPlaceId
                    ? 'Saved — open'
                    : savingId === result.providerPlaceId
                      ? 'Adding…'
                      : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
