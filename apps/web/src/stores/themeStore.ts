import { create } from 'zustand';

/**
 * Light or dark, and how the choice is remembered.
 *
 * Three states, not two. "System" is the default and means *follow the
 * operating system*, which is what someone who has set a system-wide
 * preference already expects; picking light or dark explicitly overrides it and
 * is what gets written down. A product that ships dark-only and calls it a
 * design decision is really just refusing to do the work.
 *
 * ## Why this is applied to the document rather than held in React
 *
 * The theme is a `data-theme` attribute on `<html>`, and every colour in the
 * product resolves through CSS custom properties keyed off it. So a switch
 * re-points the tokens and the entire interface — including the twenty screens
 * written against the older `space-*` vocabulary, and anything rendered by a
 * library — turns at once. No component needs a `dark:` variant, and nothing
 * has to re-render to change colour.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** What the preference actually resolves to right now. */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'lostintospace:theme';

/** Read the stored preference, tolerating a browser that forbids storage. */
function storedPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode, or site data blocked. The default is still correct.
  }
  return 'system';
}

/** What the operating system is asking for. */
export function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Resolve a preference against the system setting. */
export function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * Put the theme on the document.
 *
 * Exported because `main.tsx` calls it before React mounts. Applying the theme
 * during the first paint rather than in an effect is what prevents the white
 * flash that an app defaulting to dark otherwise shows on every load.
 */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolve(preference);
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  // Native form controls, scrollbars and the like read this rather than CSS.
  root.style.colorScheme = resolved;
  return resolved;
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Step light → dark → system, which is what a single toggle should do. */
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: storedPreference(),
  resolved: resolve(storedPreference()),

  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
    set({ preference, resolved: applyTheme(preference) });
  },

  cycle: () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().preference) + 1) % order.length]!;
    get().setPreference(next);
  },
}));

/**
 * Keep a "system" preference following the system.
 *
 * Called once at start-up. Someone whose machine switches to dark at sunset
 * should see this switch with it, and only while they have not overridden it.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const listener = () => {
    const { preference } = useThemeStore.getState();
    if (preference === 'system') {
      useThemeStore.setState({ resolved: applyTheme('system') });
    }
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
