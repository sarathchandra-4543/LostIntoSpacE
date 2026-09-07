import type { ComponentDef } from '@lostintospace/simulation-engine/core/component-types';

/**
 * How the parts catalogue is organised, in one place.
 *
 * There were two classifications before this: one in the Builder's parts
 * browser and one in Rocket Lab. They disagreed, and Rocket Lab's was
 * incomplete — eight of the twenty-one categories had no label at all, so the
 * page rendered the raw enum keys. A filter bar reading `motor_mount`,
 * `centering_ring`, `sensor`, `fairing`, `coupler`, `interstage` in a flat wall
 * of twenty-two chips is not a classification, it is a leak of the schema.
 *
 * One table now, exhaustive by construction: `CATEGORY` covers every category
 * the registry can produce, and `GROUPS` places every one of those into a
 * family. Adding a component category to the engine and forgetting to describe
 * it here fails the check in `componentTaxonomy.test.ts` rather than showing up
 * as a raw identifier in the interface.
 */

/** Every component category the stock registry produces. */
export type Category =
  | 'nose_cone'
  | 'fairing'
  | 'body'
  | 'coupler'
  | 'interstage'
  | 'engine'
  | 'motor_mount'
  | 'fuel_tank'
  | 'oxidizer_tank'
  | 'fin'
  | 'bulkhead'
  | 'centering_ring'
  | 'decoupler'
  | 'avionics'
  | 'guidance'
  | 'sensor'
  | 'battery'
  | 'payload'
  | 'parachute'
  | 'heat_shield'
  | 'landing_leg';

/** How one category is named and what it is for. */
export interface CategoryInfo {
  /** Plural, for a heading or a filter. */
  readonly label: string;
  /** Singular, for a badge on a single component. */
  readonly singular: string;
  /** One line on what this part does, for the section subheading. */
  readonly blurb: string;
}

export const CATEGORY: Record<Category, CategoryInfo> = {
  nose_cone: {
    label: 'Nose cones',
    singular: 'Nose cone',
    blurb: 'The profile at the front. Sets transonic drag more than anything else on the vehicle.',
  },
  fairing: {
    label: 'Payload fairings',
    singular: 'Fairing',
    blurb: 'A shell that protects the payload through the atmosphere, then splits and is thrown away.',
  },
  body: {
    label: 'Body tubes',
    singular: 'Body tube',
    blurb: 'The airframe. Carries the compressive load of everything stacked above it.',
  },
  coupler: {
    label: 'Couplers',
    singular: 'Coupler',
    blurb: 'Joins two tubes of the same diameter without a step in the airflow.',
  },
  interstage: {
    label: 'Interstages',
    singular: 'Interstage',
    blurb: 'The load-bearing structure between two stages, and where separation happens.',
  },
  engine: {
    label: 'Engines and motors',
    singular: 'Engine',
    blurb: 'Thrust and specific impulse. The two numbers the whole design answers to.',
  },
  motor_mount: {
    label: 'Motor mounts',
    singular: 'Motor mount',
    blurb: 'Transfers thrust from the engine into the airframe.',
  },
  fuel_tank: {
    label: 'Fuel tanks',
    singular: 'Fuel tank',
    blurb: 'Propellant mass, which is most of a rocket by weight.',
  },
  oxidizer_tank: {
    label: 'Oxidiser tanks',
    singular: 'Oxidiser tank',
    blurb: 'A bipropellant engine needs oxygen it brought with it. There is none outside.',
  },
  fin: {
    label: 'Fin sets',
    singular: 'Fin set',
    blurb: 'Moves the centre of pressure aft of the centre of gravity. Without that, it tumbles.',
  },
  bulkhead: {
    label: 'Bulkheads',
    singular: 'Bulkhead',
    blurb: 'Closes off a bay and carries load across the diameter.',
  },
  centering_ring: {
    label: 'Centering rings',
    singular: 'Centering ring',
    blurb: 'Holds an inner component concentric inside a larger tube.',
  },
  decoupler: {
    label: 'Separators',
    singular: 'Separator',
    blurb: 'Cuts a stage loose. Fires once, and cannot be undone.',
  },
  avionics: {
    label: 'Flight computers',
    singular: 'Flight computer',
    blurb: 'Runs the guidance program and the sequence of events.',
  },
  guidance: {
    label: 'Guidance',
    singular: 'Guidance',
    blurb: 'Inertial reference. Knows which way is up when nothing outside can tell it.',
  },
  sensor: {
    label: 'Sensors',
    singular: 'Sensor',
    blurb: 'Pressure, acceleration, rate and temperature. Everything the telemetry reports.',
  },
  battery: {
    label: 'Batteries',
    singular: 'Battery',
    blurb: 'Power for the avionics. A flight that outlasts its battery ends early.',
  },
  payload: {
    label: 'Payloads',
    singular: 'Payload',
    blurb: 'The reason for the flight. Every other part exists to move this.',
  },
  parachute: {
    label: 'Parachutes',
    singular: 'Parachute',
    blurb: 'Recovery, where there is air to catch. Useless in vacuum.',
  },
  heat_shield: {
    label: 'Heat shields',
    singular: 'Heat shield',
    blurb: 'Blunt on purpose: it holds the shock wave off the vehicle so the air takes the heat.',
  },
  landing_leg: {
    label: 'Landing legs',
    singular: 'Landing leg',
    blurb: 'For arriving somewhere on the engine rather than on a parachute.',
  },
};

/** Families, in the order a build actually proceeds. */
export interface Group {
  readonly label: string;
  /** What this family is for, in one line. */
  readonly blurb: string;
  readonly categories: readonly Category[];
}

export const GROUPS: readonly Group[] = [
  {
    label: 'Airframe',
    blurb: 'The structure everything else attaches to.',
    categories: ['nose_cone', 'fairing', 'body', 'coupler', 'interstage'],
  },
  {
    label: 'Propulsion',
    blurb: 'Thrust, and the propellant it consumes.',
    categories: ['engine', 'motor_mount', 'fuel_tank', 'oxidizer_tank'],
  },
  {
    label: 'Aerodynamics',
    blurb: 'What keeps it pointing the way it is going.',
    categories: ['fin'],
  },
  {
    label: 'Structure',
    blurb: 'Load paths, and the joints that come apart on purpose.',
    categories: ['bulkhead', 'centering_ring', 'decoupler'],
  },
  {
    label: 'Avionics',
    blurb: 'The parts that know what is happening.',
    categories: ['avionics', 'guidance', 'sensor', 'battery'],
  },
  {
    label: 'Mission',
    blurb: 'What the vehicle is carrying.',
    categories: ['payload'],
  },
  {
    label: 'Recovery',
    blurb: 'Getting down, or getting down intact.',
    categories: ['parachute', 'heat_shield', 'landing_leg'],
  },
];

/** Plural label for a category, never the raw enum key. */
export function categoryLabel(category: string): string {
  return CATEGORY[category as Category]?.label ?? humanise(category);
}

/** Singular label, for a badge on one component. */
export function categorySingular(category: string): string {
  return CATEGORY[category as Category]?.singular ?? humanise(category);
}

/** What a category is for. */
export function categoryBlurb(category: string): string {
  return CATEGORY[category as Category]?.blurb ?? '';
}

/**
 * Last-resort label for a category nobody has described yet.
 *
 * `motor_mount` becomes "Motor mount" rather than appearing verbatim. The test
 * suite makes sure this never actually runs for a real category, but a schema
 * leak reaching a user is worse than a slightly generic label.
 */
function humanise(key: string): string {
  const words = key.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Which family a category belongs to. */
export function groupOf(category: string): Group | undefined {
  return GROUPS.find((g) => (g.categories as readonly string[]).includes(category));
}

/**
 * Components arranged into families, then categories, with empty ones dropped.
 *
 * The single entry point both the Builder and Rocket Lab render from, so they
 * cannot present the catalogue differently again.
 */
export interface ClassifiedGroup {
  readonly label: string;
  readonly blurb: string;
  readonly total: number;
  readonly categories: readonly {
    readonly key: Category;
    readonly info: CategoryInfo;
    readonly components: readonly ComponentDef[];
  }[];
}

export function classify(components: readonly ComponentDef[]): ClassifiedGroup[] {
  const byCategory = new Map<string, ComponentDef[]>();
  for (const component of components) {
    const list = byCategory.get(component.category) ?? [];
    list.push(component);
    byCategory.set(component.category, list);
  }

  const out: ClassifiedGroup[] = [];
  for (const group of GROUPS) {
    const categories = group.categories
      .map((key) => ({
        key,
        info: CATEGORY[key],
        components: (byCategory.get(key) ?? []).slice().sort((a, b) => a.mass_kg - b.mass_kg),
      }))
      .filter((c) => c.components.length > 0);

    if (categories.length === 0) continue;
    out.push({
      label: group.label,
      blurb: group.blurb,
      total: categories.reduce((sum, c) => sum + c.components.length, 0),
      categories,
    });
  }

  // Anything the taxonomy does not place still has to appear somewhere.
  const placed = new Set(GROUPS.flatMap((g) => g.categories as readonly string[]));
  const orphans = [...byCategory.entries()].filter(([key]) => !placed.has(key));
  if (orphans.length > 0) {
    out.push({
      label: 'Other',
      blurb: 'Categories the taxonomy has not been told about yet.',
      total: orphans.reduce((sum, [, list]) => sum + list.length, 0),
      categories: orphans.map(([key, list]) => ({
        key: key as Category,
        info: {
          label: humanise(key),
          singular: humanise(key),
          blurb: '',
        },
        components: list,
      })),
    });
  }

  return out;
}

/** The one line that says what makes this part different from its siblings. */
export function partSummary(component: ComponentDef): string {
  const record = component as unknown as Record<string, number | string | undefined>;
  const num = (key: string) => (typeof record[key] === 'number' ? (record[key] as number) : null);
  const str = (key: string) => String(record[key] ?? '').replace(/_/g, ' ');

  /**
   * Dimensions, which every component has.
   *
   * The fallback for any part whose category-specific fields are all absent.
   * Without it a tank that declares neither a propellant mass nor a propellant
   * type produced an *empty* summary line — a blank row in the catalogue where
   * the distinguishing detail should be. Falling back to size is always
   * truthful and always says something.
   */
  const dimensions = () =>
    `${component.length_m.toFixed(2)} m · ⌀${component.outerDiameter_m.toFixed(2)} m`;

  /** Join the parts that exist, or fall back to dimensions if none do. */
  const join = (...parts: (string | null)[]) => {
    const kept = parts.filter((p): p is string => !!p && p.trim().length > 0);
    return kept.length > 0 ? kept.join(' · ') : dimensions();
  };

  switch (component.category) {
    case 'nose_cone':
    case 'fairing': {
      const fineness = num('finenessRatio');
      const cd = num('dragCoefficient');
      return join(
        str('shape'),
        fineness !== null ? `fineness ${fineness.toFixed(1)}` : null,
        cd !== null ? `Cd ${cd.toFixed(2)}` : null,
      );
    }
    case 'fin': {
      const count = num('finCount');
      const span = num('span_m');
      return join(
        count !== null ? `${count} fins` : null,
        span !== null ? `${(span * 100).toFixed(0)} cm span` : null,
      );
    }
    case 'engine': {
      const thrust = num('thrustSeaLevel_N') ?? num('thrust_N');
      const isp = num('isp_vacuum_s');
      return join(
        thrust !== null ? `${(thrust / 1000).toFixed(thrust < 10_000 ? 1 : 0)} kN` : null,
        isp !== null ? `Isp ${isp.toFixed(0)} s` : null,
        str('propellantType') || null,
      );
    }
    case 'fuel_tank':
    case 'oxidizer_tank': {
      const propellant = num('propellantMass_kg');
      return join(
        propellant !== null ? `${propellant.toLocaleString()} kg propellant` : null,
        str('propellantType') || null,
      );
    }
    case 'parachute': {
      const diameter = num('deployedDiameter_m');
      return join(diameter !== null ? `${diameter.toFixed(1)} m canopy` : null);
    }
    case 'payload':
      return join(`${component.mass_kg.toLocaleString()} kg`);
    default:
      return dimensions();
  }
}

/** A mass in whichever unit keeps it readable. */
export function formatPartMass(kg: number): string {
  if (kg < 1) return `${(kg * 1000).toFixed(0)} g`;
  if (kg < 1000) return `${kg.toFixed(kg < 10 ? 1 : 0)} kg`;
  return `${(kg / 1000).toFixed(1)} t`;
}
