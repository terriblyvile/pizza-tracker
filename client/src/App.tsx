import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, UnauthorizedError } from './api';
import { CustomEntryForm } from './components/CustomEntryForm';
import { LoginScreen } from './components/LoginScreen';
import { PlaceDetail } from './components/PlaceDetail';
import { PlaceList } from './components/PlaceList';
import { PlannedTab } from './components/PlannedTab';
import { SearchPanel } from './components/SearchPanel';
import { SettingsTab } from './components/SettingsTab';
import { TabBar, type TabKey } from './components/TabBar';
import {
  applySettings,
  loadSettings,
  saveSettings,
  shouldShowSummary,
  type Settings,
} from './settings';
import type { AppConfig, Place } from './types';

type AuthState = 'checking' | 'signed-out' | 'setup-required' | 'signed-in';

/** A place counts as visited once it has a visit date or a rating. */
const isVisited = (place: Place) => place.visitDate !== null || place.rating !== null;

export function App() {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [places, setPlaces] = useState<Place[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [tab, setTab] = useState<TabKey>(() => loadSettings().startTab);

  useEffect(() => {
    api
      .getSession()
      .then((session) => {
        if (!session.configured) setAuth('setup-required');
        else setAuth(session.authenticated ? 'signed-in' : 'signed-out');
      })
      .catch(() => setAuth('signed-out'));
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([api.listPlaces(), api.getConfig()])
      .then(([loadedPlaces, loadedConfig]) => {
        setPlaces(loadedPlaces);
        setConfig(loadedConfig);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        // A session that expired mid-use drops straight back to the login form.
        if (error instanceof UnauthorizedError) {
          setAuth(error.setupRequired ? 'setup-required' : 'signed-out');
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Could not reach the server.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (auth === 'signed-in') loadData();
  }, [auth, loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateSettings(changes: Partial<Settings>) {
    setSettings((current) => {
      const next = { ...current, ...changes };
      applySettings(next);
      saveSettings(next);
      return next;
    });
  }

  async function signOut() {
    try {
      await api.logout();
    } catch {
      // Even if the call fails, drop the local view of the session.
    }
    setPlaces([]);
    setSelectedId(null);
    setAuth('signed-out');
  }

  const selected = places.find((place) => place.id === selectedId) ?? null;

  const { visited, planned } = useMemo(
    () => ({
      visited: places.filter(isVisited),
      planned: places.filter((place) => !isVisited(place)),
    }),
    [places],
  );

  const stats = useMemo(() => {
    const rated = visited.filter((place) => place.rating !== null);
    const averageStars = rated.length
      ? rated.reduce((sum, place) => sum + (place.rating ?? 0), 0) / rated.length
      : null;
    const best = rated.reduce<Place | null>(
      (top, place) => (!top || (place.rating ?? 0) > (top.rating ?? 0) ? place : top),
      null,
    );
    return { rated: rated.length, averageStars, best };
  }, [visited]);

  function upsertPlace(place: Place) {
    setPlaces((current) => {
      const index = current.findIndex((item) => item.id === place.id);
      if (index === -1) return [place, ...current];
      const next = [...current];
      next[index] = place;
      return next;
    });
  }

  if (auth === 'checking') {
    return <div className="boot">Loading…</div>;
  }

  if (auth !== 'signed-in') {
    return (
      <LoginScreen setupRequired={auth === 'setup-required'} onSignedIn={() => setAuth('signed-in')} />
    );
  }

  const openPlace = (placeId: number) => setSelectedId(placeId);
  const showSummaryFor = (place: Place) =>
    shouldShowSummary(settings, Boolean(place.notes?.trim()));

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            🍕
          </span>
          <div>
            <h1>Pizza Tracker</h1>
            <p className="muted small">Every slice, rated and remembered.</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        {loadError && (
          <p className="notice notice-error">
            {loadError} Make sure the API server is running.
          </p>
        )}

        {loading && places.length === 0 && <p className="empty">Loading your pizza history…</p>}

        {tab === 'search' && (
          <>
            <h2 className="tab-title">Search</h2>
            <SearchPanel
              config={config}
              onSaved={(place, alreadySaved) => {
                upsertPlace(place);
                setToast(alreadySaved ? `${place.name} is already on your list.` : `Added ${place.name}.`);
              }}
              onOpenPlace={openPlace}
            />
            <CustomEntryForm
              onAdded={(place) => {
                upsertPlace(place);
                setToast(`Added ${place.name}.`);
              }}
              onOpenPlace={openPlace}
            />
          </>
        )}

        {tab === 'visited' && (
          <PlaceList
            places={visited}
            onOpen={openPlace}
            showSummaryFor={showSummaryFor}
            showRatingFilters
            defaultSort="visit"
            emptyState={
              <div className="empty">
                <p className="empty-title">Nothing logged yet.</p>
                <p className="muted">
                  Rate a place or give it a visit date and it moves here from Planned.
                </p>
              </div>
            }
          >
            <div className="planned-head">
              <div>
                <h2 className="tab-title">Visited</h2>
                <p className="muted small">
                  {visited.length === 0
                    ? 'No visits recorded.'
                    : `${visited.length} place${visited.length === 1 ? '' : 's'} you've been to.`}
                </p>
              </div>

              <dl className="stats">
                <div>
                  <dt>Rated</dt>
                  <dd>{stats.rated}</dd>
                </div>
                <div>
                  <dt>Avg score</dt>
                  <dd>{stats.averageStars === null ? '—' : `${stats.averageStars.toFixed(1)}★`}</dd>
                </div>
                <div className="stat-wide">
                  <dt>Top pick</dt>
                  <dd>
                    {stats.best ? (
                      <button
                        className="stat-link"
                        type="button"
                        onClick={() => openPlace(stats.best!.id)}
                        title={`Open ${stats.best.name} — your highest rated at ${stats.best.rating?.toFixed(1)}★`}
                      >
                        {stats.best.name}
                      </button>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </PlaceList>
        )}

        {tab === 'planned' && (
          <PlannedTab places={planned} onOpen={openPlace} showSummaryFor={showSummaryFor} />
        )}

        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            onChange={updateSettings}
            config={config}
            places={places}
            onSignOut={signOut}
          />
        )}
      </main>

      <TabBar active={tab} onChange={setTab} visitedCount={visited.length} plannedCount={planned.length} />

      {selected && (
        <PlaceDetail
          key={selected.id}
          place={selected}
          onUpdated={upsertPlace}
          onDeleted={(placeId) => {
            setPlaces((current) => current.filter((place) => place.id !== placeId));
            setSelectedId(null);
            setToast('Place deleted.');
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
