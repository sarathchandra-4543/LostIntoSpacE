import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge, Button, Panel, Readout, SectionRule, Spinner } from '@/components/ui';
import { catalog, type CatalogImage, type CatalogObject, type CatalogProperty } from '@/services/api';

/**
 * One catalogued object.
 *
 * Reads the bundled catalogue for the same reason Explore does: this is
 * reference data that ships with the repository, and it should not need a
 * database server to be readable. It previously called the PostgreSQL-backed
 * `/space-objects/{id}`, so following any link out of Explore landed on a
 * "database unavailable" panel.
 *
 * Properties are rendered from whatever the record actually carries rather than
 * from a fixed field list: a comet has no atmosphere and a star has no orbital
 * period, and printing "—" for every inapplicable field is noise.
 */
export default function ObjectDetail() {
  const { objectId } = useParams();
  const [object, setObject] = useState<CatalogObject | null>(null);
  const [related, setRelated] = useState<CatalogObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!objectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    catalog
      .object(objectId)
      .then((data) => {
        if (!cancelled) setObject(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load the object.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [objectId]);

  // The related objects are fetched as a set once the record names them, so the
  // page can offer somewhere to go next rather than dead-ending.
  useEffect(() => {
    if (!object?.related_ids?.length) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      object.related_ids.slice(0, 6).map((id) => catalog.object(id).catch(() => null)),
    ).then((rows) => {
      if (!cancelled) setRelated(rows.filter((r): r is CatalogObject => r !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [object]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (error || !object) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl text-ink-100">Object not found</h1>
        <p className="text-sm text-ink-400">{error ?? 'No object with that identifier.'}</p>
        <Link to="/explore">
          <Button>Back to Explore</Button>
        </Link>
      </div>
    );
  }

  const hasAtmosphere = object.atmosphere?.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to="/explore"
        className="font-condensed text-micro uppercase tracking-instrument text-ink-500 transition-colors hover:text-ink-200"
      >
        ← Explore
      </Link>

      {/* ── Identity ───────────────────────────────────────── */}
      <header className="space-y-2">
        <p className="t-label">{object.classification}</p>
        <h1 className="font-display text-4xl leading-none text-ink-50 md:text-5xl">
          {object.name}
        </h1>
        {object.designation && object.designation !== object.name && (
          <p className="font-mono text-tiny text-ink-500">{object.designation}</p>
        )}
        <p className="max-w-2xl text-sm leading-relaxed text-ink-300">{object.tagline}</p>
      </header>

      {/* ── The photograph ─────────────────────────────────── */}
      {object.image?.url ? (
        <Figure image={object.image} fallbackAlt={object.name} />
      ) : (
        <Panel className="text-center">
          <p className="text-xs text-ink-500">
            No verified photograph of {object.name} is catalogued. Rather than borrow an image of
            something else, this record carries none — its colour and albedo are still measured
            values, and the explorer draws it from those.
          </p>
        </Panel>
      )}

      {/* ── Overview ───────────────────────────────────────── */}
      <Panel>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-300">
          {object.overview}
        </p>
      </Panel>

      {/* ── Measurements ───────────────────────────────────── */}
      {object.physical.length > 0 && (
        <>
          <SectionRule label="Physical" />
          <PropertyGrid properties={object.physical} />
        </>
      )}

      {object.orbital.length > 0 && (
        <>
          <SectionRule label="Orbit and rotation" />
          <PropertyGrid properties={object.orbital} />
        </>
      )}

      {hasAtmosphere && (
        <>
          <SectionRule label="Atmosphere" />
          <PropertyGrid properties={object.atmosphere} />
        </>
      )}

      {/* ── Facts ──────────────────────────────────────────── */}
      {object.facts.length > 0 && (
        <>
          <SectionRule label="Worth knowing" />
          <Panel flush className="divide-y divide-[color:var(--rule-faint)]">
            {object.facts.map((fact) => (
              <p key={fact} className="px-4 py-3 text-sm leading-relaxed text-ink-300">
                {fact}
              </p>
            ))}
          </Panel>
        </>
      )}

      {/* ── Gallery ────────────────────────────────────────── */}
      {object.gallery.length > 0 && (
        <>
          <SectionRule label="More imagery" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {object.gallery.map((image) => (
              <li key={image.url}>
                <Figure image={image} fallbackAlt={object.name} compact />
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ── Where to go next ───────────────────────────────── */}
      {related.length > 0 && (
        <>
          <SectionRule label="Related" />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((neighbour) => (
              <li key={neighbour.id}>
                <Link to={`/explore/${neighbour.id}`} className="glass-panel block p-3 focus-ring">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-ink-100">{neighbour.name}</span>
                    <Badge className="shrink-0">{neighbour.kind.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[0.65rem] leading-relaxed text-ink-500">
                    {neighbour.tagline}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ── Where the numbers came from ────────────────────── */}
      <SectionRule label="Provenance" />
      <Panel className="space-y-2">
        {object.sources.length > 0 ? (
          <ul className="space-y-1.5">
            {object.sources.map((source) => (
              <li key={source.source_name} className="text-xs leading-relaxed text-ink-400">
                <span className="text-ink-200">{source.source_name}</span>
                {source.source_url && (
                  <>
                    {' — '}
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-signal-flame transition-colors hover:text-signal-flame-bright"
                    >
                      {source.source_url}
                    </a>
                  </>
                )}
                {source.attribution && (
                  <span className="block text-[0.65rem] text-ink-600">{source.attribution}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-500">No source recorded for this record.</p>
        )}
        <p className="text-[0.65rem] leading-relaxed text-ink-600 hairline-t pt-2">
          Figures are as published by the source and are not re-derived here. Where a value is
          quoted to a given precision, that is the precision the reference gives it.
        </p>
      </Panel>
    </div>
  );
}

/** A photograph, shown whole, with the attribution it is owed. */
function Figure({
  image,
  fallbackAlt,
  compact,
}: {
  image: CatalogImage;
  fallbackAlt: string;
  compact?: boolean;
}) {
  return (
    <figure
      className="overflow-hidden rounded-panel"
      style={{ backgroundColor: 'var(--plane-0)' }}
    >
      <img
        src={image.url}
        alt={image.alt || fallbackAlt}
        loading="lazy"
        decoding="async"
        className={
          compact
            ? 'mx-auto block h-40 w-full object-contain'
            : 'mx-auto block max-h-[28rem] w-full object-contain'
        }
      />
      <figcaption className="px-3 py-2 font-mono text-[0.6rem] leading-relaxed text-ink-500 hairline-t">
        {image.title}
        {image.credit && <span className="text-ink-600"> · {image.credit}</span>}
        {image.instrument && <span className="block text-ink-700">{image.instrument}</span>}
      </figcaption>
    </figure>
  );
}

/** Measured properties, rendered the way the record says to render them. */
function PropertyGrid({ properties }: { properties: CatalogProperty[] }) {
  return (
    <Panel>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <Readout
            key={property.label}
            label={property.label}
            value={formatProperty(property)}
            unit={property.display ? undefined : (property.unit ?? undefined)}
            size="sm"
            hint={
              property.earth_ratio != null
                ? `${property.earth_ratio.toLocaleString(undefined, { maximumFractionDigits: 3 })}× Earth`
                : (property.note ?? undefined)
            }
          />
        ))}
      </dl>
    </Panel>
  );
}

/** Render one catalogue property the way its record says to. */
function formatProperty(property: CatalogProperty): string {
  if (property.display) return property.display;
  if (property.value === null || property.value === undefined) return '—';

  const value = property.value;
  const magnitude = Math.abs(value);

  if (magnitude >= 1e6 || (magnitude > 0 && magnitude < 0.001)) {
    // Scientific notation, rendered the way a reference table would.
    const exponent = Math.floor(Math.log10(magnitude));
    const mantissa = value / 10 ** exponent;
    return `${mantissa.toFixed(2)}×10${superscript(exponent)}`;
  }
  if (magnitude >= 1000) return value.toLocaleString('en', { maximumFractionDigits: 0 });
  return value.toFixed(property.precision ?? (magnitude < 10 ? 2 : 1));
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function superscript(n: number): string {
  const sign = n < 0 ? '⁻' : '';
  return (
    sign +
    Math.abs(n)
      .toString()
      .split('')
      .map((d) => SUPERSCRIPTS[Number(d)] ?? d)
      .join('')
  );
}
