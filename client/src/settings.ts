export type ThemeSetting = 'system' | 'light' | 'dark';
export type PaletteSetting = 'tomato' | 'basil' | 'honey' | 'truffle' | 'anchovy' | 'charcoal';
export type TextSizeSetting = 'small' | 'default' | 'large' | 'larger';

/**
 * Every palette is written out twice in styles.css, under
 * `[data-palette='<key>']` — once light, once dark — so the light/dark setting
 * stays independent of which colors are in use.
 */
export const PALETTES: { key: PaletteSetting; label: string }[] = [
  { key: 'tomato', label: 'Tomato' },
  { key: 'basil', label: 'Basil' },
  { key: 'honey', label: 'Honey' },
  { key: 'truffle', label: 'Truffle' },
  { key: 'anchovy', label: 'Anchovy' },
  { key: 'charcoal', label: 'Charcoal' },
];

export interface Settings {
  theme: ThemeSetting;
  palette: PaletteSetting;
  textSize: TextSizeSetting;
  /** Show the Google synopsis on cards. Off gives a denser list. */
  showSummaries: boolean;
  /** Once you've written your own note, drop Google's blurb from the card. */
  hideSummaryWhenNoted: boolean;
  /** Which tab to land on when the app opens. */
  startTab: 'search' | 'visited' | 'planned';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  palette: 'tomato',
  textSize: 'default',
  showSummaries: true,
  hideSummaryWhenNoted: true,
  startTab: 'visited',
};

/** Whether a given place should show the Google synopsis on its card. */
export function shouldShowSummary(settings: Settings, hasNote: boolean): boolean {
  if (!settings.showSummaries) return false;
  return !(settings.hideSummaryWhenNoted && hasNote);
}

export const TEXT_SCALES: Record<TextSizeSetting, number> = {
  small: 0.9,
  default: 1,
  large: 1.13,
  larger: 1.28,
};

const STORAGE_KEY = 'pizza-tracker-settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    // Merge over defaults so a settings file written by an older build still loads.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a full quota — the app still works, just won't persist.
  }
}

/**
 * Pushes settings into the document. Theme and palette are attributes the
 * stylesheet keys off; text size is a multiplier every font-size is expressed
 * against.
 */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;

  if (settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);

  // An unknown palette — saved by a newer build, or hand-edited into local
  // storage — would leave every color variable undefined and the page unpainted.
  const palette = PALETTES.some((option) => option.key === settings.palette)
    ? settings.palette
    : DEFAULT_SETTINGS.palette;
  root.setAttribute('data-palette', palette);

  root.style.setProperty('--font-scale', String(TEXT_SCALES[settings.textSize]));

  // Browser chrome tints itself with this — Android's status bar, Safari's
  // toolbar. Left at a fixed color it clashes with five palettes out of six.
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (themeColor && background) themeColor.setAttribute('content', background);
}
