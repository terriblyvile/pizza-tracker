export type ThemeSetting = 'system' | 'light' | 'dark';
export type TextSizeSetting = 'small' | 'default' | 'large' | 'larger';

export interface Settings {
  theme: ThemeSetting;
  textSize: TextSizeSetting;
  /** Show the Google synopsis on cards. Off gives a denser list. */
  showSummaries: boolean;
  /** Which tab to land on when the app opens. */
  startTab: 'search' | 'visited' | 'planned';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  textSize: 'default',
  showSummaries: true,
  startTab: 'visited',
};

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
 * Pushes settings into the document. Theme is an attribute the stylesheet keys
 * off; text size is a multiplier every font-size is expressed against.
 */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;

  if (settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);

  root.style.setProperty('--font-scale', String(TEXT_SCALES[settings.textSize]));
}
