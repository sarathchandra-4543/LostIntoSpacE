import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { DatabaseUnavailable } from '@/components/layout/DatabaseUnavailable';
import { Starfield } from '@/components/features/explore/Starfield';
import { Badge, EmptyState, ErrorPanel, Input, Panel, Spinner } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { spaceObjects } from '@/services/api';
import type { SpaceObject } from '@/types';


/**
 * Explore — the catalogue, browsed visually.
 *
 * ## What was wrong with it
 *
 * Two things, both about photographs. Every image was drawn into a fixed
 * 128-pixel band with `object-cover`, so a portrait-format Hubble frame lost
 * its top and bottom and a wide Cassini mosaic lost its ends. What survived was
 * the middle of the picture, which for a ringed planet or an edge-on galaxy is
 * often the least informative part of it. These are *scientific* images: the
 * framing is the observation, and cropping it away is closer to falsifying it
 * than to styling it.
 *
 * They are now given a fixed 4:3 stage and contained inside it, so the whole
 * frame is visible whatever its aspect. The letterboxing that results is the
 * honest outcome — the image is the shape it is.
 *
 * ## Classification
 *
 * The catalogue spans planets, moons, small bodies, spacecraft, deep-sky
 * objects and exoplanets, and a single flat run of filter chips gave no hint
 * that those are different *kinds* of thing. They are grouped now, in the order
 * a reader naturally works outward: the solar system, then what orbits it, then
 * what we have built, then everything beyond.
 */

/**
 * Categories gathered into families.
 *
 * Keyed on the substrings the API's category strings actually contain, so a
 * category the backend adds later still lands somewhere sensible rather than
 * vanishing from the filter bar.
 */
const FAMILIES: readonly { label: string; match: readonly string[] }[] = [
  { label: 'Solar system', match: ['planet', 'star', 'sun', 'dwarf'] },
  { label: 'Moons', match: ['moon', 'satellite', 'natural'] },
  { label: 'Small bodies', match: ['asteroid', 'comet', 'meteor', 'kuiper', 'trans-neptunian'] },
  { label: 'Missions and craft', match: ['spacecraft', 'craft', 'probe', 'rover', 'lander', 'station', 'telescope', 'launch'] },
  { label: 'Deep sky', match: ['nebula', 'galaxy', 'cluster', 'black hole', 'supernova', 'remnant', 'quasar', 'pulsar'] },
  { label: 'Exoplanets', match: ['exoplanet'] },
];

/** Which family a category string belongs to, or null if none claims it. */
function familyOf(category: string): string | null {
  const needle = category.toLowerCase();
  for (const family of FAMILIES) {
    if (family.match.some((token) => needle.includes(token))) return family.label;
  }
  return null;
}

export default function Explore() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const [category, setCategory] = useState<string | null>(null);
  const [family, setFamily] = useState<string | null>(null);

  const [items, setItems] = useState<SpaceObject[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dbDown, setDbDown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    spaceObjects
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    spaceObjects
      .list({
        q: debounced.trim() || undefined,
        category: category ?? undefined,
        per_page: 60,
      })
      .then(({ items: rows, total: count }) => {
        if (cancelled) return;
        setItems(rows);
        setTotal(count);
        setDbDown(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : 'Objects could not be loaded.';
        // A 503 from readiness, or a driver error, both mean "no database".
        setDbDown(/database|unavailable|reach|connect/i.test(message));
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, category]);

  /** Categories present in the catalogue, grouped into families. */
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of categories) {
      const key = familyOf(name) ?? 'Other';
      map.set(key, [...(map.get(key) ?? []), name]);
    }
    // Preserve the declared family order; anything unclaimed falls to the end.
    const ordered: { label: string; categories: string[] }[] = [];
    for (const declared of FAMILIES) {
      const found = map.get(declared.label);
      if (found?.length) ordered.push({ label: declared.label, categories: found });
    }
    const other = map.get('Other');
    if (other?.length) ordered.push({ label: 'Other', categories: other });
    return ordered;
  }, [categories]);

  /** Category chips for the open family, or the families themselves. */
  const openFamily = grouped.find((g) => g.label === family) ?? null;

  const clearFilters = () => {
    setCategory(null);
    setFamily(null);
  };

  return (
    <div>
      {/* ── Masthead ───────────────────────────────────────── */}
      <div className="relative overflow-hidden hairline-b">
        <Starfield className="absolute inset-0" density={140} />
        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 md:py-14">
          <p className="t-label mb-3">Explore</p>
          <h1 className="font-display text-display-sm leading-none text-ink-50 md:text-5xl">
            Everything in the catalogue
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-400">
            Planets, moons, small bodies, spacecraft and deep-sky objects — every figure carrying
            the source it came from, and every photograph shown whole rather than cropped to fit a
            card.
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the catalogue…"
            aria-label="Search space objects"
            className="mt-6 w-full max-w-md"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 px-5 py-6 sm:px-6">
        {/* ── Classification ───────────────────────────────── */}
        {grouped.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by family">
              <button
                type="button"
                onClick={clearFilters}
                aria-pressed={family === null && category === null}
                className="chip"
              >
                Everything
              </button>
              {grouped.map((group) => (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => {
                    setCategory(null);
                    setFamily(family === group.label ? null : group.label);
                  }}
                  aria-pressed={family === group.label}
                  className="chip"
                >
                  {group.label}
                  <span className="ml-1.5 font-mono text-[0.6rem] opacity-60">
                    {group.categories.length}
                  </span>
                </button>
              ))}
            </div>

            {openFamily && (
              <div
                className="flex flex-wrap gap-1.5 hairline-t pt-2"
                role="group"
                aria-label={`Categories in ${openFamily.label}`}
              >
                {openFamily.categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCategory(category === name ? null : name)}
                    aria-pressed={category === name}
                    className="chip"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────── */}
        {dbDown ? (
          <DatabaseUnavailable what="The space-object catalogue" />
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorPanel message={error} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            description="Try a different search term, or clear the filters."
          />
        ) : (
          <>
            <p className="font-mono text-tiny text-ink-600">
              {total} object{total === 1 ? '' : 's'}
              {category ? ` in ${category}` : ''}
            </p>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((object) => (
                <li key={object.id}>
                  <ObjectCard object={object} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Provenance is not a footnote here: it is the product's argument. */}
        <Panel className="mt-2">
          <p className="text-[0.65rem] leading-relaxed text-ink-500">
            Bulk parameters come from NASA's planetary fact sheets and JPL Solar System Dynamics;
            exoplanet parameters from the NASA Exoplanet Archive; orbital elements from CelesTrak
            and the Minor Planet Center; Indian mission and Earth-observation records from ISRO.
            Photographs are NASA, ESA and ISRO public-domain or open-licence imagery, each shown
            with the credit attached. Every record carries its own source — open one to see it.
          </p>
        </Panel>
      </div>
    </div>
  );
}

/**
 * One object.
 *
 * The photograph gets a fixed 4:3 stage and is *contained* within it, so a tall
 * frame letterboxes rather than losing its ends. Objects with no verified
 * photograph get a drawn placeholder rather than an empty box — a gap in a grid
 * of pictures reads as a failure, and "we have no image of this" is a different
 * statement from "this failed to load".
 */
function ObjectCard({ object }: { object: SpaceObject }) {
  const image = object.images?.[0];

  return (
    <Link
      to={`/explore/${object.id}`}
      className="glass-panel flex h-full flex-col overflow-hidden focus-ring"
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '4 / 3', backgroundColor: 'var(--plane-0)' }}
      >
        {image?.url ? (
          <img
            src={image.url}
            alt={image.alt ?? ''}
            loading="lazy"
            decoding="async"
            // Contained, not covered: these are observations, and the framing
            // is part of the observation.
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <NoImage name={object.name} />
        )}
        {image?.credit && (
          <span className="absolute bottom-0 right-0 bg-ink-1000/70 px-1.5 py-0.5 font-mono text-[0.55rem] text-ink-400">
            {image.credit}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-base leading-tight text-ink-100">
            {object.name}
          </h2>
          <Badge className="shrink-0">{object.category}</Badge>
        </div>
        {object.description && (
          <p className="line-clamp-3 text-[0.7rem] leading-relaxed text-ink-400">
            {object.description}
          </p>
        )}
        {object.source && (
          <p className="mt-auto pt-1 font-mono text-[0.55rem] text-ink-700">{object.source}</p>
        )}
      </div>
    </Link>
  );
}

/** A drawn stand-in for an object with no verified photograph. */
function NoImage({ name }: { name: string }) {
  // Seeded from the name, so a given object always draws the same way rather
  // than shuffling on every render.
  const seed = [...name].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const hue = seed % 360;

  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 120 90" className="h-full w-full">
        <circle
          cx="60"
          cy="45"
          r="22"
          fill={`hsl(${hue} 22% 38%)`}
          opacity="0.85"
        />
        <circle cx="60" cy="45" r="22" fill="url(#lis-limb)" />
        <defs>
          <radialGradient id="lis-limb" cx="0.32" cy="0.28" r="0.85">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="0.6" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.55" />
          </radialGradient>
        </defs>
      </svg>
      <span className="absolute bottom-2 font-mono text-[0.55rem] text-ink-700">
        no verified photograph
      </span>
    </div>
  );
}
