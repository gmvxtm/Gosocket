import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { languages, type Language } from '../i18n';

export type Theme = 'light' | 'dark';

export interface PreferencesState {
  theme: Theme;
  language: Language;
}

const storageKey = 'offline-requests.preferences';

/** Preferences survive a reload; a browser with storage disabled falls back to the defaults. */
export function readStoredPreferences(): PreferencesState {
  const fallback: PreferencesState = { theme: 'light', language: 'es' };
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    return {
      theme: stored?.theme === 'dark' ? 'dark' : 'light',
      language: languages.includes(stored?.language) ? stored.language : fallback.language
    };
  } catch {
    return fallback;
  }
}

export function storePreferences(preferences: PreferencesState) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // A private window without storage is not a reason to break the app.
  }
}

const preferences = createSlice({
  name: 'preferences',
  initialState: readStoredPreferences,
  reducers: {
    themeChanged(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    themeToggled(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    languageChanged(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    }
  }
});

export const { themeChanged, themeToggled, languageChanged } = preferences.actions;
export default preferences.reducer;
