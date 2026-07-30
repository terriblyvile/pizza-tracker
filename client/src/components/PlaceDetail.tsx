import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { api } from '../api';
import { SUB_SCORES, type Place, type PlaceEdits } from '../types';
import { appleMapsLink, fileToResizedDataUrl, hostname, subScoreAverage, telLink } from '../utils';
import { GlobeIcon, MapPinIcon, PhoneIcon } from './Icons';
import { ScoreSlider } from './ScoreSlider';
import { StarRating } from './StarRating';

interface PlaceDetailProps {
  place: Place;
  onUpdated: (place: Place) => void;
  onDeleted: (placeId: number) => void;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function draftFrom(place: Place): PlaceEdits {
  return {
    name: place.name,
    address: place.address,
    website: place.website,
    phone: place.phone,
    notes: place.notes,
    visitDate: place.visitDate,
    wouldReturn: place.wouldReturn,
    rating: place.rating,
    crust: place.crust,
    sauce: place.sauce,
    cheese: place.cheese,
    value: place.value,
  };
}

export function PlaceDetail({ place, onUpdated, onDeleted, onClose }: PlaceDetailProps) {
  const [draft, setDraft] = useState<PlaceEdits>(() => draftFrom(place));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Reset the form only when a different place is opened, so in-flight edits
  // aren't overwritten by the refreshed record coming back from a save.
  useEffect(() => {
    setDraft(draftFrom(place));
    setSaveState('idle');
    setConfirmingDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  /** Applies a field change locally, then saves it after a short pause. */
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;

    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const updated = await api.updatePlace(place.id, draft);
        dirty.current = false;
        onUpdated(updated);
        setSaveState('saved');
        setError(null);
      } catch (saveError) {
        setSaveState('error');
        setError(saveError instanceof Error ? saveError.message : 'Could not save changes.');
      }
    }, 600);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, place.id]);

  function update(changes: PlaceEdits) {
    dirty.current = true;
    setDraft((current) => ({ ...current, ...changes }));
  }

  async function onPhotosPicked(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      let latest = place;
      for (const file of files) {
        const dataUrl = await fileToResizedDataUrl(file);
        latest = await api.addPhoto(place.id, dataUrl);
      }
      onUpdated(latest);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removePhoto(photoId: number) {
    try {
      onUpdated(await api.deletePhoto(photoId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete that photo.');
    }
  }

  async function refreshFromGoogle() {
    setRefreshing(true);
    setError(null);
    try {
      const { place: refreshed, warnings } = await api.refreshPlace(place.id);
      onUpdated(refreshed);
      // Re-seed the form: a refresh can change the address, website or phone.
      setDraft(draftFrom(refreshed));
      dirty.current = false;
      if (warnings.length > 0) setError(warnings.join(' '));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh from Google.');
    } finally {
      setRefreshing(false);
    }
  }

  async function deletePlace() {
    try {
      await api.deletePlace(place.id);
      onDeleted(place.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete that place.');
    }
  }

  const average = subScoreAverage({ ...place, ...draft } as Place);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" aria-label={`Details for ${place.name}`}>
        <header className="drawer-head">
          <input
            className="drawer-title"
            value={draft.name ?? ''}
            onChange={(event) => update({ name: event.target.value })}
            aria-label="Place name"
          />
          <div className="drawer-head-actions">
            <span className={`save-state save-state-${saveState}`}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved' : ''}
            </span>
            <button className="btn btn-ghost btn-icon" type="button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        <div className="drawer-body">
          {error && <p className="notice notice-error">{error}</p>}

          <section className="drawer-section">
            <div className="section-head">
              <h4>From Google</h4>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={refreshFromGoogle}
                disabled={refreshing}
                title="Re-pull the synopsis, rating, photo and logo. Overwrites the address, website and phone below with Google's values."
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="google-block">
              {place.logoUrl && (
                <img className="google-logo" src={place.logoUrl} alt={`${place.name} logo`} />
              )}
              <div className="google-text">
                {place.primaryType && <p className="google-type">{place.primaryType}</p>}
                {place.googleRating !== null ? (
                  <p className="google-rating">
                    ★ {place.googleRating.toFixed(1)}
                    {place.userRatingCount !== null && (
                      <span className="muted small"> from {place.userRatingCount.toLocaleString()} reviews</span>
                    )}
                  </p>
                ) : (
                  <p className="muted small">No Google rating yet.</p>
                )}
              </div>
            </div>

            {place.summary ? (
              <p className="google-summary">
                {place.summary}
                {place.summarySource === 'generative' && (
                  <span className="muted small"> — AI-generated overview from Google</span>
                )}
              </p>
            ) : (
              <p className="muted small">
                No synopsis available for this place. Try <em>Refresh</em>.
              </p>
            )}

            {place.coverUrl && (
              <figure className="google-cover">
                <img src={place.coverUrl} alt={`${place.name}`} loading="lazy" />
                {place.coverAttribution && (
                  <figcaption className="muted small">Photo: {place.coverAttribution}</figcaption>
                )}
              </figure>
            )}
          </section>

          <section className="drawer-section">
            <h4>Your rating</h4>
            <StarRating value={draft.rating ?? null} onChange={(rating) => update({ rating })} size="lg" />

            <div className="scores">
              {SUB_SCORES.map(({ key, label }) => (
                <ScoreSlider
                  key={key}
                  label={label}
                  value={draft[key] ?? null}
                  onChange={(score) => update({ [key]: score } as PlaceEdits)}
                />
              ))}
            </div>
            {average !== null && (
              <p className="muted small">Sub-score average: <strong>{average.toFixed(1)}/10</strong></p>
            )}
          </section>

          <section className="drawer-section">
            <h4>Visit</h4>
            {/* Stacked, not a .row: the segmented control has a wide intrinsic
                minimum and would overlap the date field on a narrow screen. */}
            <div className="stack">
              <div className="field">
                <label htmlFor="visit-date">Date visited</label>
                <input
                  id="visit-date"
                  type="date"
                  value={draft.visitDate ?? ''}
                  onChange={(event) => update({ visitDate: event.target.value || null })}
                />
              </div>
              <div className="field">
                <label id="would-return-label">Would return?</label>
                <div className="segmented segmented-fill" role="group" aria-labelledby="would-return-label">
                  {[
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                    { label: 'Unsure', value: null },
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      className={draft.wouldReturn === option.value ? 'active' : ''}
                      onClick={() => update({ wouldReturn: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="drawer-section">
            <h4>Notes</h4>
            <textarea
              className="notes-input"
              rows={6}
              placeholder="What did you order? How was the crust? Would you bring someone here?"
              value={draft.notes ?? ''}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </section>

          <section className="drawer-section">
            <div className="section-head">
              <h4>Photos</h4>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Add photos'}
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onPhotosPicked}
            />
            {place.photos.length === 0 ? (
              <p className="muted small">No photos yet.</p>
            ) : (
              <div className="photo-grid">
                {place.photos.map((photo) => (
                  <figure className="photo" key={photo.id}>
                    <a href={photo.url} target="_blank" rel="noreferrer noopener">
                      <img src={photo.url} alt={photo.caption ?? `Photo of ${place.name}`} loading="lazy" />
                    </a>
                    <button
                      className="photo-delete"
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label="Delete photo"
                    >
                      ✕
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section className="drawer-section">
            <h4>Details</h4>
            <div className="field">
              <label htmlFor="detail-address">Address</label>
              <input
                id="detail-address"
                value={draft.address ?? ''}
                onChange={(event) => update({ address: event.target.value })}
              />
            </div>
            <div className="row">
              <div className="field grow">
                <label htmlFor="detail-website">Website</label>
                <input
                  id="detail-website"
                  value={draft.website ?? ''}
                  placeholder="https://"
                  onChange={(event) => update({ website: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="detail-phone">Phone</label>
                <input
                  id="detail-phone"
                  value={draft.phone ?? ''}
                  onChange={(event) => update({ phone: event.target.value })}
                />
              </div>
            </div>

            <div className="link-row">
              <a
                className="btn btn-ghost btn-sm btn-icon-text"
                href={appleMapsLink({ ...place, ...draft } as Place)}
                target="_blank"
                rel="noreferrer noopener"
              >
                <MapPinIcon />
                Open in Apple Maps
              </a>

              {draft.website && (
                <a
                  className="btn btn-ghost btn-sm btn-icon-text"
                  href={draft.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={hostname(draft.website) ?? undefined}
                >
                  <GlobeIcon />
                  Open
                </a>
              )}

              {telLink(draft.phone ?? null) && (
                <a
                  className="btn btn-ghost btn-sm btn-icon-text"
                  href={telLink(draft.phone ?? null)!}
                  title={`Call ${draft.phone}`}
                >
                  <PhoneIcon />
                  Call
                </a>
              )}
            </div>
            {place.googleRating !== null && (
              <p className="muted small">Google rating when added: ★ {place.googleRating.toFixed(1)}</p>
            )}
          </section>

          <section className="drawer-section danger">
            {confirmingDelete ? (
              <div className="confirm">
                <span>Delete “{place.name}” and its photos?</span>
                <button className="btn btn-danger btn-sm" type="button" onClick={deletePlace}>
                  Delete
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirmingDelete(true)}>
                Delete this place
              </button>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
