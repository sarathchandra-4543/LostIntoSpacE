import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Expandable,
  Panel,
  SectionRule,
  Spinner,
} from '@/components/ui';
import {
  PLAYBACK_SPEEDS,
  useTelemetryPlayback,
} from '@/components/features/simulation/useTelemetryPlayback';
import { FailureAnalysisPanel } from '@/components/features/simulation/FailureAnalysisPanel';
import { useMissionStore } from '@/stores/missionStore';
import { cn, formatMass, formatVelocity } from '@/lib/utils';
import type { SimEvent, SimResult } from '@/types/simulation';

/**
 * Mission Control.
 *
 * The 3D viewport is loaded lazily and separately from the rest of the page:
 * Three.js is the single heaviest dependency in the bundle, and the telemetry,
 * events and mission summary are all useful before it arrives.
 */
const FlightViewport = lazy(() =>
  import('@/components/features/simulation/FlightViewport').then((m) => ({
    default: m.FlightViewport,
  })),
);

export default function MissionControl() {
  const result = useMissionStore((s) => s.result);
  const mission = useMissionStore((s) => s.mission);
  const design = useMissionStore((s) => s.design);
  const meta = useMissionStore((s) => s.resultMeta);
  const lastConfig = useMissionStore((s) => s.lastConfig);

  const telemetry = result?.telemetry ?? [];
  const playback = useTelemetryPlayback(telemetry, { autoPlay: true });

  // Events that have already happened at the current mission time.
  const elapsedEvents = useMemo(
    () => (result?.events ?? []).filter((e) => e.t <= playback.missionTime),
    [result, playback.missionTime],
  );

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <EmptyState
          title="No flight to monitor"
          description="Configure a launch and run it, and the telemetry will appear here."
          action={
            <Link to="/launch">
              <Button>Go to Launch</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const frame = playback.frame;
  const failed = result.outcome === 'failure' || result.failures.length > 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-xl font-semibold text-space-100">
              {mission.name}
            </h1>
            <Badge
              variant={
                result.outcome === 'success'
                  ? 'nominal'
                  : result.outcome === 'partial'
                    ? 'warning'
                    : 'fatal'
              }
            >
              {result.outcome.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-space-500">
            {design?.name} · {mission.launchSite.name} · target{' '}
            {mission.targetAltitudeKm} km · {result.termination_reason}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* A failed flight has one obvious next question, and the answer is
              at the bottom of the page. This is the shortcut to it. */}
          {failed && (
            <a href="#debrief">
              <Button size="sm" variant="danger">
                {result.failures.length} failure
                {result.failures.length === 1 ? '' : 's'} — read the debrief ↓
              </Button>
            </a>
          )}
          <Link to="/launch">
            <Button size="sm" variant="ghost">
              Reconfigure
            </Button>
          </Link>
          <Link to="/builder">
            <Button size="sm" variant="secondary">
              Edit rocket
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Viewport + controls */}
        <div className="space-y-4">
          {/*
            The flight, expandable.

            A 3D view in a 480-pixel band is a postcard of a launch. Expanding
            it is the difference between watching a stage separation and
            noticing one. The panel keeps the same React subtree in both states
            deliberately: moving the node would destroy the WebGL context and
            the scene would reload with its camera reset, mid-flight.
          */}
          <Expandable
            title="Flight"
            aside={`T+${(telemetry[playback.index]?.t ?? 0).toFixed(0)}s`}
            bodyClassName="flex flex-col"
            className="overflow-hidden"
          >
            <Suspense
              fallback={
                <div className="h-[420px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Spinner />
                    <span className="text-2xs text-space-500">Loading 3D view…</span>
                  </div>
                </div>
              }
            >
              <FlightViewport
                telemetry={telemetry}
                index={playback.index}
                // The vehicle from the config that produced this flight, so the
                // model on screen has the dimensions that were actually flown.
                vehicle={lastConfig?.vehicle ?? null}
                // Where the flight was going, so the view can actually show it.
                destinationId={mission.destinationId}
                // The orbit the ascent aimed at, so the view can draw the
                // reference trajectory the flight is measured against.
                targetAltitude_m={mission.targetAltitudeKm * 1000}
                className="h-[320px] w-full min-h-0 flex-1 sm:h-[420px] lg:h-[480px]"
              />
            </Suspense>

            {/* Transport */}
            <div className="shrink-0 border-t border-space-800 p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={playback.toggle}>
                  {playback.isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button size="sm" variant="ghost" onClick={playback.reset}>
                  Reset
                </Button>

                <span className="font-mono text-xs text-accent-cyan tabular-nums w-20">
                  T+{playback.missionTime.toFixed(1)}s
                </span>

                <input
                  type="range"
                  min={0}
                  max={playback.duration || 1}
                  step={0.1}
                  value={playback.missionTime}
                  onChange={(e) => playback.seek(Number(e.target.value))}
                  className="flex-1 accent-accent-cyan"
                  aria-label="Mission time"
                />

                <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => playback.setSpeed(speed)}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-2xs font-mono border transition-colors focus-ring',
                        playback.speed === speed
                          ? 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30'
                          : 'text-space-500 border-space-700 hover:text-space-300',
                      )}
                      aria-pressed={playback.speed === speed}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-2xs text-space-600">
                Playback speed is independent of the render frame rate — the flight was computed
                once, on the server, and is being replayed here.
              </p>
            </div>
          </Expandable>

          {/* Telemetry */}
          <Card>
            <h2 className="font-display text-sm font-semibold text-space-200 mb-3">Telemetry</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <Gauge label="Altitude" value={`${((frame?.altitude_m ?? 0) / 1000).toFixed(1)}`} unit="km" primary />
              <Gauge label="Speed" value={formatVelocity(frame?.speed_ms ?? 0)} />
              <Gauge label="Vertical" value={formatVelocity(frame?.vertical_speed_ms ?? 0)} />
              <Gauge label="Downrange" value={`${((frame?.downrange_m ?? 0) / 1000).toFixed(1)}`} unit="km" />
              <Gauge label="Mass" value={formatMass(frame?.mass_kg ?? 0)} />
              <Gauge label="Propellant" value={`${((frame?.fuel_fraction ?? 0) * 100).toFixed(0)}`} unit="%" />
              <Gauge label="Thrust" value={`${((frame?.thrust_N ?? 0) / 1000).toFixed(0)}`} unit="kN" />
              <Gauge label="Drag" value={`${((frame?.drag_N ?? 0) / 1000).toFixed(1)}`} unit="kN" />
              <Gauge label="g-load" value={(frame?.g_load_g ?? 0).toFixed(2)} unit="g" />
              <Gauge label="Dyn. pressure" value={`${((frame?.dynamic_pressure_Pa ?? 0) / 1000).toFixed(1)}`} unit="kPa" />
              <Gauge label="Mach" value={(frame?.mach ?? 0).toFixed(2)} />
              <Gauge label="TWR" value={(frame?.twr ?? 0).toFixed(2)} />
            </dl>

            <div className="mt-3 pt-3 border-t border-space-800 flex flex-wrap items-center gap-4">
              <StatusChip label="Stage" value={`${(frame?.stage ?? 0) + 1}`} />
              <StatusChip label="Engine" value={frame?.engine_on ? 'BURNING' : 'OFF'} tone={frame?.engine_on ? 'good' : 'idle'} />
              <StatusChip label="Stage status" value={(frame?.stage_status ?? 'stowed').toUpperCase()} />
              <StatusChip
                label="Mission state"
                value={frame?.mission_state ?? 'PREPARATION'}
                tone={frame?.mission_state === 'FAILURE' ? 'bad' : 'good'}
              />
              {frame?.in_orbit && <StatusChip label="Orbit" value="ACHIEVED" tone="good" />}
            </div>

            {frame?.in_orbit && (
              <p className="mt-2 text-2xs text-space-500 font-mono">
                periapsis {(frame.periapsis_altitude_m / 1000).toFixed(0)} km · apoapsis{' '}
                {(frame.apoapsis_altitude_m / 1000).toFixed(0)} km · e ={' '}
                {frame.eccentricity.toFixed(4)}
              </p>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          {/* Events */}
          <Card>
            <h2 className="font-display text-sm font-semibold text-space-200 mb-3">
              Mission events
            </h2>
            <ol className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {result.events.map((event, i) => (
                <EventRow
                  key={`${event.t}-${event.type}-${i}`}
                  event={event}
                  reached={elapsedEvents.includes(event)}
                  onSeek={() => playback.seek(event.t)}
                />
              ))}
            </ol>
          </Card>

          {/* Summary */}
          <Card>
            <h2 className="font-display text-sm font-semibold text-space-200 mb-3">
              Flight summary
            </h2>
            <dl className="space-y-1.5 text-2xs">
              <SummaryRow label="Max altitude" value={`${(result.summary.max_altitude_m / 1000).toFixed(1)} km`} />
              <SummaryRow label="Max speed" value={formatVelocity(result.summary.max_speed_ms)} />
              <SummaryRow label="Max g-load" value={`${result.summary.max_acceleration_g.toFixed(2)} g`} />
              <SummaryRow label="Max-Q" value={`${(result.summary.max_dynamic_pressure_Pa / 1000).toFixed(1)} kPa at ${(result.summary.max_q_altitude_m / 1000).toFixed(1)} km`} />
              <SummaryRow label="Max Mach" value={result.summary.max_mach.toFixed(2)} />
              <SummaryRow label="Downrange" value={`${(result.summary.max_downrange_m / 1000).toFixed(0)} km`} />
              <SummaryRow label="Flight time" value={`${result.summary.flight_time_s.toFixed(1)} s`} />
              <SummaryRow label="Stages separated" value={`${result.summary.stages_separated}`} />
              <SummaryRow label="Propellant used" value={formatMass(result.summary.propellant_used_kg)} />
              <SummaryRow label="Ideal Δv" value={`${result.summary.delta_v_ideal_ms.toFixed(0)} m/s`} />
              <SummaryRow label="Gravity loss" value={`${result.summary.gravity_loss_ms.toFixed(0)} m/s`} />
              <SummaryRow label="Drag loss" value={`${result.summary.drag_loss_ms.toFixed(0)} m/s`} />
            </dl>

            {meta && (
              <p className="mt-3 pt-3 border-t border-space-800 text-2xs text-space-600 leading-relaxed">
                Computed by {String(meta.engine ?? 'the simulation engine')} in{' '}
                {Number(meta.compute_time_s ?? 0).toFixed(2)}s
                {meta.telemetry_decimated ? ', telemetry decimated for transport' : ''}. Educational
                simulation with documented approximations — not flight-certified engineering.
              </p>
            )}
          </Card>

        </aside>
      </div>

      {/*
        ── The debrief ──────────────────────────────────────────

        Full width, below the flight, at the end of the run.

        This used to live in the right-hand rail, three hundred pixels wide,
        below the telemetry — which is to say the single most important thing
        the product does was the narrowest column on the page and the last
        thing you would find. Failure analysis is the whole argument: a rocket
        that cannot lift its own weight is not an error state, it is the
        lesson, and it deserves the main space at the moment it becomes
        relevant.

        It appears where a debrief belongs — after the flight, not beside it.
      */}
      {result && <MissionDebrief result={result} designName={design?.name} />}
    </div>
  );
}

/**
 * What happened, and why.
 *
 * Ordered the way a flight review is: the outcome first, then each failure with
 * the threshold it crossed and the number it crossed it by, then the fix, then
 * — on request — the grounded explanation from the assistant.
 *
 * A successful flight gets a debrief too. "Nothing broke" is a result, and
 * hiding the panel on success would teach that analysis is something you only
 * do when things go wrong.
 */
function MissionDebrief({
  result,
  designName,
}: {
  result: SimResult;
  designName?: string;
}) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const failed = result.failures.length > 0;

  return (
    <section className="mt-8 scroll-mt-6" id="debrief" aria-labelledby="debrief-heading">
      <SectionRule
        label="Debrief"
        aside={
          <span className="font-mono text-micro text-ink-600">
            {failed
              ? `${result.failures.length} failure${result.failures.length === 1 ? '' : 's'}`
              : 'no failures'}
          </span>
        }
      />

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ── What happened ──────────────────────────────── */}
        <Panel className="space-y-4">
          <div>
            <h2 id="debrief-heading" className="font-display text-2xl leading-none text-ink-50">
              {failed ? 'What went wrong' : 'The flight held together'}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
              {failed
                ? 'Each failure below names the threshold that was crossed, the value that crossed it, and the change that would prevent it.'
                : 'No failure threshold was crossed. The summary above has the margins it flew with.'}
            </p>
          </div>

          {failed ? (
            <ul className="space-y-4">
              {result.failures.map((failure) => (
                <li key={failure.id} className="space-y-2 hairline-t pt-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="fatal">{failure.mode_id.replace(/_/g, ' ')}</Badge>
                    <span className="font-mono text-tiny text-ink-500">
                      T+{failure.t.toFixed(1)}s
                    </span>
                    {failure.stage_index !== null && failure.stage_index !== undefined && (
                      <span className="font-mono text-tiny text-ink-600">
                        stage {failure.stage_index + 1}
                      </span>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-ink-200">
                    {failure.educational_explanation}
                  </p>

                  {/* The measurement against the limit. This is the part that
                      makes it a finding rather than an opinion. */}
                  <div className="rounded-instrument p-2.5" style={{ backgroundColor: 'var(--plane-0)' }}>
                    <p className="t-label mb-1">{failure.trigger_condition}</p>
                    <p className="font-mono text-xs tabular-nums text-ink-100">
                      <span className="text-signal-oxide-bright">
                        {failure.measured_value.toFixed(2)}
                      </span>
                      {' against a limit of '}
                      {failure.threshold_value.toFixed(2)} {failure.unit}
                    </p>
                  </div>

                  <p className="text-xs leading-relaxed text-ink-300">
                    <span className="t-label mr-1.5">Fix</span>
                    {failure.recommended_fix}
                  </p>

                  {failure.contributing_factors.length > 0 && (
                    <p className="text-[0.65rem] leading-relaxed text-ink-500">
                      <span className="t-label mr-1.5">Contributing</span>
                      {failure.contributing_factors.join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-ink-500">
              Every automatic check the engine runs — structural load, dynamic pressure, thermal,
              guidance and propulsion — stayed inside its threshold for the whole flight.
            </p>
          )}

          <div className="flex flex-wrap gap-3 hairline-t pt-3">
            <Link to="/builder">
              <Button size="sm" variant="secondary">
                Change the design
              </Button>
            </Link>
            <Link to="/launch">
              <Button size="sm" variant="ghost">
                Fly it again
              </Button>
            </Link>
            <Link to="/evaluation">
              <Button size="sm" variant="ghost">
                Full mission report
              </Button>
            </Link>
          </div>
        </Panel>

        {/* ── Ask why ────────────────────────────────────── */}
        <div>
          {showAnalysis ? (
            <FailureAnalysisPanel result={result} designName={designName} />
          ) : (
            <Panel className="space-y-3">
              <h3 className="font-display text-lg leading-tight text-ink-100">
                Ask the assistant
              </h3>
              <p className="text-xs leading-relaxed text-ink-400">
                It reads this flight's telemetry and events, and answers from retrieved sources
                with the citations attached. If it has no evidence for something, it says so
                rather than filling the gap.
              </p>
              <Button size="sm" onClick={() => setShowAnalysis(true)}>
                {failed ? 'Explain these failures' : 'Review this flight'}
              </Button>
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}

function Gauge({
  label,
  value,
  unit,
  primary,
}: {
  label: string;
  value: string;
  unit?: string;
  primary?: boolean;
}) {
  return (
    <div>
      <dt className="text-2xs text-space-500 mb-0.5">{label}</dt>
      <dd
        className={cn(
          'font-mono tabular-nums',
          primary ? 'text-lg text-accent-cyan' : 'text-sm text-space-100',
        )}
      >
        {value}
        {unit && <span className="text-2xs text-space-500 ml-1">{unit}</span>}
      </dd>
    </div>
  );
}

function StatusChip({
  label,
  value,
  tone = 'idle',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'idle';
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-space-600">{label}</span>
      <span
        className={cn(
          'font-mono text-2xs px-1.5 py-0.5 rounded border',
          tone === 'good' && 'text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10',
          tone === 'bad' && 'text-severity-fatal border-severity-fatal/30 bg-severity-fatal/10',
          tone === 'idle' && 'text-space-300 border-space-700 bg-space-800/50',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-space-500">{label}</dt>
      <dd className="font-mono text-space-200">{value}</dd>
    </div>
  );
}

function EventRow({
  event,
  reached,
  onSeek,
}: {
  event: SimEvent;
  reached: boolean;
  onSeek: () => void;
}) {
  const severityTone =
    event.severity === 'fatal' || event.severity === 'critical'
      ? 'text-severity-fatal'
      : event.severity === 'warning'
        ? 'text-severity-warning'
        : 'text-space-300';

  return (
    <li>
      <button
        onClick={onSeek}
        className={cn(
          'w-full text-left flex items-baseline gap-2 px-2 py-1 rounded transition-colors focus-ring hover:bg-space-800/60',
          !reached && 'opacity-40',
        )}
      >
        <span className="font-mono text-2xs text-space-500 shrink-0 w-14 tabular-nums">
          T+{event.t.toFixed(1)}
        </span>
        <span className={cn('text-2xs leading-snug', severityTone)}>{event.description}</span>
      </button>
    </li>
  );
}
