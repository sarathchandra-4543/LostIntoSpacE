import { create } from 'zustand';

/**
 * Chrome state: the navigation rail and the search overlay.
 *
 * The navigation has two independent states because it has two independent
 * problems to solve.
 *
 * `collapsed` is the *desktop* preference: whether the rail shows labels or
 * only icons. It persists while you work and is a matter of taste.
 *
 * `mobileNavOpen` is the *small-screen* drawer: below the `lg` breakpoint the
 * rail is off-canvas and slides over the content, because a 240 px rail on a
 * 375 px phone leaves nothing to put a page in. It closes on navigation, since
 * a drawer that stays open over the page you just asked for is a trap.
 *
 * Conflating the two is what broke the collapse button: it used to toggle a
 * third field that nothing rendered, so pressing it did nothing at all.
 */
interface UIState {
  /** Desktop: icons only, no labels. */
  sidebarCollapsed: boolean;
  /** Small screens: the off-canvas drawer is showing. */
  mobileNavOpen: boolean;
  searchOpen: boolean;

  /** Toggle the desktop collapse. */
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Open or close the small-screen drawer. */
  toggleMobileNav: () => void;
  setMobileNavOpen: (open: boolean) => void;

  setSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  searchOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

  setSearchOpen: (searchOpen) => set({ searchOpen }),
}));
