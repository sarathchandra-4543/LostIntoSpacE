import { useMemo } from 'react';

import {
  DESTINATIONS_BY_ID,
  DESTINATION_GROUPS,
  earthGravityRatio,
  earthRadiusRatio,
  escapeVelocity,
  lightTime_s,
  meanDensity,
  solarConstant,
  surfaceGravity,
  totalDeltaV,
  type Destination,
} from '@lostintospace/simulation-engine/core/destinations';
import {
  assessMission,
  formatDuration,
  terminalVelocity,
  type MissionFeasibility,
} from '@lostintospace/simulation-engine/core/mission-planning';

import { Badge, Readout, StatusDot } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Where the rocket is going.
 *
 * The product simulated ascents with no destination attached, which made every
 * flight the same flight at a different altitude. Nothing the user chose in the
 * builder had anything to answer to.
 *
 * A destination gives every one of those choices a consequence. The cruise
 * duration decides whether the propellant is still liquid on arrival; the
 * arrival atmosphere decides whether the vehicle brakes on a shield or on an
 * engine; the distance from the Sun decides whether solar panels make power;
 * the light time decides whether a landing can be flown from Earth at all.
 *
 * So the picker is not a dropdown. Choosing Mars has to visibly *change the
 * problem*, and the brief beside it is where that change is stated: the Δv
 * budget leg by leg, the surface conditions the vehicle has to survive, the
 * window it has to leave in, and the parts it is now obliged to carry.
 *
 * Every number is derived from the catalogue's published bulk parameters
 * rather than typed in twice — gravity from mass and radius, irradiance from
 * heliocentric distance, terminal velocity from gravity and density.
 */

/** The size of a body drawn against Earth, so the ratio is seen and not read. */
function SizeComparison({ destination }: { destination: Destination }) {
  const ratio = earthRadiusRatio(destination);
  if (ratio <= 0) return null;

  // Compressed by a square root: Jupiter is 11 Earths across and would push
  // everything else to a sub-pixel dot at true scale. The ordering survives,
  // and the numeral beneath carries the real figure.
  const BOX = 64;
  const earth = 20;
  const body = Math.max(3, Math.min(BOX / 2, earth * Math.sqrt(ratio)));

  return (
    <figure className="flex items-center gap-3">
      <svg
        width={BOX}
        height={BOX}
        viewBox={`0 0 ${BOX} ${BOX}`}
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx={BOX / 2} cy={BOX / 2} r={earth} fill="none" stroke="#4E7C8E" strokeWidth="1" strokeDasharray="2 3" />
        <circle cx={BOX / 2} cy={BOX / 2} r={body} fill={destination.color} opacity="0.9" />
      </svg>
      <figcaption className="min-w-0">
        <p className="font-mono text-sm tabular-nums text-ink-100">{ratio.toFixed(2)}×</p>
        <p className="t-label">Earth radius</p>
        <p className="mt-1 font-mono text-[0.6rem] text-ink-600">
          {(destination.radius_m / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km
        </p>
      </figcaption>
    </figure>
  );
}

/** One selectable destination. */
function DestinationTile({
  destination,
  selected,
  feasibility,
  onSelect,
}: {
  destination: Destination;
  selected: boolean;
  feasibility: MissionFeasibility | null;
  onSelect: () => void;
}) {
  const reachable = feasibility
    ? feasibility.reachable || feasibility.reachableWithAerobraking
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected}
      aria-pressed={selected}
      className="glass-panel w-full p-3 text-left focus-ring"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 32% 30%, ${destination.color}, ${destination.accentColor})`,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-ink-100">{destination.name}</span>
            {reachable !== null && (
              <StatusDot tone={reachable ? 'nominal' : 'caution'} className="mt-1 shrink-0" />
            )}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[0.6rem] text-ink-500">
            <span>{(totalDeltaV(destination) / 1000).toFixed(1)} km/s</span>
            <span>{formatDuration(destination.transferTime_s)}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

export interface DestinationPickerProps {
  /** Currently selected destination id. */
  value: string;
  onChange: (destinationId: string) => void;
  /**
   * Δv the current design actually has. Drives the reachability marks, so the
   * picker itself tells you which of these your rocket can do.
   */
  availableDeltaV_ms: number | null;
  className?: string;
}

export function DestinationPicker({
  value,
  onChange,
  availableDeltaV_ms,
  className,
}: DestinationPickerProps) {
  const assessments = useMemo(() => {
    if (availableDeltaV_ms === null) return new Map<string, MissionFeasibility>();
    const map = new Map<string, MissionFeasibility>();
    for (const [id, destination] of DESTINATIONS_BY_ID) {
      map.set(id, assessMission(destination, availableDeltaV_ms));
    }
    return map;
  }, [availableDeltaV_ms]);

  return (
    <div className={cn('space-y-4', className)}>
      {DESTINATION_GROUPS.map((group) => (
        <section key={group.label}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="t-label">{group.label}</h3>
            <p className="font-mono text-[0.6rem] text-ink-600">{group.note}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.ids.map((id) => {
              const destination = DESTINATIONS_BY_ID.get(id);
              if (!destination) return null;
              return (
                <DestinationTile
                  key={id}
                  destination={destination}
                  selected={id === value}
                  feasibility={assessments.get(id) ?? null}
                  onSelect={() => onChange(id)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Temperature written the way a planetary scientist quotes it. */
function kelvin(value: number): string {
  const celsius = value - 273.15;
  return `${value.toFixed(0)} K (${celsius > 0 ? '+' : ''}${celsius.toFixed(0)} °C)`;
}

/** A distance in the unit that keeps it readable. */
function distance(metres: number): string {
  const km = metres / 1000;
  if (km < 1e6) return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  return `${(km / 1e6).toFixed(1)} million km`;
}

/**
 * Everything the destination does to the mission.
 *
 * Four questions, in the order they constrain each other: what is it, what will
 * it take to get there, what will the vehicle meet on arrival, and what does
 * that force into the design.
 */
export function DestinationBrief({
  destination,
  feasibility,
  className,
}: {
  destination: Destination;
  feasibility: MissionFeasibility | null;
  className?: string;
}) {
  const atmosphere = destination.atmosphere;
  const gravity = surfaceGravity(destination);
  const terminal = terminalVelocity(destination);
  const isPointDestination = destination.radius_m <= 0;

  return (
    <div className={cn('space-y-5', className)}>
      {/* ── What it is ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="t-label">{destination.tagline}</p>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-300">
            {destination.challenge}
          </p>
        </div>
        {!isPointDestination && <SizeComparison destination={destination} />}
      </div>

      {/* ── Δv budget ──────────────────────────────────────── */}
      <section>
        <h3 className="t-label mb-2">
          Δv budget, from a {(destination.parkingOrbitAltitude_m / 1000).toFixed(0)} km parking orbit
        </h3>
        <ul className="divide-y divide-[color:var(--rule-faint)]">
          {destination.deltaVBudget.map((leg) => (
            <li key={leg.id} className="flex items-baseline justify-between gap-4 py-2">
              <div className="min-w-0">
                <p className="text-xs text-ink-200">
                  {leg.label}
                  {leg.aerobrakeable && (
                    <Badge className="ml-2 align-middle">heat shield can pay this</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-[0.65rem] leading-relaxed text-ink-500">{leg.note}</p>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-ink-100">
                {leg.deltaV_ms === 0 ? 'free' : `${leg.deltaV_ms.toLocaleString()} m/s`}
              </span>
            </li>
          ))}
        </ul>

        {feasibility && (
          <div className="mt-3 space-y-2 hairline-t pt-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <Readout
                label="Ascent to orbit"
                value={feasibility.ascentDeltaV_ms.toFixed(0)}
                unit="m/s"
                size="sm"
                hint="Circular speed plus losses"
              />
              <Readout
                label="Above the orbit"
                value={feasibility.transferDeltaV_ms.toFixed(0)}
                unit="m/s"
                size="sm"
                hint="Every leg, propulsive"
              />
              <Readout
                label="Mission total"
                value={feasibility.requiredDeltaV_ms.toFixed(0)}
                unit="m/s"
                size="sm"
              />
              <Readout
                label="Your vehicle"
                value={feasibility.availableDeltaV_ms.toFixed(0)}
                unit="m/s"
                size="sm"
                tone={feasibility.reachable ? 'nominal' : 'caution'}
              />
            </dl>

            <p
              className={cn(
                'text-xs leading-relaxed',
                feasibility.reachable
                  ? 'text-signal-nominal-bright'
                  : feasibility.reachableWithAerobraking
                    ? 'text-signal-caution-bright'
                    : 'text-signal-caution',
              )}
            >
              {feasibility.reachable ? (
                <>
                  The budget closes with {feasibility.marginDeltaV_ms.toFixed(0)} m/s to spare,
                  entirely on the engines.
                </>
              ) : feasibility.reachableWithAerobraking ? (
                <>
                  Short by {Math.abs(feasibility.marginDeltaV_ms).toFixed(0)} m/s propulsively, but
                  it closes with {feasibility.marginAerobraked_ms.toFixed(0)} m/s to spare if the
                  arrival is flown on a heat shield instead. That trade — propellant for thermal
                  protection — is the single largest lever in interplanetary design.
                </>
              ) : (
                <>
                  Short by {Math.abs(feasibility.marginAerobraked_ms).toFixed(0)} m/s even with
                  aerobraking. The ascent will still fly, and watching where it falls short is
                  usually more instructive than guessing at a fix.
                </>
              )}
            </p>
            <p className="text-[0.65rem] leading-relaxed text-ink-600">
              Budget figures are for a reference two-impulse transfer. Real missions beat them with
              gravity assists; they are a target to clear, not a prediction of a specific flight.
            </p>
          </div>
        )}
      </section>

      {/* ── Arrival conditions ─────────────────────────────── */}
      {!isPointDestination && (
        <section>
          <h3 className="t-label mb-2">On arrival</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Readout
              label="Surface gravity"
              value={gravity.toFixed(2)}
              unit="m/s²"
              size="sm"
              hint={`${earthGravityRatio(destination).toFixed(2)}× Earth`}
            />
            <Readout
              label="Escape velocity"
              value={(escapeVelocity(destination) / 1000).toFixed(2)}
              unit="km/s"
              size="sm"
            />
            <Readout
              label="Mean temperature"
              value={kelvin(destination.meanTemperature_K)}
              size="sm"
              hint={`${destination.minTemperature_K.toFixed(0)}–${destination.maxTemperature_K.toLocaleString(undefined, { maximumFractionDigits: 0 })} K`}
            />
            <Readout
              label="Rotation"
              value={formatDuration(Math.abs(destination.rotationPeriod_s))}
              size="sm"
              hint={destination.rotationPeriod_s < 0 ? 'Retrograde' : `Tilt ${destination.axialTilt_deg.toFixed(1)}°`}
            />
            <Readout
              label="Sunlight"
              value={solarConstant(destination).toFixed(0)}
              unit="W/m²"
              size="sm"
              hint={`${((solarConstant(destination) / 1361) * 100).toFixed(1)}% of Earth's`}
            />
            <Readout
              label="Mean density"
              value={meanDensity(destination).toFixed(0)}
              unit="kg/m³"
              size="sm"
              hint={meanDensity(destination) > 3000 ? 'Rock and metal' : 'Ice or gas'}
            />
          </dl>

          <div className="mt-3 hairline-t pt-3">
            {atmosphere ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Readout
                  label="Surface pressure"
                  value={
                    atmosphere.surfacePressure_Pa >= 1000
                      ? `${(atmosphere.surfacePressure_Pa / 101_325).toFixed(2)}`
                      : `${(atmosphere.surfacePressure_Pa / 101_325).toExponential(1)}`
                  }
                  unit="atm"
                  size="sm"
                  hint={`${atmosphere.surfacePressure_Pa.toLocaleString()} Pa`}
                />
                <Readout
                  label="Wind"
                  value={atmosphere.windSpeed_ms.toFixed(1)}
                  unit="m/s"
                  size="sm"
                  hint={`up to ${atmosphere.maxWindSpeed_ms} m/s`}
                />
                <Readout
                  label="Under a parachute"
                  value={Number.isFinite(terminal) ? terminal.toFixed(1) : '—'}
                  unit="m/s"
                  size="sm"
                  tone={terminal <= 10 ? 'nominal' : 'caution'}
                  hint={terminal <= 10 ? 'Survivable' : 'Too fast — engines needed'}
                />
                <div className="col-span-2 sm:col-span-3">
                  <p className="t-label">Composition</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-300">
                    {atmosphere.composition}
                  </p>
                  <p className="mt-1 text-[0.65rem] leading-relaxed text-ink-500">
                    {atmosphere.windNote}
                  </p>
                </div>
              </dl>
            ) : (
              <p className="text-xs leading-relaxed text-ink-400">
                No atmosphere worth the name. Nothing to brake against, nothing for a parachute to
                bite, and no protection from radiation or micrometeorites at the surface.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Getting there ──────────────────────────────────── */}
      <section>
        <h3 className="t-label mb-2">Getting there</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Readout
            label="Distance"
            value={distance(destination.meanDistanceFromEarth_m)}
            size="sm"
            hint={
              destination.minDistanceFromEarth_m === destination.maxDistanceFromEarth_m
                ? undefined
                : `${distance(destination.minDistanceFromEarth_m)} at closest`
            }
          />
          <Readout label="Cruise" value={formatDuration(destination.transferTime_s)} size="sm" />
          <Readout
            label="Launch window"
            value={
              destination.launchWindowInterval_s > 0
                ? `every ${formatDuration(destination.launchWindowInterval_s)}`
                : 'any time'
            }
            size="sm"
            hint={destination.launchWindowInterval_s > 0 ? 'Synodic period with Earth' : 'No alignment needed'}
          />
          <Readout
            label="Signal delay"
            value={formatDuration(lightTime_s(destination))}
            size="sm"
            hint="One way, at mean distance"
          />
        </dl>

        {feasibility?.transfer && (
          <p className="mt-3 text-[0.65rem] leading-relaxed text-ink-500 hairline-t pt-3">
            <span className="t-label mr-2">Departure geometry</span>
            {destination.name} must lead Earth by{' '}
            <span className="font-mono text-ink-200">
              {feasibility.transfer.departurePhaseAngle_deg.toFixed(1)}°
            </span>{' '}
            at ignition — it only sweeps part of its own orbit while the vehicle covers the
            transfer's 180°, and the shortfall is where it has to start from. Miss the window and
            the next one is {formatDuration(destination.launchWindowInterval_s)} away.
          </p>
        )}
      </section>

      {/* ── What it forces you to build ────────────────────── */}
      {feasibility && feasibility.requirements.length > 0 && (
        <section>
          <h3 className="t-label mb-2">What this destination obliges you to carry</h3>
          <ul className="divide-y divide-[color:var(--rule-faint)]">
            {feasibility.requirements.map((requirement) => (
              <li key={requirement.id} className="flex items-start gap-3 py-2">
                <StatusDot
                  tone={requirement.mandatory ? 'caution' : 'quiet'}
                  className="mt-1.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-ink-200">
                    {requirement.label}
                    {!requirement.mandatory && (
                      <span className="ml-2 font-mono text-[0.6rem] text-ink-600">advisory</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] leading-relaxed text-ink-500">
                    {requirement.reason}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Who has actually been ──────────────────────────── */}
      {destination.precedents.length > 0 && (
        <section className="hairline-t pt-3">
          <h3 className="t-label mb-1.5">Flown by</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {destination.precedents.map((precedent) => (
              <li key={precedent} className="font-mono text-[0.65rem] text-ink-400">
                {precedent}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
