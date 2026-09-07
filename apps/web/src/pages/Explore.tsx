import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Starfield } from '@/components/features/explore/Starfield';
import { Badge, EmptyState, ErrorPanel, Input, Spinner } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { catalog, type CatalogObject } from '@/services/api';

/**
 * Explore — the catalogue.
 *
 * ## Why this reads the bundled catalogue rather than the database
 *
 * It used to call `/space-objects`, which is served from PostgreSQL. With no
 * database configured that endpoint answers 503, so the entire page rendered a
 * "database unavailable" panel and nothing else — the page did not open at all.
 *
 * That dependency was wrong on its own terms, not just inconvenient. This
 * catalogue is *reference data*: published bulk parameters and verified NASA,
 * ESA and ISRO photography that ship with the repository and do not change
 * between deployments. Requiring a database server to read a constant is the
 * kind of coupling that makes a product fail for a reason unrelated to what it
 * is doing. The rest of the platform — builder, simulation, mission control,
 * search — already runs without one, and the landing page has always read this
 * same bundled catalogue.
 *
 * So Explore now reads `/catalog/objects`. It works offline, it works with no
 * database, and it shows *more* than the database path ever did: 70 objects
 * against whatever happened to be seeded.
 *
 * PostgreSQL keeps the job it is actually good at — saving *your* designs and
 * flights, which are not reference data.
 *
 * ## Classification
 *
 * The catalogue spans the solar system, the craft we have sent into it, deep
 * sky objects and exoplanets. A single flat run of filter chips gave no hint
 * that those are different kinds of thing, so they are grouped by `kind` into
 * families, in the order a reader works outward from home.
 */

/** Object kinds gathered into families, in reading order. */
const FAMILIES: readonly { label: string; kinds: readonly string[] }[] = [
  { label: 'Star and planets', kinds: ['star', 'planet', 'dwarf_planet'] },
  { label: 'Moons', kinds: ['moon'] },
  { label: 'Small bodies', kinds: ['asteroid', 'comet'] },
  { label: 'Missions and craft', kinds: ['spacecraft', 'telescope', 'station', 'satellite', 'launch_vehicle'] },
  { label: 'Deep sky', kinds: ['nebula', 'supernova_remnant', 'galaxy', 'galaxy_cluster', 'star_cluster', 'black_hole'] },
  { label: 'Exoplanets', kinds: ['exoplanet'] },
];

/** How each kind is written when it is shown as a label. */
const KIND_LABEL: Record<string, string> = {
  star: 'Star',
  planet: 'Planet',
  dwarf_planet: 'Dwarf planet',
  moon: 'Moon',
  asteroid: 'Asteroid',
  comet: 'Comet',
  spacecraft: 'Spacecraft',
  telescope: 'Telescope',
  station: 'Station',
  satellite: 'Satellite',
  launch_vehicle: 'Launch vehicle',
  nebula: 'Nebula',
  supernova_remnant: 'Supernova remnant',
  galaxy: 'Galaxy',
  galaxy_cluster: 'Galaxy cluster',
  star_cluster: 'Star cluster',
  black_hole: 'Black hole',
  exoplanet: 'Exoplanet',
};

export default function Explore() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);
  const [family, setFamily] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);

  const [objects, setObjects] = useState<CatalogObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One request, once. The catalogue is a constant of the deployment, so it is
  // fetched whole and filtered in the browser — which also makes searching and
  // switching families instant rather than a round trip each.
  useEffect(() => {
    let cancelled = false;
    catalog
      .objects()
      .then((rows) => {
        if (!cancelled) setObjects(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'The catalogue could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Families that actually have objects, with their kinds and counts. */
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const object of objects) counts.set(object.kind, (counts.get(object.kind) ?? 0) + 1);

    return FAMILIES.map((f) => {
      const kinds = f.kinds.filter((k) => (counts.get(k) ?? 0) > 0);
      const total = kinds.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0);
      return { ...f, kinds, total, counts };
    }).filter((f) => f.total > 0);
  }, [objects]);

  const openFamily = groups.find((g) => g.label === family) ?? null;

  const visible = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    return objects.filter((object) => {
      if (kind && object.kind !== kind) return false;
      if (family && !openFamily?.kinds.includes(object.kind)) return false;
      if (!needle) return true;
      return (
        object.name.toLowerCase().includes(needle) ||
        object.classification.toLowerCase().includes(needle) ||
        object.tagline.toLowerCase().includes(needle) ||
        (object.designation ?? '').toLowerCase().includes(needle)
      );
    });
  }, [objects, debounced, family, kind, openFamily]);

  /** Results grouped under their family heading, so the page reads as a catalogue. */
  const sections = useMemo(() => {
    return groups
      .map((group) => ({
        label: group.label,
        objects: visible.filter((o) => group.kinds.includes(o.kind)),
      }))
      .filter((s) => s.objects.length > 0);
  }, [groups, visible]);

  const clear = () => {
    setFamily(null);
    setKind(null);
  };

  return (
    <div>
      {/* ── Masthead ───────────────────────────────────────── */}
      <div className="relative overflow-hidden hairline-b">
        <Starfield className="absolute inset-0" density={140} />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          <p className="t-label mb-3">Explore</p>
          <h1 className="font-display text-4xl leading-none text-ink-50 sm:text-display-sm md:text-5xl">
            Everything in the catalogue
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-400">
            The Sun and its planets, their moons, the small bodies between them, the craft we have
            sent out, and the nebulae, galaxies and exoplanets beyond — each with the source of
            every figure attached, and every photograph shown whole rather than cropped to fit.
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the catalogue…"
            aria-label="Search the catalogue"
            className="mt-6 w-full max-w-md"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* ── Classification ───────────────────────────────── */}
        {groups.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by family">
              <button
                type="button"
                onClick={clear}
                aria-pressed={family === null && kind === null}
                className="chip"
              >
                Everything
                <span className="ml-1.5 font-mono text-[0.6rem] opacity-60">{objects.length}</span>
              </button>
              {groups.map((group) => (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => {
                    setKind(null);
                    setFamily(family === group.label ? null : group.label);
                  }}
                  aria-pressed={family === group.label}
                  className="chip"
                >
                  {group.label}
                  <span className="ml-1.5 font-mono text-[0.6rem] opacity-60">{group.total}</span>
                </button>
              ))}
            </div>

            {openFamily && openFamily.kinds.length > 1 && (
              <div
                className="flex flex-wrap gap-1.5 hairline-t pt-2"
                role="group"
                aria-label={`Kinds within ${openFamily.label}`}
              >
                {openFamily.kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(kind === k ? null : k)}
                    aria-pressed={kind === k}
                    className="chip"
                  >
                    {KIND_LABEL[k] ?? k}
                    <span className="ml-1.5 font-mono text-[0.6rem] opacity-60">
                      {openFamily.counts.get(k)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorPanel message={error} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            description="Try a different search term, or clear the filters."
          />
        ) : (
          <>
            <p className="font-mono text-tiny text-ink-600">
              {visible.length} of {objects.length} objects
            </p>

            {sections.map((section) => (
              <section key={section.label} className="space-y-3">
                <h2 className="rule-label">
                  {section.label}
                  <span className="ml-2 font-mono text-[0.6rem] text-ink-600">
                    {section.objects.length}
                  </span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.objects.map((object) => (
                    <li key={object.id}>
                      <ObjectCard object={object} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}

        {/* Provenance is not a footnote here: it is the product's argument. */}
        <p className="text-[0.65rem] leading-relaxed text-ink-600 hairline-t pt-4">
          Bulk parameters from NASA's planetary fact sheets and JPL Solar System Dynamics;
          exoplanet parameters from the NASA Exoplanet Archive; Indian mission and
          Earth-observation records from ISRO. Photographs are NASA, ESA and ISRO imagery,
          each verified before being catalogued and shown with its credit. Objects with no
          verified photograph are drawn from their measured colour and albedo instead of
          borrowing a picture of something else.
        </p>
      </div>
    </div>
  );
}

/**
 * One object.
 *
 * The photograph gets a fixed 4:3 stage and is *contained* within it, so a tall
 * frame letterboxes rather than losing its ends. These are observations, and
 * the framing is part of the observation.
 */
function ObjectCard({ object }: { object: CatalogObject }) {
  return (
    <Link
      to={`/explore/${object.id}`}
      className="glass-panel flex h-full flex-col overflow-hidden focus-ring"
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '4 / 3', backgroundColor: 'var(--plane-0)' }}
      >
        {object.image?.url ? (
          <img
            src={object.image.url}
            alt={object.image.alt ?? ''}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <DrawnBody object={object} />
        )}
        {object.image?.credit && (
          <span className="absolute bottom-0 right-0 bg-ink-1000/70 px-1.5 py-0.5 font-mono text-[0.55rem] text-ink-400">
            {object.image.credit}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-display text-base leading-tight text-ink-100">
            {object.name}
          </h3>
          <Badge className="shrink-0">{KIND_LABEL[object.kind] ?? object.kind}</Badge>
        </div>
        <p className="text-[0.6rem] uppercase tracking-label text-ink-600">
          {object.classification}
        </p>
        <p className="line-clamp-3 text-[0.7rem] leading-relaxed text-ink-400">{object.tagline}</p>
      </div>
    </Link>
  );
}

/**
 * A body drawn from its own measured appearance.
 *
 * Used where no verified photograph exists. The colour, the albedo and the
 * terminator are catalogue data, so this is a *depiction* built from
 * measurements rather than a placeholder — and it is lit from the upper left,
 * like every other surface in this interface.
 */
function DrawnBody({ object }: { object: CatalogObject }) {
  const base = object.appearance?.base_color ?? '#625C51';
  const accent = object.appearance?.accent_color ?? base;
  const id = `lis-body-${object.id}`;

  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 120 90" className="h-full w-full">
        <defs>
          <radialGradient id={id} cx="0.34" cy="0.28" r="0.9">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="45" r="24" fill={base} />
        <circle cx="60" cy="45" r="24" fill={accent} opacity="0.35" />
        <circle cx="60" cy="45" r="24" fill={`url(#${id})`} />
      </svg>
      <span className="absolute bottom-2 font-mono text-[0.55rem] text-ink-700">
        drawn from measured colour
      </span>
    </div>
  );
}
