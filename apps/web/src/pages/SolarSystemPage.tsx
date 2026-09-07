import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { SolarSystem } from '@/components/features/space/SolarSystem';
import { BODIES_BY_ID, type SystemBody } from '@/components/features/space/systemBodies';
import { Badge, Panel, Readout, SectionRule } from '@/components/ui';
import { useMissionStore } from '@/stores/missionStore';

/**
 * The solar system, at full height.
 *
 * The product could describe a destination but never *show* it: choosing Mars
 * changed a Δv budget and nothing on screen. This is where the places
 * themselves live — every planet and the major moons, drawn from measured radii
 * and surfaces, arranged on their real orbits, with a camera that goes from
 * skimming a moon to holding Neptune's orbit in frame.
 *
 * `?focus=<id>` frames a body on arrival, which is how the launch page and
 * mission control link into it: "show me where I am going" is one click, and it
 * lands with the destination already centred and marked.
 */
export default function SolarSystemPage() {
  const [params, setParams] = useSearchParams();
  const destinationId = useMissionStore((s) => s.mission.destinationId);

  // The focus is the URL's if it names one, otherwise the current mission's.
  const requested = params.get('focus') ?? destinationId;
  const [selected, setSelected] = useState<SystemBody | null>(
    BODIES_BY_ID.get(requested ?? '') ?? null,
  );

  const handleSelect = (body: SystemBody) => {
    setSelected(body);
    // Keep the URL honest, so the view is shareable and survives a reload.
    setParams({ focus: body.id }, { replace: true });
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 hairline-b pb-4">
        <div>
          <p className="t-label mb-1">Explore · The solar system</p>
          <h1 className="font-display text-3xl leading-none text-ink-50">
            {selected ? selected.name : 'The solar system'}
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-500">
            Every body drawn from its measured radius, surface and axial tilt, on its measured
            orbit. Drag to turn the system, scroll to zoom from a moon's surface out past
            Neptune, right-drag to pan.
          </p>
        </div>
        {destinationId && BODIES_BY_ID.get(destinationId) && (
          <Badge>Mission destination · {BODIES_BY_ID.get(destinationId)!.name}</Badge>
        )}
      </header>

      <SolarSystem
        focusId={requested}
        onSelect={handleSelect}
        className="h-[62vh] min-h-[420px] w-full overflow-hidden rounded-panel"
      />

      {selected && (
        <>
          <SectionRule label={selected.name} className="mt-6" />
          <Panel className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-300">{selected.tagline}</p>

            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
              <Readout
                label="Mean radius"
                value={(selected.radius_m / 1000).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                unit="km"
                size="sm"
                hint={`${(selected.radius_m / 6_371_000).toFixed(3)}× Earth`}
              />
              {selected.orbitRadius_m > 0 && (
                <Readout
                  label={selected.parent === 'sol' ? 'From the Sun' : `From ${labelOf(selected.parent)}`}
                  value={(selected.orbitRadius_m / 1e9).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  unit="million km"
                  size="sm"
                />
              )}
              {selected.orbitPeriod_d !== 0 && (
                <Readout
                  label="Orbital period"
                  value={Math.abs(selected.orbitPeriod_d).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
                  unit="days"
                  size="sm"
                  hint={selected.orbitPeriod_d < 0 ? 'Retrograde' : undefined}
                />
              )}
              <Readout
                label="Rotation"
                value={Math.abs(selected.rotationPeriod_h).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                unit="hours"
                size="sm"
                hint={selected.rotationPeriod_h < 0 ? 'Retrograde' : undefined}
              />
              <Readout
                label="Axial tilt"
                value={selected.axialTilt_deg.toFixed(2)}
                unit="°"
                size="sm"
                hint={selected.axialTilt_deg > 90 ? 'Rotates upside down' : undefined}
              />
            </dl>

            <div className="flex flex-wrap gap-4 hairline-t pt-3">
              <Link
                to={`/explore/${selected.id}`}
                className="font-condensed text-micro uppercase tracking-instrument text-signal-flame transition-colors hover:text-signal-flame-bright"
              >
                Full record for {selected.name} →
              </Link>
              <Link
                to="/launch"
                className="font-condensed text-micro uppercase tracking-instrument text-ink-500 transition-colors hover:text-ink-200"
              >
                Plan a mission there
              </Link>
            </div>
          </Panel>
        </>
      )}

      <p className="mt-4 text-[0.65rem] leading-relaxed text-ink-600">
        Radii, orbital elements, rotation periods and tilts are published bulk parameters from
        NASA's planetary fact sheets and JPL Solar System Dynamics. Surfaces are generated from
        each body's measured colour, albedo and surface class — depictions built from
        measurements, not photographs. Bodies sit at a fixed arrangement on their orbits: this
        shows you the system's geometry, not where a planet is tonight.
      </p>
    </div>
  );
}

/** A parent body's name, for the distance readout's label. */
function labelOf(parentId: string | null): string {
  if (!parentId) return 'its primary';
  return BODIES_BY_ID.get(parentId)?.name ?? parentId;
}
