import { useState } from 'react';

import { api } from '../api';
import { DEFAULT_SETTINGS, type Settings, type TextSizeSetting, type ThemeSetting } from '../settings';
import type { AppConfig, Place } from '../types';

interface SettingsTabProps {
  settings: Settings;
  onChange: (changes: Partial<Settings>) => void;
  config: AppConfig | null;
  places: Place[];
  onSignOut: () => void;
}

const THEMES: { key: ThemeSetting; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const TEXT_SIZES: { key: TextSizeSetting; label: string }[] = [
  { key: 'small', label: 'Small' },
  { key: 'default', label: 'Default' },
  { key: 'large', label: 'Large' },
  { key: 'larger', label: 'Larger' },
];

const START_TABS: { key: Settings['startTab']; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'visited', label: 'Visited' },
  { key: 'planned', label: 'Planned' },
];

export function SettingsTab({ settings, onChange, config, places, onSignOut }: SettingsTabProps) {
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rated = places.filter((place) => place.rating !== null).length;
  const photos = places.reduce((total, place) => total + place.photos.length, 0);

  async function signOutEverywhere() {
    setSigningOutAll(true);
    try {
      await api.logoutEverywhere();
      onSignOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out everywhere.');
    } finally {
      setSigningOutAll(false);
    }
  }

  return (
    <div className="settings">
      <section className="settings-group">
        <h3>Appearance</h3>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Theme</span>
            <span className="muted small">System follows your device's light/dark setting.</span>
          </div>
          <div className="segmented" role="group" aria-label="Theme">
            {THEMES.map((option) => (
              <button
                key={option.key}
                type="button"
                className={settings.theme === option.key ? 'active' : ''}
                onClick={() => onChange({ theme: option.key })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Text size</span>
            <span className="muted small">Scales every bit of text in the app.</span>
          </div>
          <div className="segmented" role="group" aria-label="Text size">
            {TEXT_SIZES.map((option) => (
              <button
                key={option.key}
                type="button"
                className={settings.textSize === option.key ? 'active' : ''}
                onClick={() => onChange({ textSize: option.key })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Show synopsis on cards</span>
            <span className="muted small">Turn off for a denser, quicker-to-scan list.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.showSummaries}
              onChange={(event) => onChange({ showSummaries: event.target.checked })}
            />
            <span className="switch-track" aria-hidden="true" />
            <span className="visually-hidden">Show synopsis on cards</span>
          </label>
        </div>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Hide synopsis once I've written a note</span>
            <span className="muted small">
              Your own words replace Google's blurb on the card.
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.hideSummaryWhenNoted}
              disabled={!settings.showSummaries}
              onChange={(event) => onChange({ hideSummaryWhenNoted: event.target.checked })}
            />
            <span className="switch-track" aria-hidden="true" />
            <span className="visually-hidden">Hide synopsis once I've written a note</span>
          </label>
        </div>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Opening tab</span>
            <span className="muted small">Where the app starts when you load it.</span>
          </div>
          <div className="segmented" role="group" aria-label="Opening tab">
            {START_TABS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={settings.startTab === option.key ? 'active' : ''}
                onClick={() => onChange({ startTab: option.key })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-ghost btn-sm settings-reset"
          type="button"
          onClick={() => onChange(DEFAULT_SETTINGS)}
        >
          Reset appearance to defaults
        </button>
      </section>

      <section className="settings-group">
        <h3>Your data</h3>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">
              {places.length} place{places.length === 1 ? '' : 's'}
            </span>
            <span className="muted small">
              {rated} rated · {photos} photo{photos === 1 ? '' : 's'}
            </span>
          </div>
          <a className="btn btn-ghost btn-sm" href="/api/export">
            Export JSON
          </a>
        </div>

        <p className="muted small">
          Export covers your places and notes but not the photo files. For a full backup, copy the{' '}
          <code>data/</code> folder on the server.
        </p>
      </section>

      <section className="settings-group">
        <h3>Search</h3>
        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">
              {config?.googleConfigured ? 'Google Places' : 'Demo data'}
            </span>
            <span className="muted small">
              {config?.googleConfigured
                ? 'Live results, with synopsis and photos pulled in on save.'
                : 'No API key set — searching a small built-in sample list.'}
            </span>
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>Account</h3>

        {message && <p className="notice notice-error">{message}</p>}

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Sign out</span>
            <span className="muted small">Ends the session on this device only.</span>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Sign out everywhere</span>
            <span className="muted small">
              Ends every session on every device. Use this if you change your password.
            </span>
          </div>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            onClick={signOutEverywhere}
            disabled={signingOutAll}
          >
            {signingOutAll ? 'Signing out…' : 'Sign out all'}
          </button>
        </div>

        <p className="muted small">
          To change your password, run <code>npm run set-password</code> on the server, then restart it.
        </p>
      </section>
    </div>
  );
}
