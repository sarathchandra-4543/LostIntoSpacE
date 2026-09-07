import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A control on an instrument.
 *
 * Square-ish corners, no gradient and no shadow. The primary variant is flame
 * because flame means "release energy" everywhere else in this system, and the
 * primary action is always the one that commits.
 *
 * ## Why the outlines went away
 *
 * Every variant used to carry a visible border at rest. On a dense screen —
 * the builder has upwards of thirty controls in view — that is thirty
 * rectangles competing for attention before you have decided anything, and it
 * is the single biggest reason the interface read as busy.
 *
 * Now weight comes from *fill*, not from edges. Primary carries a tinted
 * ground; secondary carries a plain one; ghost and outline carry nothing until
 * pointed at. The border is transparent at rest on every variant and firms up
 * on hover, so the affordance is still there the moment you go looking for it.
 * Nothing about the hit area or the focus ring changed.
 */

const variants = {
  /** Commit. Run the simulation, open the builder, take the next step. */
  primary:
    'bg-signal-flame/12 text-signal-flame-bright border-transparent hover:bg-signal-flame/20 hover:border-signal-flame/40',
  /** An equal alternative. */
  secondary:
    'bg-ink-800 text-ink-200 border-transparent hover:bg-ink-750 hover:border-ink-650 hover:text-ink-100',
  /** Tertiary — reads as text until touched. */
  ghost: 'bg-transparent text-ink-300 border-transparent hover:text-ink-50 hover:bg-ink-850',
  /** Destructive or abort. */
  danger:
    'bg-signal-oxide/12 text-signal-oxide-bright border-transparent hover:bg-signal-oxide/22 hover:border-signal-oxide/40',
  /** Confirmed-good state. */
  nominal:
    'bg-signal-nominal/12 text-signal-nominal-bright border-transparent hover:bg-signal-nominal/22 hover:border-signal-nominal/40',
  /** A pure outline, for dense toolbars. Quiet until pointed at. */
  outline:
    'bg-transparent text-ink-300 border-transparent hover:border-ink-650 hover:text-ink-50 hover:bg-ink-850',
} as const;

const sizes = {
  xs: 'h-6 px-2 text-micro gap-1 tracking-label uppercase font-condensed',
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-[0.95rem] gap-2.5',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-instrument border font-medium',
        'transition-colors duration-quick ease-instrument focus-ring',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          className="h-3 w-3 rounded-full border border-current border-r-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
