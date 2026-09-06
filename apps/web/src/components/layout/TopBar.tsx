import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';
import { displayLabel } from '@/types';

export function TopBar() {
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-[color:var(--plane-1)] px-4 hairline-b sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* The only way to reach navigation below `lg`, where the rail is a
            drawer. Hidden above it, where the rail is always present. */}
        <button
          onClick={toggleMobileNav}
          aria-label="Open navigation"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-instrument text-ink-400 transition-colors duration-quick hover:bg-ink-850 hover:text-ink-100 focus-ring lg:hidden"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-instrument border border-ink-800 bg-ink-950 px-3 text-xs text-ink-500 transition-colors duration-quick hover:border-ink-650 hover:text-ink-200 focus-ring sm:max-w-sm"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="truncate">
            <span className="hidden sm:inline">Search objects, missions, science…</span>
            <span className="sm:hidden">Search…</span>
          </span>
          <kbd className="ml-auto hidden shrink-0 rounded-instrument border border-ink-800 px-1 font-mono text-micro text-ink-600 md:block">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {isAuthenticated && user ? (
          <button
            onClick={() => navigate('/workspace')}
            className="flex items-center gap-2 text-sm text-ink-300 transition-colors hover:text-ink-50 focus-ring"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-instrument border border-ink-650 bg-ink-850">
              <span className="font-mono text-xs text-ink-200">
                {displayLabel(user).charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden text-xs sm:inline">{displayLabel(user)}</span>
          </button>
        ) : (
          <Button size="sm" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
