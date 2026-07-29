import type { AppConfig, Place, PlaceEdits, SearchResult, SessionState } from './types';

/** Thrown when the server says the session is gone, so the UI can show login. */
export class UnauthorizedError extends Error {
  constructor(public setupRequired: boolean) {
    super('Not signed in.');
    this.name = 'UnauthorizedError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    // Send the session cookie even when the app is served from another origin.
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
      throw new UnauthorizedError(Boolean(payload?.setupRequired));
    }

    const message = payload?.error ?? `Request failed (${response.status})`;
    throw new Error(payload?.hint ? `${message} ${payload.hint}` : message);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  getSession: () => request<SessionState>('/api/auth/session'),

  login: (password: string) =>
    request<{ authenticated: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logout: () => request<{ authenticated: false }>('/api/auth/logout', { method: 'POST' }),

  logoutEverywhere: () =>
    request<{ authenticated: false }>('/api/auth/logout-all', { method: 'POST' }),

  getConfig: () => request<AppConfig>('/api/config'),

  listPlaces: () => request<Place[]>('/api/places'),

  search: (query: string, near: string) =>
    request<{ provider: string; results: SearchResult[] }>(
      `/api/search?q=${encodeURIComponent(query)}&near=${encodeURIComponent(near)}`,
    ),

  createPlace: (body: Record<string, unknown>) =>
    request<{ place: Place; alreadySaved: boolean }>('/api/places', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePlace: (id: number, edits: PlaceEdits) =>
    request<Place>(`/api/places/${id}`, { method: 'PATCH', body: JSON.stringify(edits) }),

  deletePlace: (id: number) => request<{ deleted: number }>(`/api/places/${id}`, { method: 'DELETE' }),

  refreshPlace: (id: number) =>
    request<{ place: Place; warnings: string[] }>(`/api/places/${id}/refresh`, { method: 'POST' }),

  addPhoto: (placeId: number, dataUrl: string, caption?: string) =>
    request<Place>(`/api/places/${placeId}/photos`, {
      method: 'POST',
      body: JSON.stringify({ dataUrl, caption }),
    }),

  deletePhoto: (photoId: number) => request<Place>(`/api/photos/${photoId}`, { method: 'DELETE' }),
};
