import { useMemo, useState } from 'react';

import type {
  ComponentCategory,
  ComponentDef,
} from '@lostintospace/simulation-engine/core/component-types';

import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

import { ComponentPreview } from './ComponentPreview';

/**
 * The parts bin.
 *
 * What was here was one flat scrolling list of every component in the
 * catalogue, grouped by a broad heading, each entry a name and a mass. Two
 * things were wrong with it. Finding the nose cones meant scrolling past the
 * fuel tanks; and once found, choosing between them meant reading four
 * descriptions, because the one thing that actually distinguishes a von Kármán
 * from a conical cone — the shape — was nowhere on screen.
 *
 * So it is two levels now, which is how a parts catalogue has always worked.
 * The rail on the left is the *classification*: nose cones, fins, engines,
 * tanks, payloads, recovery. Picking one shows every type in it, each drawn to
 * scale from its own dimensions with the numbers that separate it from its
 * neighbours. You choose a category because you know what you need, and then
 * you choose a type by looking at it.
 *
 * Search cuts across the whole catalogue, because sometimes you know the name.
 */

/** Categories in the order a build proceeds, top to bottom. */
const SECTIONS: readonly {
  readonly label: string;
  readonly categories: readonly ComponentCategory[];
}[] = [
  { label: 'Airframe', categories: ['nose_cone', 'fairing', 'body', 'coupler', 'interstage'] },
  { label: 'Propulsion', categories: ['engine', 'motor_mount', 'fuel_tank', 'oxidizer_tank'] },
  { label: 'Aerodynamics', categories: ['fin'] },
  { label: 'Structure', categories: ['bulkhead', 'centering_ring', 'decoupler'] },
  { label: 'Avionics', categories: ['avionics', 'guidance', 'sensor', 'battery'] },
  { label: 'Mission', categories: ['payload'] },
  { label: 'Recovery', categories: ['parachute', 'heat_shield', 'landing_leg'] },
];

const CATEGORY_LABEL: Record<string, string> = {
  nose_cone: 'Nose cones',
  fairing: 'Fairings',
  body: 'Body tubes',
  coupler: 'Couplers',
  interstage: 'Interstages',
  engine: 'Engines',
  motor_mount: 'Motor mounts',
  fuel_tank: 'Fuel tanks',
  oxidizer_tank: 'Oxidiser tanks',
  fin: 'Fin sets',
  bulkhead: 'Bulkheads',
  centering_ring: 'Centering rings',
  decoupler: 'Separators',
  avionics: 'Flight computers',
  guidance: 'Guidance',
  sensor: 'Sensors',
  battery: 'Batteries',
  payload: 'Payloads',
  parachute: 'Parachutes',
  heat_shield: 'Heat shields',
  landing_leg: 'Landing legs',
};

/** The one line that says what makes this part different from the next one. */
function partSummary(component: ComponentDef): string {
  const record = component as unknown as Record<string, number | string | undefined>;
  const num = (key: string) => (typeof record[key] === 'number' ? (record[key] as number) : null);

  switch (component.category) {
    case 'nose_cone':
    case 'fairing': {
      const shape = String(record['shape'] ?? '').replace(/_/g, ' ');
      const fineness = num('finenessRatio');
      const cd = num('dragCoefficient');
      return [
        shape,
        fineness !== null ? `fineness ${fineness.toFixed(1)}` : null,
        cd !== null ? `Cd ${cd.toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'fin': {
      const count = num('finCount');
      const span = num('span_m');
      return [
        count !== null ? `${count} fins` : null,
        span !== null ? `${(span * 100).toFixed(0)} cm span` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'engine': {
      const thrust = num('thrustSeaLevel_N') ?? num('thrust_N');
      const isp = num('isp_vacuum_s');
      const propellant = String(record['propellantType'] ?? '').replace(/_/g, ' ');
      return [
        thrust !== null ? `${(thrust / 1000).toFixed(thrust < 10_000 ? 1 : 0)} kN` : null,
        isp !== null ? `Isp ${isp.toFixed(0)} s` : null,
        propellant || null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'fuel_tank':
    case 'oxidizer_tank': {
      const propellant = num('propellantMass_kg');
      const type = String(record['propellantType'] ?? '').replace(/_/g, ' ');
      return [propellant !== null ? `${propellant.toFixed(0)} kg` : null, type || null]
        .filter(Boolean)
        .join(' · ');
    }
    case 'parachute': {
      const diameter = num('deployedDiameter_m');
      return diameter !== null ? `${diameter.toFixed(1)} m canopy` : 'Recovery';
    }
    case 'payload': {
      return `${component.mass_kg.toFixed(0)} kg payload`;
    }
    default:
      return `${component.length_m.toFixed(2)} m · ⌀${component.outerDiameter_m.toFixed(2)} m`;
  }
}

/** A mass, in whichever unit keeps it readable. */
function mass(kg: number): string {
  if (kg < 1) return `${(kg * 1000).toFixed(0)} g`;
  if (kg < 1000) return `${kg.toFixed(kg < 10 ? 1 : 0)} kg`;
  return `${(kg / 1000).toFixed(1)} t`;
}

export interface PartsBrowserProps {
  /** Every component in the catalogue. */
  components: readonly ComponentDef[];
  /** Add this component to the current stage. */
  onAdd: (defId: string) => void;
  /** False while there is no stage to add a part to. */
  enabled: boolean;
  className?: string;
}

export function PartsBrowser({ components, onAdd, enabled, className }: PartsBrowserProps) {
  const [category, setCategory] = useState<ComponentCategory>('nose_cone');
  const [query, setQuery] = useState('');

  const byCategory = useMemo(() => {
    const map = new Map<string, ComponentDef[]>();
    for (const component of components) {
      const list = map.get(component.category) ?? [];
      list.push(component);
      map.set(component.category, list);
    }
    return map;
  }, [components]);

  const searching = query.trim().length > 0;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // A search runs across the whole catalogue: the point of typing a name is
    // not having to know which drawer it lives in.
    if (needle) {
      return components.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle) ||
          (CATEGORY_LABEL[c.category] ?? c.category).toLowerCase().includes(needle),
      );
    }
    return byCategory.get(category) ?? [];
  }, [components, byCategory, category, query]);

  return (
    <div className={cn('grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]', className)}>
      {/* ── Classification rail ────────────────────────────── */}
      <nav
        aria-label="Component categories"
        className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:max-h-[62vh] sm:flex-col sm:overflow-y-auto sm:px-0"
      >
        {SECTIONS.map((section) => {
          const present = section.categories.filter((c) => (byCategory.get(c)?.length ?? 0) > 0);
          if (present.length === 0) return null;

          return (
            <div key={section.label} className="contents sm:block sm:mb-2">
              <p className="hidden sm:mb-1 sm:block t-label">{section.label}</p>
              {present.map((key) => {
                const count = byCategory.get(key)?.length ?? 0;
                const active = !searching && key === category;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setCategory(key);
                    }}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full shrink-0 items-baseline justify-between gap-2 whitespace-nowrap',
                      'rounded-instrument px-2 py-1.5 text-left transition-colors duration-quick focus-ring',
                      active
                        ? 'bg-signal-flame/10 text-signal-flame-bright'
                        : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100',
                    )}
                  >
                    <span className="truncate text-xs">{CATEGORY_LABEL[key] ?? key}</span>
                    <span className="shrink-0 font-mono text-[0.6rem] text-ink-600">{count}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Types in the chosen category ───────────────────── */}
      <div className="min-w-0 space-y-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all parts…"
          aria-label="Search components"
        />

        {!enabled && (
          <p className="text-tiny leading-relaxed text-signal-caution">
            Add a stage first — every part has to belong to one.
          </p>
        )}

        <ul className="grid max-h-[56vh] grid-cols-2 gap-2 overflow-y-auto pr-1 lg:grid-cols-3 xl:grid-cols-2">
          {visible.map((component) => (
            <li key={component.id}>
              <button
                type="button"
                onClick={() => onAdd(component.id)}
                disabled={!enabled}
                title={component.description}
                className={cn(
                  'glass-panel group flex h-full w-full flex-col overflow-hidden text-left focus-ring',
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                <span
                  className="block h-20 w-full shrink-0"
                  style={{ backgroundColor: 'var(--plane-0)' }}
                >
                  <ComponentPreview component={component} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 p-2">
                  <span className="flex items-baseline justify-between gap-1.5">
                    <span className="truncate text-[0.7rem] leading-tight text-ink-200">
                      {component.name}
                    </span>
                    <span className="shrink-0 font-mono text-[0.6rem] text-ink-500">
                      {mass(component.mass_kg)}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[0.58rem] leading-tight text-ink-600">
                    {partSummary(component)}
                  </span>
                  {searching && (
                    <span className="truncate font-mono text-[0.55rem] text-ink-700">
                      {CATEGORY_LABEL[component.category] ?? component.category}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <p className="py-6 text-center text-xs text-ink-500">
            {searching ? `Nothing matches “${query}”.` : 'No parts in this category.'}
          </p>
        )}
      </div>
    </div>
  );
}
