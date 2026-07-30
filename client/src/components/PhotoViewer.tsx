import { useEffect, useState } from 'react';

import type { Photo } from '../types';

interface PhotoViewerProps {
  photo: Photo;
  placeName: string;
  /** Total in the set, for the "2 of 5" counter. */
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (photoId: number) => Promise<void> | void;
  onClose: () => void;
}

/** Full-screen photo bubble with download, open-externally and delete. */
export function PhotoViewer({
  photo,
  placeName,
  index,
  count,
  onPrev,
  onNext,
  onDelete,
  onClose,
}: PhotoViewerProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [photo.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && count > 1) onPrev();
      if (event.key === 'ArrowRight' && count > 1) onNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onPrev, onNext, count]);

  // Same-origin, so the download attribute is honoured rather than navigating.
  const filename = `${placeName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}-${photo.id}${
    photo.url.match(/\.\w+$/)?.[0] ?? '.jpg'
  }`;

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Photo of ${placeName}`}>
      <div className="viewer-scrim" onClick={onClose} />

      <div className="viewer-panel">
        <header className="viewer-head">
          <span className="viewer-count">
            {count > 1 ? `${index + 1} of ${count}` : 'Photo'}
          </span>
          <button className="btn btn-ghost btn-icon" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="viewer-stage">
          {count > 1 && (
            <button className="viewer-nav viewer-prev" type="button" onClick={onPrev} aria-label="Previous photo">
              ‹
            </button>
          )}

          <img className="viewer-image" src={photo.url} alt={photo.caption ?? `Photo of ${placeName}`} />

          {count > 1 && (
            <button className="viewer-nav viewer-next" type="button" onClick={onNext} aria-label="Next photo">
              ›
            </button>
          )}
        </div>

        <footer className="viewer-actions">
          <a className="btn btn-ghost btn-sm" href={photo.url} download={filename}>
            Download
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href={photo.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open in browser
          </a>

          {confirmingDelete ? (
            <>
              <button
                className="btn btn-danger btn-sm"
                type="button"
                onClick={async () => {
                  await onDelete(photo.id);
                }}
              >
                Delete photo
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost btn-sm viewer-delete"
              type="button"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
