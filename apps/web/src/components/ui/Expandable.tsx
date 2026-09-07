import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

/**
 * A panel you can collapse out of the way or blow up to fill the screen.
 *
 * The product puts a lot on screen at once — the builder alone shows a parts
 * catalogue, a scale elevation, a stage list and eleven engineering readouts —
 * and the right amount of each depends entirely on what you are doing at that
 * moment. Someone tuning stability wants the elevation full-screen; someone
 * comparing masses wants it out of the way.
 *
 * So every heavy panel gets two controls: **minimise**, which collapses it to
 * its title bar, and **expand**, which lifts it to a full-screen overlay. Both
 * are reversible, neither destroys state, and the panel is the same component
 * in all three modes — expanding does not re-mount it, so a 3D scene keeps its
 * camera and a scrolled list keeps its position.
 *
 * ## Why not a dialog element
 *
 * Because the expanded panel must keep rendering the *same* React subtree. A
 * `<dialog>` or a portal would move the node, and moving a node containing a
 * WebGL canvas destroys and recreates its context — which in this app means the
 * solar system reloads its textures and snaps back to its default camera every
 * time you expand it. Position-fixed styling keeps the node exactly where it is
 * in the tree.
 */

export interface ExpandableProps {
  /** Shown in the title bar, and used as the accessible name. */
  title: ReactNode;
  /** Optional detail beside the title — a count, a status, a unit. */
  aside?: ReactNode;
  /** Start collapsed. */
  defaultMinimised?: boolean;
  /** Hide the minimise control, for a panel that must stay open. */
  canMinimise?: boolean;
  /** Hide the expand control, for a panel that gains nothing from it. */
  canExpand?: boolean;
  /** Extra classes for the panel shell. */
  className?: string;
  /** Extra classes for the body, applied in every mode. */
  bodyClassName?: string;
  children: ReactNode;
}

export function Expandable({
  title,
  aside,
  defaultMinimised = false,
  canMinimise = true,
  canExpand = true,
  className,
  bodyClassName,
  children,
}: ExpandableProps) {
  const [minimised, setMinimised] = useState(defaultMinimised);
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const restoreFocus = useRef<HTMLButtonElement>(null);

  // Escape leaves the expanded state, as it does every other overlay here.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        restoreFocus.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  // A full-screen panel over a scrolling page leaves the page scrolling behind
  // it, which is disorienting when you close it somewhere else entirely.
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  const toggleExpanded = useCallback(() => {
    setExpanded((on) => !on);
    // Expanding a collapsed panel should show you something.
    setMinimised(false);
  }, []);

  return (
    <section
      className={cn(
        'plane flex min-w-0 flex-col overflow-hidden',
        expanded
          ? 'fixed inset-2 z-modal shadow-2xl sm:inset-4'
          : 'relative',
        className,
      )}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 py-2 hairline-b">
        <h3 className="min-w-0 flex-1 truncate font-condensed text-micro uppercase tracking-instrument text-ink-400">
          {title}
        </h3>
        {aside && <span className="shrink-0 font-mono text-[0.6rem] text-ink-600">{aside}</span>}

        {canMinimise && !expanded && (
          <IconButton
            onClick={() => setMinimised((on) => !on)}
            label={minimised ? 'Expand panel' : 'Minimise panel'}
            aria-expanded={!minimised}
            aria-controls={bodyId}
          >
            {minimised ? <ChevronDown /> : <Minimise />}
          </IconButton>
        )}

        {canExpand && (
          <IconButton
            ref={restoreFocus}
            onClick={toggleExpanded}
            label={expanded ? 'Close full screen' : 'Open full screen'}
            aria-pressed={expanded}
          >
            {expanded ? <Contract /> : <Expand />}
          </IconButton>
        )}
      </header>

      {/*
        Kept mounted while minimised rather than unmounted.
        A collapsed panel that throws away its children loses scroll position,
        a running animation and — for the 3D views — an entire WebGL context.
      */}
      <div
        id={bodyId}
        hidden={minimised && !expanded}
        className={cn('min-h-0 flex-1', expanded && 'overflow-auto', bodyClassName)}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * A square icon control, sized for the title bar.
 *
 * `forwardRef` rather than taking `ref` as an ordinary prop: this app is on
 * React 18, where `ref` is still reserved and destructuring it from props
 * yields undefined and logs a warning on every render. React 19 changed that,
 * and writing the 19 form here produced exactly that warning in the console.
 */
const IconButton = forwardRef<
  HTMLButtonElement,
  {
    onClick: () => void;
    label: string;
    children: ReactNode;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, label, children, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-instrument text-ink-500 transition-colors duration-quick hover:bg-ink-800 hover:text-ink-100 focus-ring"
    {...rest}
  >
    {children}
  </button>
));

IconButton.displayName = 'IconButton';

/** Thin strokes on a 16-unit grid, matching every other icon in the product. */
const stroke = {
  width: 13,
  height: 13,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const Minimise = () => (
  <svg {...stroke}>
    <path d="M3.5 8h9" />
  </svg>
);

const ChevronDown = () => (
  <svg {...stroke}>
    <path d="M4 6.5 8 10.5l4-4" />
  </svg>
);

const Expand = () => (
  <svg {...stroke}>
    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
  </svg>
);

const Contract = () => (
  <svg {...stroke}>
    <path d="M13 3 9 7m0 0V3.5M9 7h3.5M3 13l4-4m0 0v3.5M7 9H3.5" />
  </svg>
);
