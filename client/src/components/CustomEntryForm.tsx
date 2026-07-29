import { useState, type FormEvent } from 'react';

import { api } from '../api';
import type { Place } from '../types';

interface CustomEntryFormProps {
  onAdded: (place: Place) => void;
  onOpenPlace: (placeId: number) => void;
}

const EMPTY = { name: '', address: '', website: '', phone: '' };

/** Manual entry for places Google can't find — pop-ups, food trucks, new shops. */
export function CustomEntryForm({ onAdded, onOpenPlace }: CustomEntryFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [lookUp, setLookUp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (changes: Partial<typeof EMPTY>) => setForm((current) => ({ ...current, ...changes }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    setBusy(true);
    setError(null);
    try {
      const { place } = await api.createPlace({
        provider: 'manual',
        name,
        address: form.address.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        // Off by default for genuinely unlisted places, so we don't attach
        // whatever Google decides is the closest match.
        skipEnrichment: !lookUp,
      });

      setForm(EMPTY);
      setOpen(false);
      onAdded(place);
      onOpenPlace(place.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not add that place.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="custom-entry-collapsed">
        <div>
          <h3>Can't find it?</h3>
          <p className="muted small">Add a place by hand — a food truck, a pop-up, somewhere brand new.</p>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(true)}>
          Add manually
        </button>
      </div>
    );
  }

  return (
    <form className="custom-entry" onSubmit={submit}>
      <div className="section-head">
        <h3>Add a place manually</h3>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>

      <div className="field">
        <label htmlFor="custom-name">Name *</label>
        <input
          id="custom-name"
          value={form.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder="Tony's Pizza Truck"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label htmlFor="custom-address">Address</label>
        <input
          id="custom-address"
          value={form.address}
          onChange={(event) => update({ address: event.target.value })}
          placeholder="Street, city, state"
        />
      </div>

      <div className="row">
        <div className="field grow">
          <label htmlFor="custom-website">Website</label>
          <input
            id="custom-website"
            value={form.website}
            onChange={(event) => update({ website: event.target.value })}
            placeholder="https://"
          />
        </div>
        <div className="field">
          <label htmlFor="custom-phone">Phone</label>
          <input
            id="custom-phone"
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
          />
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={lookUp} onChange={(event) => setLookUp(event.target.checked)} />
        <span>
          Look this up on Google to fill in the rating, synopsis and logo
          <span className="muted small"> — uncheck if it genuinely isn't listed</span>
        </span>
      </label>

      {error && <p className="notice notice-error">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={busy || !form.name.trim()}>
        {busy ? 'Adding…' : 'Add place'}
      </button>
    </form>
  );
}
