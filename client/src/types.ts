export type Provider = 'google' | 'demo' | 'manual';

export interface Photo {
  id: number;
  url: string;
  caption: string | null;
  createdAt: string;
}

export interface Place {
  id: number;
  provider: Provider;
  providerPlaceId: string | null;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  googleRating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  summary: string | null;
  summarySource: 'editorial' | 'generative' | null;
  primaryType: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  coverAttribution: string | null;
  enrichedAt: string | null;
  visitDate: string | null;
  wouldReturn: boolean | null;
  rating: number | null;
  crust: number | null;
  sauce: number | null;
  cheese: number | null;
  value: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
}

export interface SearchResult {
  provider: Provider;
  providerPlaceId: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  googleRating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  savedPlaceId: number | null;
}

export interface AppConfig {
  provider: Provider;
  googleConfigured: boolean;
}

export interface SessionState {
  /** False until a password has been set with `npm run set-password`. */
  configured: boolean;
  authenticated: boolean;
}

/** Fields the user can edit on a saved place. */
export type PlaceEdits = Partial<
  Pick<
    Place,
    | 'name'
    | 'address'
    | 'website'
    | 'phone'
    | 'notes'
    | 'visitDate'
    | 'wouldReturn'
    | 'rating'
    | 'crust'
    | 'sauce'
    | 'cheese'
    | 'value'
  >
>;

export const SUB_SCORES = [
  { key: 'crust', label: 'Crust' },
  { key: 'sauce', label: 'Sauce' },
  { key: 'cheese', label: 'Cheese' },
  { key: 'value', label: 'Value' },
] as const;

export type SubScoreKey = (typeof SUB_SCORES)[number]['key'];
