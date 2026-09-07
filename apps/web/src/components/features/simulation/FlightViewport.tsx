import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { Body3D } from '@/components/features/space/Body3D';
import { SolarSystemScene } from '@/components/features/space/SolarSystem';
import { BODIES_BY_ID, bodyForDestination } from '@/components/features/space/systemBodies';
import type { SimVehicle, TelemetryPoint } from '@/types/simulation';
import { cn } from '@/lib/utils';

import { RocketModel, stageBands } from './RocketModel';
import { buildReferenceAscent, deviationAt } from './trajectoryPlan';

/**
 * The flight view.
 *
 * ## The division of labour
 *
 * This file renders. It computes no physics. Every position it draws comes from
 * a telemetry sample the Python engine produced — the renderer's only job is to
 * map metres onto a scene a camera can frame, and it must never be the thing
 * that decides where the rocket is.
 *
 * ## Four cameras, because a launch is four different events
 *
 * - **Pad.** At the launch site, framing the vehicle on the ground. Ignition
 *   and the first hundred metres are invisible from anywhere else.
 * - **Chase.** Alongside the vehicle as it climbs, which is where the pitch
 *   program becomes legible — you watch the rocket lie over onto its side.
 * - **Orbital.** Far back, planet in frame, the whole trajectory drawn.
 * - **Destination.** Where the mission is actually going, drawn from its
 *   measured radius, surface and tilt. Choosing Mars used to change a Δv figure
 *   and nothing on screen; the place itself is now in the view.
 *
 * ## The camera is the viewer's
 *
 * Every mode is a *starting position*, not a cage. Orbit controls are live in
 * all four: drag to turn, scroll to zoom, right-drag to pan, with a zoom range
 * that runs from a metre off the hull out to the whole trajectory. The camera
 * follows the vehicle until you touch it, and then it stops fighting you and
 * hands over — which is the only arrangement that lets someone actually look at
 * a stage separation instead of watching it slide out of frame.
 */

/** Scene units per metre of altitude, in the orbital view. */
const ALTITUDE_SCALE = 1 / 20_000;
/** Scene units per metre downrange, in the orbital view. */
const DOWNRANGE_SCALE = 1 / 60_000;
/** Earth's drawn radius in the orbital view. Not to scale with the above. */
const PLANET_RADIUS = 12;

/** Sea-level pressure, for working out how far the plume has expanded. */
const P0 = 101_325;

export type CameraMode = 'pad' | 'chase' | 'orbital' | 'destination' | 'system';

const CAMERA_LABELS: Record<CameraMode, { label: string; hint: string }> = {
  pad: { label: 'Pad', hint: 'At the launch site' },
  chase: { label: 'Chase', hint: 'Alongside the vehicle' },
  orbital: { label: 'Orbital', hint: 'The whole trajectory' },
  destination: { label: 'Destination', hint: 'Where the mission is going' },
  system: { label: 'System', hint: 'The whole solar system, and where this sits in it' },
};

interface FlightViewportProps {
  telemetry: readonly TelemetryPoint[];
  /** Index of the sample currently being shown. */
  index: number;
  /** The vehicle that was flown. Gives the model its real dimensions. */
  vehicle?: SimVehicle | null;
  /** Destination catalogue id, so the view can show where this is going. */
  destinationId?: string | null;
  /** The orbit the ascent was aiming at, for the reference trajectory. Unit: m */
  targetAltitude_m?: number;
  className?: string;
}

/** Map one telemetry sample into orbital-view coordinates. */
function toOrbitalScene(point: TelemetryPoint): THREE.Vector3 {
  return new THREE.Vector3(
    point.downrange_m * DOWNRANGE_SCALE,
    PLANET_RADIUS + point.altitude_m * ALTITUDE_SCALE,
    0,
  );
}

export function FlightViewport({
  telemetry,
  index,
  vehicle,
  destinationId,
  targetAltitude_m = 200_000,
  className,
}: FlightViewportProps) {
  const [mode, setMode] = useState<CameraMode>('pad');
  const [autoCamera, setAutoCamera] = useState(true);

  const current = telemetry[index] ?? null;
  const destination = destinationId ? bodyForDestination(destinationId) : null;

  /**
   * Which camera the moment calls for.
   *
   * The pad view stops being useful the instant the vehicle is a speck, and the
   * orbital view is meaningless while the rocket is still on the ground.
   * Handing over at 2 km and again at 80 km follows the flight rather than
   * making the user chase it — and any manual choice switches this off, because
   * a camera that overrides you is worse than one that never moves.
   */
  useEffect(() => {
    if (!autoCamera || !current) return;
    const altitude = current.altitude_m;
    setMode(altitude < 2_000 ? 'pad' : altitude < 80_000 ? 'chase' : 'orbital');
  }, [autoCamera, current]);

  const chooseMode = (next: CameraMode) => {
    setAutoCamera(false);
    setMode(next);
  };

  const isGround = mode === 'pad' || mode === 'chase';

  return (
    <div className={cn('relative', className)}>
      <Canvas
        // Ground, orbital and destination are three different unit regimes, and
        // a single camera cannot hold near and far planes for all of them. The
        // key remounts the canvas at each boundary so depth precision stays
        // correct instead of z-fighting at one end of the range.
        key={mode === 'system' ? 'system' : mode === 'destination' ? 'body' : isGround ? 'near' : 'far'}
        dpr={[1, 2]}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        shadows={isGround}
        camera={
          mode === 'system'
            ? { position: [0, 90_000, 200_000], fov: 45, near: 0.05, far: 20_000_000 }
            : mode === 'destination'
            ? { position: [0, 900, 2600], fov: 45, near: 1, far: 5_000_000 }
            : isGround
              ? { position: [40, 22, 55], fov: 38, near: 0.1, far: 400_000 }
              : { position: [26, 22, 26], fov: 45, near: 0.05, far: 40_000 }
        }
      >
        {mode === 'system' ? (
          <SystemScene destinationId={destinationId ?? null} />
        ) : mode === 'destination' ? (
          <DestinationScene destinationId={destinationId ?? null} />
        ) : mode === 'orbital' ? (
          <OrbitalScene
            telemetry={telemetry}
            index={index}
            destinationId={destinationId ?? null}
            targetAltitude_m={targetAltitude_m}
          />
        ) : (
          <GroundScene point={current} vehicle={vehicle ?? null} mode={mode} />
        )}
      </Canvas>

      {/* ── Camera selection ───────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
        <div
          className="over-canvas pointer-events-auto flex overflow-hidden"
          role="group"
          aria-label="Camera angle"
          
        >
          {(Object.keys(CAMERA_LABELS) as CameraMode[]).map((key) => {
            // There is nothing to show for a destination the catalogue has no
            // body for — an Earth orbit is not a place you can look at.
            if (key === 'destination' && !destination) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => chooseMode(key)}
                aria-pressed={mode === key}
                title={
                  key === 'destination' && destination
                    ? `${destination.name} — ${CAMERA_LABELS[key].hint}`
                    : CAMERA_LABELS[key].hint
                }
                className={cn(
                  'px-3 py-1.5 font-condensed text-micro uppercase tracking-instrument transition-colors duration-quick focus-ring',
                  mode === key
                    ? 'oc-active'
                    : 'oc-quiet hover:text-ink-50',
                )}
              >
                {key === 'destination' && destination
                  ? destination.name
                  : CAMERA_LABELS[key].label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setAutoCamera((on) => !on)}
            aria-pressed={autoCamera}
            title="Follow the flight automatically"
            className={cn(
              'px-3 py-1.5 font-condensed text-micro uppercase tracking-instrument transition-colors duration-quick focus-ring',
              autoCamera ? 'text-signal-nominal-bright' : 'oc-quiet hover:text-ink-50',
            )}
          >
            Auto
          </button>
        </div>

        {current && (
          <p
            className="over-canvas pointer-events-none px-2 py-1 font-mono text-[0.6rem] tabular-nums"
            
          >
            T+{current.t.toFixed(0)}s · {(current.altitude_m / 1000).toFixed(1)} km ·{' '}
            {current.speed_ms.toFixed(0)} m/s · stage {current.stage + 1}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <p
          className="over-canvas px-2 py-1 font-mono text-[0.55rem] oc-quiet"
          
        >
          drag · scroll to zoom · right-drag to pan
        </p>
        {mode === 'orbital' && (
          <div
            className="over-canvas-strong px-2 py-1.5 font-mono text-[0.55rem] leading-relaxed"
            
          >
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-px w-4" style={{ backgroundColor: '#F4F0E8' }} />
              flown
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-px w-4" style={{ backgroundColor: '#7FA8B8' }} />
              reference ascent
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-px w-4" style={{ backgroundColor: '#D9A441' }} />
              deflection
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Ground scene — pad and chase
// ──────────────────────────────────────────────────────────────

/**
 * The near field, in metres, with the vehicle at true size.
 *
 * The rocket stays near the origin and the *world* moves down past it. Flying
 * the model up a 100 km Y axis instead would put it far enough from the origin
 * that single-precision float error becomes visible as jitter, which is exactly
 * the sort of thing that makes a simulation look fake.
 */
function GroundScene({
  point,
  vehicle,
  mode,
}: {
  point: TelemetryPoint | null;
  vehicle: SimVehicle | null;
  mode: CameraMode;
}) {
  const altitude = point?.altitude_m ?? 0;
  const bands = useMemo(() => stageBands(vehicle), [vehicle]);
  const vehicleLength = vehicle?.length_m ?? 30;

  // Sky darkens with altitude. Half the atmosphere is below 5.5 km and it is
  // effectively black by 60, so the fade is exponential rather than linear.
  const skyFade = Math.min(1, Math.max(0, 1 - Math.exp(-altitude / 22_000)));
  const sky = useMemo(() => {
    const ground = new THREE.Color('#7FA8C8');
    const space = new THREE.Color('#04060B');
    return ground.lerp(space, skyFade);
  }, [skyFade]);

  const burning = !!point?.engine_on && (point?.thrust_N ?? 0) > 0;
  const pressureRatio = point ? Math.min(1, (point.ambient_pressure_Pa || 0) / P0) : 1;
  const throttle = point && point.thrust_N > 0 ? 1 : 0;

  return (
    <>
      <color attach="background" args={[sky.getHex()]} />
      <fog attach="fog" args={[sky.getHex(), vehicleLength * 10, vehicleLength * 140]} />

      <ambientLight intensity={0.45 - skyFade * 0.2} />
      <hemisphereLight args={[sky.getHex(), '#3B342B', 0.6]} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={2.2}
        color="#FFF4E2"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {skyFade > 0.5 && (
        <Stars radius={4000} depth={800} count={2500} factor={30} fade speed={0} />
      )}

      <LaunchSite altitude={altitude} vehicleLength={vehicleLength} />

      <FlyingVehicle
        point={point}
        vehicle={vehicle}
        burning={burning}
        throttle={throttle}
        pressureRatio={pressureRatio}
        bandCount={bands.length}
      />

      <FollowCamera mode={mode} vehicleLength={vehicleLength} altitude={altitude} />
    </>
  );
}

/**
 * The launch site.
 *
 * A real pad complex, at the scale of the vehicle on it: a concrete apron over
 * a flame trench, four hold-down arms, a service tower taller than the rocket
 * with its crew and umbilical arms, lightning masts at the corners of the site,
 * and the flat coastal ground these places are always built on.
 *
 * The distance is deliberately hazed rather than modelled. A launch site sits
 * in a real landscape and drawing a fake one in detail would be inventing
 * scenery; a graded haze gives the sense of somewhere without asserting
 * anything about where. Above twelve kilometres it is dropped entirely — by
 * then it is below the fog and costing frames for nothing.
 */
function LaunchSite({ altitude, vehicleLength }: { altitude: number; vehicleLength: number }) {
  const scale = vehicleLength;
  if (altitude > 12_000) return null;

  return (
    <group position={[0, -altitude, 0]}>
      {/* Terrain. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[scale * 90, 64]} />
        <meshStandardMaterial color="#3A342B" roughness={0.96} metalness={0} />
      </mesh>

      {/* The pad: a raised apron with the flame trench beneath it. */}
      <mesh position={[0, scale * 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[scale * 0.55, scale * 0.6, scale * 0.04, 32]} />
        <meshStandardMaterial color="#6B665C" roughness={0.9} />
      </mesh>
      <mesh position={[0, -scale * 0.05, 0]}>
        <cylinderGeometry args={[scale * 0.16, scale * 0.16, scale * 0.14, 24, 1, true]} />
        <meshStandardMaterial color="#17150F" roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {/* Hold-down arms. */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * scale * 0.2, scale * 0.06, Math.sin(angle) * scale * 0.2]}
            castShadow
          >
            <boxGeometry args={[scale * 0.05, scale * 0.09, scale * 0.05]} />
            <meshStandardMaterial color="#55504A" roughness={0.7} metalness={0.4} />
          </mesh>
        );
      })}

      {/* Service tower, taller than the vehicle, with its arms. */}
      <group position={[scale * 0.5, 0, 0]}>
        <mesh position={[0, scale * 0.62, 0]} castShadow>
          <boxGeometry args={[scale * 0.11, scale * 1.24, scale * 0.11]} />
          <meshStandardMaterial color="#6E6A63" roughness={0.75} metalness={0.35} />
        </mesh>
        {[0.25, 0.42, 0.6, 0.78, 0.92].map((h) => (
          <mesh key={h} position={[-scale * 0.17, scale * 1.24 * h, 0]} castShadow>
            <boxGeometry args={[scale * 0.23, scale * 0.022, scale * 0.055]} />
            <meshStandardMaterial color="#5C5852" roughness={0.8} metalness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, scale * 1.36, 0]}>
          <cylinderGeometry args={[scale * 0.006, scale * 0.012, scale * 0.24, 8]} />
          <meshStandardMaterial color="#8A857C" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* Lightning masts, at the corners of the site. */}
      {[
        [-1.7, -1.2],
        [1.7, -1.2],
        [-1.7, 1.4],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x! * scale, scale * 0.78, z! * scale]} castShadow>
          <cylinderGeometry args={[scale * 0.012, scale * 0.03, scale * 1.56, 8]} />
          <meshStandardMaterial color="#4C4841" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}

      {/*
        The horizon, and the ground haze in front of it.

        A launch site sits in a real landscape, and the pad alone against a flat
        sky reads as a model on a table. Rather than invent scenery — which
        would be asserting something about a place this simulation does not
        model — the distance is a graded plate: a low ridge line at the horizon
        and a band of atmospheric haze in front of it, both soft enough that
        they read as depth rather than as detail.

        It is the same trick a matte painting uses, and it is honest here
        because it depicts *distance* rather than depicting a location.
      */}
      <group>
        {/* A low, blurred ridge all the way round the horizon. */}
        <mesh position={[0, scale * 0.55, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[scale * 78, scale * 78, scale * 1.6, 96, 1, true]} />
          <meshBasicMaterial
            color="#2B2A24"
            transparent
            opacity={0.55}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
        {/* Haze in front of it, thicker at the bottom, as real air is. */}
        <mesh position={[0, scale * 2.2, 0]}>
          <cylinderGeometry args={[scale * 70, scale * 70, scale * 5.5, 96, 1, true]} />
          <meshBasicMaterial
            color="#8FA8BE"
            transparent
            opacity={0.2}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Range markers, so descent and downrange drift have a reference. */}
      {[10, 20, 35, 55].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[scale * r, scale * r + scale * 0.07, 96]} />
          <meshBasicMaterial color="#5A5348" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The vehicle, eased toward each telemetry sample.
 *
 * Telemetry arrives about once a second and the display runs at sixty, so
 * interpolating is what makes the motion continuous. The *position* still comes
 * only from the engine's samples — this smooths between them and invents
 * nothing.
 */
function FlyingVehicle({
  point,
  vehicle,
  burning,
  throttle,
  pressureRatio,
  bandCount,
}: {
  point: TelemetryPoint | null;
  vehicle: SimVehicle | null;
  burning: boolean;
  throttle: number;
  pressureRatio: number;
  bandCount: number;
}) {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const vehicleLength = vehicle?.length_m ?? 30;
  const currentStage = Math.min(point?.stage ?? 0, Math.max(0, bandCount - 1));

  useFrame((_, delta) => {
    if (!group.current || !point) return;
    const targetRoll = point.pitch_rad - Math.PI / 2;
    group.current.rotation.z += (targetRoll - group.current.rotation.z) * Math.min(1, delta * 4);
    const targetX = point.lateral_deviation_m ?? 0;
    group.current.position.x += (targetX - group.current.position.x) * Math.min(1, delta * 3);
    if (light.current) light.current.intensity = burning ? 6 + throttle * 10 : 0;
  });

  return (
    <group ref={group}>
      <RocketModel
        vehicle={vehicle}
        currentStage={currentStage}
        burning={burning}
        throttle={throttle}
        ambientPressureRatio={pressureRatio}
      />
      <pointLight
        ref={light}
        position={[0, -vehicleLength * 0.08, 0]}
        color="#FFAF62"
        distance={vehicleLength * 14}
        decay={2}
      />
      <SpentStages
        vehicle={vehicle}
        currentStage={currentStage}
        vehicleLength={vehicleLength}
      />
    </group>
  );
}

/**
 * Stages that have already gone.
 *
 * Separation used to be a stage simply ceasing to exist between one frame and
 * the next, which is the least readable way to show the single most dramatic
 * event in an ascent. Each spent stage is now kept and animated: it drops back
 * along the flight axis, tumbles slowly the way an uncontrolled body does, and
 * fades out over a few seconds of real time.
 *
 * It is a *depiction* of the separation the engine reported, not a simulation
 * of one — the physics stopped tracking that mass the moment it was dropped,
 * and nothing here feeds back into the trajectory.
 */
function SpentStages({
  vehicle,
  currentStage,
  vehicleLength,
}: {
  vehicle: SimVehicle | null;
  currentStage: number;
  vehicleLength: number;
}) {
  const bands = useMemo(() => stageBands(vehicle), [vehicle]);
  // Elapsed seconds since each stage was dropped, keyed by stage index.
  const dropped = useRef(new Map<number, number>());
  const [, force] = useState(0);

  // Record the moment a stage leaves. Playback can scrub backwards, so a stage
  // that is attached again has its record cleared rather than lingering.
  useEffect(() => {
    for (let i = 0; i < bands.length; i++) {
      if (i < currentStage && !dropped.current.has(i)) dropped.current.set(i, 0);
      if (i >= currentStage && dropped.current.has(i)) dropped.current.delete(i);
    }
    force((n) => n + 1);
  }, [currentStage, bands.length]);

  useFrame((_, delta) => {
    let changed = false;
    for (const [index, age] of dropped.current) {
      if (age > 6) {
        dropped.current.delete(index);
        changed = true;
      } else {
        dropped.current.set(index, age + delta);
      }
    }
    if (changed) force((n) => n + 1);
  });

  return (
    <>
      {[...dropped.current.entries()].map(([index, age]) => {
        const band = bands[index];
        if (!band) return null;
        return (
          <SpentStage
            key={index}
            band={band}
            age={age}
            vehicleLength={vehicleLength}
          />
        );
      })}
    </>
  );
}

/** One discarded stage, falling behind and tumbling. */
function SpentStage({
  band,
  age,
  vehicleLength,
}: {
  band: ReturnType<typeof stageBands>[number];
  age: number;
  vehicleLength: number;
}) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(age);

  useFrame((_, delta) => {
    if (!group.current) return;
    elapsed.current += delta;
    const t = elapsed.current;
    // Falls back along the vehicle's own axis, accelerating, and tumbles.
    group.current.position.y = -(vehicleLength * 0.5 + t * t * 6);
    group.current.rotation.z = t * 0.55;
    group.current.rotation.x = t * 0.3;
    const material = (group.current.children[0] as THREE.Mesh | undefined)
      ?.material as THREE.MeshStandardMaterial | undefined;
    if (material) {
      material.opacity = Math.max(0, 1 - t / 6);
      material.transparent = true;
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <cylinderGeometry args={[band.radius_m, band.radius_m, band.length_m, 24, 1]} />
        <meshStandardMaterial color="#6B655C" metalness={0.6} roughness={0.5} transparent />
      </mesh>
    </group>
  );
}

/**
 * The ground cameras.
 *
 * Both frame the vehicle, and both hand over the instant the viewer touches the
 * controls. That handover is the point: a camera that keeps snapping back makes
 * it impossible to look closely at anything, and looking closely at a stage
 * separation is exactly what someone wants to do.
 */
function FollowCamera({
  mode,
  vehicleLength,
  altitude,
}: {
  mode: CameraMode;
  vehicleLength: number;
  altitude: number;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const [free, setFree] = useState(false);

  // Switching camera mode is a request to be framed again.
  useEffect(() => setFree(false), [mode]);

  useFrame((_, delta) => {
    if (free || !controls.current) return;
    const ease = Math.min(1, delta * 2.2);

    const target =
      mode === 'pad'
        ? new THREE.Vector3(0, Math.min(altitude, vehicleLength * 1.2), 0)
        : new THREE.Vector3(0, vehicleLength * 0.45, 0);

    const position =
      mode === 'pad'
        ? new THREE.Vector3(
            (vehicleLength * 2.2 + altitude * 0.3) * 0.6,
            vehicleLength * 0.3,
            vehicleLength * 2.2 + altitude * 0.3,
          )
        // Closer, and off to one side, so a slender vehicle fills the frame
        // and its attitude is readable rather than being a line down the middle.
        : new THREE.Vector3(vehicleLength * 0.85, vehicleLength * 0.34, vehicleLength * 1.15);

    camera.position.lerp(position, ease);
    controls.current.target.lerp(target, ease);
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      onStart={() => setFree(true)}
      enablePan
      enableDamping
      dampingFactor={0.1}
      zoomSpeed={1.5}
      // Close enough to read a weld, far enough to see the whole site.
      minDistance={vehicleLength * 0.12}
      maxDistance={vehicleLength * 400}
      makeDefault
    />
  );
}

// ──────────────────────────────────────────────────────────────
// Orbital scene
// ──────────────────────────────────────────────────────────────

/** The whole flight as one shape, against the planet it left. */
function OrbitalScene({
  telemetry,
  index,
  destinationId,
  targetAltitude_m,
}: {
  telemetry: readonly TelemetryPoint[];
  index: number;
  destinationId: string | null;
  targetAltitude_m: number;
}) {
  const stride = Math.max(1, Math.floor(telemetry.length / 400));

  /** Where the vehicle has actually been. */
  const flownPath = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= index; i += stride) {
      const sample = telemetry[i];
      if (sample) points.push(toOrbitalScene(sample));
    }
    const last = telemetry[index];
    if (last) points.push(toOrbitalScene(last));
    return points;
  }, [telemetry, index, stride]);

  /** The rest of the flight, so the shape of the ascent is visible at once. */
  const remainingPath = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = index; i < telemetry.length; i += stride) {
      const sample = telemetry[i];
      if (sample) points.push(toOrbitalScene(sample));
    }
    return points;
  }, [telemetry, index, stride]);

  /**
   * The reference ascent — the shape the flight is measured against.
   *
   * Scaled to the flight's own downrange so the two curves are comparable
   * rather than one being an arbitrary length.
   */
  const plan = useMemo(() => {
    const maxDownrange = telemetry.reduce((m, pt) => Math.max(m, pt.downrange_m), 0);
    return buildReferenceAscent(targetAltitude_m, maxDownrange);
  }, [telemetry, targetAltitude_m]);

  const planPath = useMemo(
    () =>
      plan.map(
        (pt) =>
          new THREE.Vector3(
            pt.downrange_m * DOWNRANGE_SCALE,
            PLANET_RADIUS + pt.altitude_m * ALTITUDE_SCALE,
            0,
          ),
      ),
    [plan],
  );

  const current = telemetry[index] ?? null;
  const deviation = useMemo(
    () => (current ? deviationAt(current, plan, telemetry[Math.max(0, index - 1)]) : null),
    [current, plan, telemetry, index],
  );

  const destination = destinationId ? bodyForDestination(destinationId) : null;
  const showBeacon = destination && destination.id !== 'earth';

  return (
    <>
      <color attach="background" args={['#04060B']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[40, 30, 20]} intensity={1.8} color="#fff6e8" />
      <Stars radius={3000} depth={600} count={4000} factor={12} fade speed={0} />

      <EarthInOrbitalView />

      {/*
        Two trajectories, two colours, both dotted.

        Cool blue is the reference ascent — where the vehicle *should* be. Warm
        white is where it actually went. Dashed rather than solid because
        neither is a continuous measurement: the reference is a constructed
        profile and the flight is a sampled one, and a solid line implies a
        precision that neither has.
      */}
      {planPath.length > 1 && (
        <Line
          points={planPath}
          color="#7FA8B8"
          lineWidth={1.4}
          transparent
          opacity={0.75}
          dashed
          dashSize={0.5}
          gapSize={0.34}
        />
      )}
      {remainingPath.length > 1 && (
        <Line
          points={remainingPath}
          color="#625C51"
          lineWidth={1}
          transparent
          opacity={0.4}
          dashed
          dashSize={0.32}
          gapSize={0.4}
        />
      )}
      {flownPath.length > 1 && (
        <Line
          points={flownPath}
          color="#F4F0E8"
          lineWidth={2}
          transparent
          opacity={0.95}
          dashed
          dashSize={0.62}
          gapSize={0.24}
        />
      )}

      {/* The gap between the two, drawn where it is. */}
      {current && deviation && deviation.deflection_m > 1000 && (
        <DeflectionMarker point={current} plan={planPath} />
      )}

      {current && <OrbitalMarker point={current} />}

      {showBeacon && <DestinationBearing name={destination.name} />}

      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={1.4}
        minDistance={PLANET_RADIUS + 0.4}
        maxDistance={2000}
        target={[0, PLANET_RADIUS + 4, 0]}
        makeDefault
      />
    </>
  );
}

/** The shortest line from the vehicle to the reference, drawn where it is. */
function DeflectionMarker({
  point,
  plan,
}: {
  point: TelemetryPoint;
  plan: readonly THREE.Vector3[];
}) {
  const here = toOrbitalScene(point);
  let nearest = plan[0] ?? here;
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of plan) {
    const d = candidate.distanceToSquared(here);
    if (d < best) {
      best = d;
      nearest = candidate;
    }
  }
  return (
    <Line
      points={[here, nearest]}
      color="#D9A441"
      lineWidth={1.2}
      transparent
      opacity={0.7}
      dashed
      dashSize={0.18}
      gapSize={0.18}
    />
  );
}

/** Earth, drawn from the same measured surface the system view uses. */
function EarthInOrbitalView() {
  const earth = BODIES_BY_ID.get('earth')!;
  return (
    <group>
      <Body3D
        id="earth"
        appearance={earth.appearance}
        radius={PLANET_RADIUS}
        rotationPeriod_h={earth.rotationPeriod_h}
        axialTilt_deg={earth.axialTilt_deg}
        timeScale={400}
      />
      {/* The Kármán line, so "space" has a visible boundary. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[
            PLANET_RADIUS + 100_000 * ALTITUDE_SCALE,
            PLANET_RADIUS + 100_000 * ALTITUDE_SCALE + 0.03,
            128,
          ]}
        />
        <meshBasicMaterial color="#8aa5d6" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Which way the destination lies, and how far. */
function DestinationBearing({ name }: { name: string }) {
  return (
    <group position={[0, PLANET_RADIUS + 26, 0]}>
      <Line
        points={[
          [0, -8, 0],
          [0, 0, 0],
        ]}
        color="#7FA8B8"
        lineWidth={1}
        transparent
        opacity={0.55}
        dashed
      />
      <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span
          className="whitespace-nowrap font-condensed text-[0.6rem] uppercase tracking-instrument text-signal-cryo-bright"
          style={{ textShadow: '0 1px 5px rgba(0,0,0,0.95)' }}
        >
          ↑ {name}
        </span>
      </Html>
    </group>
  );
}

/**
 * Where the vehicle is, in the orbital view.
 *
 * At this scale the rocket is far smaller than one pixel, so drawing the model
 * would be dishonest as well as invisible. A marker that says "the vehicle is
 * here" is the truthful thing to draw, and the ground cameras are where the
 * vehicle itself is seen.
 */
function OrbitalMarker({ point }: { point: TelemetryPoint }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.lerp(toOrbitalScene(point), 0.25);
  });

  const burning = point.engine_on && point.thrust_N > 0;

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color={burning ? '#FA8A4A' : '#F4F0E8'} />
      </mesh>
      {burning && (
        <mesh>
          <sphereGeometry args={[0.34, 16, 16]} />
          <meshBasicMaterial
            color="#E4682E"
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      <pointLight color="#FFAF62" intensity={burning ? 5 : 0} distance={6} />
    </group>
  );
}

/**
 * The whole solar system, with this mission's destination marked.
 *
 * The flight view could show where the rocket *is* and where it is *going*, but
 * never both at once against everything else — so a Mars mission and a lunar
 * one looked identical from the cockpit. This is the wide shot: every planet on
 * its real orbit, at true relative size, with the destination ringed.
 *
 * It reuses the solar-system scene rather than reimplementing it, so the two
 * views cannot drift apart in what they claim about the system.
 */
function SystemScene({ destinationId }: { destinationId: string | null }) {
  const body = destinationId ? bodyForDestination(destinationId) : null;
  return <SolarSystemScene focusId={body?.id ?? 'earth'} />;
}

// ──────────────────────────────────────────────────────────────
// Destination scene
// ──────────────────────────────────────────────────────────────

/**
 * The place the mission is going.
 *
 * Drawn from the same measured radius, surface, tilt and rotation period the
 * solar-system view uses, with its major moons in attendance. This is the
 * answer to the plainest complaint there was about the simulation: you could
 * choose Mars and never see Mars.
 */
function DestinationScene({ destinationId }: { destinationId: string | null }) {
  const body = destinationId ? bodyForDestination(destinationId) : null;
  if (!body) return null;

  // Everything is drawn relative to the destination's own radius, so the same
  // scene composes correctly for Phobos and for Jupiter.
  const radius = 1000;
  const moons = [...BODIES_BY_ID.values()].filter((b) => b.parent === body.id);

  return (
    <>
      <color attach="background" args={['#04060A']} />
      <ambientLight intensity={0.12} />
      {/* Sunlight from one side, so the terminator reads. */}
      <directionalLight position={[6000, 2400, 3600]} intensity={2.6} color="#FFF4E2" />
      <Stars radius={200_000} depth={40_000} count={5000} factor={700} fade speed={0} />

      <Body3D
        id={body.id}
        appearance={body.appearance}
        radius={radius}
        rotationPeriod_h={body.rotationPeriod_h}
        axialTilt_deg={body.axialTilt_deg}
        timeScale={9000}
      />

      {moons.map((moon, i) => {
        const moonRadius = radius * (moon.radius_m / body.radius_m);
        const distance = radius * (2.4 + i * 0.85);
        const angle = i * 1.7;
        return (
          <group
            key={moon.id}
            position={[Math.cos(angle) * distance, Math.sin(angle) * distance * 0.2, Math.sin(angle) * distance]}
          >
            <Body3D
              id={moon.id}
              appearance={moon.appearance}
              radius={Math.max(moonRadius, radius * 0.03)}
              rotationPeriod_h={moon.rotationPeriod_h}
              axialTilt_deg={moon.axialTilt_deg}
              timeScale={9000}
            />
            <Html position={[0, Math.max(moonRadius, radius * 0.03) * 1.6, 0]} center style={{ pointerEvents: 'none' }}>
              <span
                className="whitespace-nowrap font-condensed text-[0.55rem] uppercase tracking-instrument text-ink-400"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
              >
                {moon.name}
              </span>
            </Html>
          </group>
        );
      })}

      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={1.4}
        minDistance={radius * 1.15}
        maxDistance={radius * 60}
        makeDefault
      />
    </>
  );
}
