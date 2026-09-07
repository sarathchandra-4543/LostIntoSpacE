import { useThemeStore, type ThemePreference } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

/**
 * The theme control.
 *
 * One button that cycles light → dark → follow the system, with the icon
 * showing the state it is *in* rather than the one it would move to. A toggle
 * that shows its destination is a coin flip every time you look at it.
 *
 * The third state is not padding. Someone who has set a system-wide preference
 * has already made this decision once, and "follow it" has to be reachable —
 * including reachable *again* after they have tried the other two.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemeStore((s) => s.preference);
  const cycle = useThemeStore((s) => s.cycle);

  const label: Record<ThemePreference, string> = {
    light: 'Light theme',
    dark: 'Dark theme',
    system: 'Following the system theme',
  };

  const next: Record<ThemePreference, string> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };

  return (
    <button
      type="button"
      onClick={cycle}
      // The accessible name states where you are; the tooltip states where the
      // press will take you. Both, because the icon alone cannot say either.
      aria-label={`${label[preference]}. Switch to ${next[preference]}.`}
      title={`${label[preference]} — switch to ${next[preference]}`}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-instrument text-ink-400',
        'transition-colors duration-quick hover:bg-ink-850 hover:text-ink-100 focus-ring',
        className,
      )}
    >
      {preference === 'light' && <SunIcon />}
      {preference === 'dark' && <MoonIcon />}
      {preference === 'system' && <SystemIcon />}
    </button>
  );
}

/** Thin strokes on a 16-unit grid, matching every other icon in the product. */
const stroke = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function SunIcon() {
  return (
    <svg {...stroke}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...stroke}>
      {/* A crescent as a subtraction of two arcs, not a filled blob. */}
      <path d="M13.2 9.6A5.8 5.8 0 0 1 6.4 2.8a5.8 5.8 0 1 0 6.8 6.8Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg {...stroke}>
      <rect x="2" y="3.2" width="12" height="8.2" rx="1" />
      <path d="M6 13.4h4" />
      {/* Half-filled, because "system" is whichever of the two it resolves to. */}
      <path d="M8 3.2v8.2" />
      <path d="M8 3.2h5a1 1 0 0 1 1 1v6.2a1 1 0 0 1-1 1H8Z" fill="currentColor" opacity="0.35" stroke="none" />
    </svg>
  );
}
