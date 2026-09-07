import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStockRegistry } from '@lostintospace/simulation-engine/core/catalog';
import type { ComponentDef } from '@lostintospace/simulation-engine/core/component-types';

import { ComponentPreview } from '@/components/features/build/ComponentPreview';
import { Badge, Button, Card, EmptyState, Input, Modal, SectionRule } from '@/components/ui';
import {
  categorySingular,
  classify,
  formatPartMass,
  partSummary,
} from '@/lib/componentTaxonomy';
import { PRESETS, buildPreset } from '@/lib/presets';
import { useMissionStore } from '@/stores/missionStore';

/**
 * Rocket Lab — the component catalogue and the way into the Builder.
 *
 * Every component and every number here comes from the simulation engine's
 * stock registry, which is the same source the builder and the flight
 * simulation read. There is no second catalogue: a spec shown on this page is
 * the spec that will fly.
 */

export default function RocketLab() {
  const navigate = useNavigate();
  const setDesign = useMissionStore((s) => s.setDesign);
  const registry = useMemo(() => createStockRegistry(), []);
  const components = useMemo(() => registry.listAll(), [registry]);

  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<string | null>(null);
  const [selected, setSelected] = useState<ComponentDef | null>(null);

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return components;
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.description?.toLowerCase().includes(needle) ||
        partSummary(c).toLowerCase().includes(needle),
    );
  }, [components, query]);

  /**
   * The catalogue, grouped into families and then categories.
   *
   * Derived from the shared taxonomy rather than counted ad hoc here, which is
   * what stopped this page and the Builder disagreeing about what a category
   * is called.
   */
  const groups = useMemo(() => classify(matching), [matching]);
  const shown = family ? groups.filter((g) => g.label === family) : groups;
  const total = groups.reduce((sum, g) => sum + g.total, 0);

  const startFrom = (presetId: string) => {
    const design = buildPreset(presetId);
    if (design) {
      setDesign(design, 'preset');
      navigate('/builder');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-10">
      <header>
        <h1 className="font-display text-2xl font-semibold text-space-100 mb-2">Rocket Lab</h1>
        <p className="text-sm text-space-400 max-w-2xl leading-relaxed">
          {components.length} components, each with the mass, thrust, specific impulse and
          structural limits the simulation actually uses. Pick a starting design, or browse the
          parts first.
        </p>
      </header>

      {/* Starting designs */}
      <section aria-labelledby="presets-heading">
        <h2 id="presets-heading" className="font-display text-sm font-semibold text-space-200 mb-3">
          Start from a design
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PRESETS.map((preset) => (
            <Card key={preset.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-space-100">
                  {preset.name}
                </h3>
                <Badge
                  variant={preset.difficulty === 'starter' ? 'nominal' : 'default'}
                  className="shrink-0"
                >
                  {preset.difficulty}
                </Badge>
              </div>
              <p className="text-xs text-space-400 leading-relaxed">{preset.summary}</p>
              <p className="text-2xs text-space-500 leading-relaxed">
                <span className="text-space-400">Teaches:</span> {preset.teaches}
              </p>
              <Button size="sm" className="mt-auto" onClick={() => startFrom(preset.id)}>
                Open in Builder
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Component catalogue ──────────────────────────────── */}
      <section aria-labelledby="catalog-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <h2 id="catalog-heading" className="font-display text-2xl leading-none text-ink-50">
              Component catalogue
            </h2>
            <p className="mt-1.5 text-xs text-ink-500">
              {total} part{total === 1 ? '' : 's'} in {groups.length} famil
              {groups.length === 1 ? 'y' : 'ies'}, each drawn to scale from its own dimensions.
            </p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parts…"
            aria-label="Search components"
            className="w-full sm:w-64"
          />
        </div>

        {/*
          Families, not a wall of chips.

          Twenty-two flat filter buttons wrapping across three ragged rows is
          not a classification — it is every leaf of the taxonomy shouted at
          once, and half of them were raw enum keys. Seven families, each with a
          count, is a thing you can read.
        */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by family">
          <button
            type="button"
            onClick={() => setFamily(null)}
            aria-pressed={family === null}
            className="chip"
          >
            Everything
            <span className="ml-1.5 font-mono text-[0.6rem] opacity-60">{total}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.label}
              type="button"
              onClick={() => setFamily(family === group.label ? null : group.label)}
              aria-pressed={family === group.label}
              className="chip"
            >
              {group.label}
              <span className="ml-1.5 font-mono text-[0.6rem] opacity-60">{group.total}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState
            title="No components match"
            description="Try a different search term, or clear the family filter."
          />
        ) : (
          <div className="space-y-8">
            {shown.map((group) => (
              <section key={group.label} className="space-y-4">
                <div>
                  <SectionRule label={group.label} />
                  <p className="mt-1.5 text-xs text-ink-500">{group.blurb}</p>
                </div>

                {group.categories.map((entry) => (
                  <div key={entry.key} className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <h3 className="font-display text-base leading-none text-ink-100">
                        {entry.info.label}
                      </h3>
                      <span className="font-mono text-[0.6rem] text-ink-600">
                        {entry.components.length}
                      </span>
                      <p className="min-w-0 flex-1 text-[0.7rem] leading-relaxed text-ink-500">
                        {entry.info.blurb}
                      </p>
                    </div>

                    {/*
                      A regular grid, one card per part, every card the same
                      height. The previous layout let each card size itself to
                      its description, so a row of three had three different
                      heights and the page read as rubble.
                    */}
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {entry.components.map((component) => (
                        <li key={component.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(component)}
                            className="glass-panel group flex h-full w-full items-stretch gap-3 overflow-hidden text-left focus-ring"
                          >
                            <span
                              className="block w-14 shrink-0 self-stretch transition-transform duration-settle ease-orbital group-hover:scale-105"
                              style={{ backgroundColor: 'var(--plane-0)' }}
                            >
                              <ComponentPreview component={component} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2.5 pr-3">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 text-[0.78rem] leading-snug text-ink-100">
                                  {component.name}
                                </span>
                                <span className="shrink-0 font-mono text-[0.62rem] text-ink-500">
                                  {formatPartMass(component.mass_kg)}
                                </span>
                              </span>
                              <span className="font-mono text-[0.6rem] leading-snug text-ink-500">
                                {partSummary(component)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>

      <ComponentDetail component={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Full specification for one component, straight from its registry entry. */
function ComponentDetail({
  component,
  onClose,
}: {
  component: ComponentDef | null;
  onClose: () => void;
}) {
  if (!component) return null;

  const record = component as unknown as Record<string, unknown>;
  const spec = (label: string, key: string, unit = '', scale = 1) => {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return { label, value: (value / scale).toLocaleString(undefined, { maximumFractionDigits: 2 }), unit };
  };

  const specs = [
    spec('Mass', 'mass_kg', 'kg'),
    spec('Length', 'length_m', 'm'),
    spec('Diameter', 'diameter_m', 'm'),
    spec('Sea-level thrust', 'thrustSeaLevel_N', 'kN', 1000),
    spec('Vacuum thrust', 'thrustVacuum_N', 'kN', 1000),
    spec('Sea-level Isp', 'isp_seaLevel_s', 's'),
    spec('Vacuum Isp', 'isp_vacuum_s', 's'),
    spec('Propellant', 'propellantMass_kg', 'kg'),
    spec('Drag coefficient', 'dragCoefficient'),
    spec('Cost', 'cost'),
  ].filter(Boolean) as { label: string; value: string; unit: string }[];

  const structural = record.structural as
    | { maxAxialLoad_N: number; maxDynamicPressure_Pa: number }
    | undefined;
  const failureModes = (record.failureModes ?? []) as { id: string; name: string; condition: string }[];

  return (
    <Modal open onClose={onClose} title={component.name}>
      <div className="space-y-5">
        <Badge>{categorySingular(component.category)}</Badge>
        <p className="text-xs text-space-400 leading-relaxed">{component.description}</p>

        <div>
          <h4 className="text-2xs uppercase tracking-wider text-space-500 mb-2">Specifications</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {specs.map((s) => (
              <div key={s.label} className="flex justify-between gap-2 border-b border-space-800/60 pb-1">
                <dt className="text-2xs text-space-500">{s.label}</dt>
                <dd className="text-2xs font-mono text-space-200">
                  {s.value}
                  {s.unit && <span className="text-space-500"> {s.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {structural && (
          <div>
            <h4 className="text-2xs uppercase tracking-wider text-space-500 mb-2">
              Structural limits
            </h4>
            <p className="text-2xs text-space-400 leading-relaxed">
              Fails above{' '}
              <span className="font-mono text-space-200">
                {(structural.maxAxialLoad_N / 1000).toFixed(0)} kN
              </span>{' '}
              axial load or{' '}
              <span className="font-mono text-space-200">
                {(structural.maxDynamicPressure_Pa / 1000).toFixed(0)} kPa
              </span>{' '}
              dynamic pressure. The weakest component on a stack sets the whole vehicle's limit.
            </p>
          </div>
        )}

        {failureModes.length > 0 && (
          <div>
            <h4 className="text-2xs uppercase tracking-wider text-space-500 mb-2">
              Known failure modes
            </h4>
            <ul className="space-y-1.5">
              {failureModes.map((mode) => (
                <li key={mode.id} className="text-2xs text-space-400 leading-relaxed">
                  <span className="text-space-200">{mode.name}</span> — {mode.condition}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-2xs text-space-600 leading-relaxed border-t border-space-800 pt-3">
          Values are engineering-plausible figures chosen for teaching, not the specification of
          any real hardware.
        </p>
      </div>
    </Modal>
  );
}
