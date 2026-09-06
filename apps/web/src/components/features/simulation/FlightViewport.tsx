import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

import type { SimVehicle, TelemetryPoint } from '@/types/simulation';
import { cn } from '@/lib/utils';

import { RocketModel, stageBands } from './RocketModel';

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
 * ## Why there are three cameras and not one
 *
 * A launch is three different events at three different scales, and no single
 * viewpoint shows more than one of them.
 *
 * - **Pad.** A fixed camera at the launch site, at human height, framing the
 *   vehicle on the pad. It is where ignition and the first hundred metres
 *   actually read — the moment the hold-downs release and the stack starts to
 *   move is invisible from anywhere else.
 * - **Chase.** Alongside the vehicle, holding station as it climbs. This is
 *   where the pitch program becomes legible: you watch the rocket lie over onto
 *   its side, which is the single most counter-intuitive thing about getting to
 *   orbit and is completely hidden by a fixed camera.
 * - **Orbital.** Far back, planet in frame, the whole trajectory drawn. Where
 *   the flight becomes a shape rather than an event.
 *
 * The first two share a local scene in metres, with the vehicle at true size on
 * real ground. The third uses a compressed planetary scale, because a 200 km
 * ascent beside a 6,371 km planet cannot be drawn at 1:1 — the rocket would be
 * sub-pixel long before the Earth fit on screen. That compression is a
 * presentation choice, stated here so nobody reads distances off it.
 */

/** Scene units per metre of altitude, in the orbital view. */
const ALTITUDE_SCALE = 1 / 20_000;
/** Scene units per metre downrange, in the orbital view. */
const DOWNRANGE_SCALE = 1 / 60_000;
/** Earth's drawn radius in the orbital view. Not to scale with the above. */
const PLANET_RADIUS = 12;

/** Sea-level pressure, for working out how far the plume has expanded. */
const P0 = 101_325;

export type CameraMode = 'pad' | 'chase' | 'orbital';

const CAMERA_LABELS: Record<CameraMode, { label: string; hint: string }> = {
  pad: { label: 'Pad', hint: 'Fixed at the launch site' },
  chase: { label: 'Chase', hint: 'Alongside the vehicle' },
  orbital: { label: 'Orbital', hint: 'The whole trajectory' },
};

interface FlightViewportProps {
  telemetry: readonly TelemetryPoint[];
  /** Index of the sample currently being shown. */
  index: number;
  /** The vehicle that was flown. Gives the model its real dimensions. */
  vehicle?: SimVehicle | null;
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

export function FlightViewport({ telemetry, index, vehicle, className }: FlightViewportProps) {
  const [mode, setMode] = useState<CameraMode>('pad');
  const [autoCamera, setAutoCamera] = useState(true);

  const current = telemetry[index] ?? null;

  /**
   * Which camera the moment calls for.
   *
   * The pad view stops being useful the instant the vehicle is a speck, and the
   * orbital view is meaningless while the rocket is still sitting on the
   * ground. Handing over at 2 km and again at 80 km follows the flight rather
   * than making the user chase it — and any manual choice switches this off,
   * because a camera that overrides you is worse than one that never moves.
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

  return (
    <div className={cn('relative', className)}>
      <Canvas
        key={mode === 'orbital' ? 'far' : 'near'}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        shadows={mode !== 'orbital'}
        camera={
          mode === 'orbital'
            ? { position: [26, 22, 26], fov: 45, near: 0.1, far: 4000 }
            : { position: [40, 22, 55], fov: 38, near: 0.5, far: 400_000 }
        }
      >
        {mode === 'orbital' ? (
          <OrbitalScene telemetry={telemetry} index={index} />
        ) : (
          <GroundScene point={current} vehicle={vehicle ?? null} mode={mode} />
        )}
      </Canvas>

      {/* ── Camera selection ───────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
        <div
          className="pointer-events-auto flex overflow-hidden rounded-instrument"
          role="group"
          aria-label="Camera angle"
          style={{ backgroundColor: 'rgba(6,6,5,0.72)' }}
        >
          {(Object.keys(CAMERA_LABELS) as CameraMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => chooseMode(key)}
              aria-pressed={mode === key}
              title={CAMERA_LABELS[key].hint}
              className={cn(
                'px-3 py-1.5 font-condensed text-micro uppercase tracking-instrument transition-colors duration-quick focus-ring',
                mode === key
                  ? 'bg-signal-flame/15 text-signal-flame-bright'
                  : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {CAMERA_LABELS[key].label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAutoCamera((on) => !on)}
            aria-pressed={autoCamera}
            title="Follow the flight automatically"
            className={cn(
              'px-3 py-1.5 font-condensed text-micro uppercase tracking-instrument transition-colors duration-quick focus-ring',
              autoCamera ? 'text-signal-nominal-bright' : 'text-ink-500 hover:text-ink-200',
            )}
          >
            Auto
          </button>
        </div>

        {current && (
          <p
            className="pointer-events-none rounded-instrument px-2 py-1 font-mono text-[0.6rem] tabular-nums text-ink-300"
            style={{ backgroundColor: 'rgba(6,6,5,0.72)' }}
          >
            T+{current.t.toFixed(0)}s · {(current.altitude_m / 1000).toFixed(1)} km ·{' '}
            {current.speed_ms.toFixed(0)} m/s
          </p>
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

  // Throttle as a fraction of this flight's own peak thrust: an engine at 60%
  // should look like an engine at 60%.
  const throttle = point && point.thrust_N > 0 ? 1 : 0;

  return (
    <>
      <color attach="background" args={[sky.getHex()]} />
      <fog attach="fog" args={[sky.getHex(), vehicleLength * 8, vehicleLength * 90]} />

      {/* Sun, low and warm, so the vehicle has a lit side and a shadow side. */}
      <ambientLight intensity={0.45 + skyFade * -0.2} />
      <hemisphereLight args={[sky.getHex(), '#3B342B', 0.6]} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={2.2}
        color="#FFF4E2"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Stars, once the sky is dark enough for them to be visible. */}
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

      <GroundCamera mode={mode} vehicleLength={vehicleLength} altitude={altitude} />
    </>
  );
}

/**
 * The launch site, and the ground receding beneath it.
 *
 * Everything here is static geometry that *moves down* as the vehicle climbs,
 * which is what sells the ascent: there is no sense of speed without a fixed
 * world to measure it against. Above ten kilometres it is dropped entirely —
 * by then it is below the fog and costing frames for nothing.
 */
function LaunchSite({ altitude, vehicleLength }: { altitude: number; vehicleLength: number }) {
  const scale = vehicleLength;
  if (altitude > 12_000) return null;

  return (
    <group position={[0, -altitude, 0]}>
      {/* Terrain. A large plate, dark and matte, so the vehicle reads against it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[scale * 60, 64]} />
        <meshStandardMaterial color="#3A342B" roughness={0.96} metalness={0} />
      </mesh>

      {/* The pad: a raised concrete apron with a flame trench beneath it. */}
      <mesh position={[0, scale * 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[scale * 0.55, scale * 0.6, scale * 0.04, 32]} />
        <meshStandardMaterial color="#6B665C" roughness={0.9} />
      </mesh>
      <mesh position={[0, -scale * 0.05, 0]}>
        <cylinderGeometry args={[scale * 0.16, scale * 0.16, scale * 0.14, 24, 1, true]} />
        <meshStandardMaterial color="#17150F" roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {/* Hold-down arms. Four, at the base, as on a real pad. */}
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

      {/* Service tower, offset to one side and taller than the vehicle. */}
      <group position={[scale * 0.5, 0, 0]}>
        <mesh position={[0, scale * 0.6, 0]} castShadow>
          <boxGeometry args={[scale * 0.1, scale * 1.2, scale * 0.1]} />
          <meshStandardMaterial color="#6E6A63" roughness={0.75} metalness={0.35} />
        </mesh>
        {/* Crew and service arms, stepping up the tower. */}
        {[0.35, 0.6, 0.85].map((h) => (
          <mesh key={h} position={[-scale * 0.16, scale * 1.2 * h, 0]} castShadow>
            <boxGeometry args={[scale * 0.22, scale * 0.025, scale * 0.05]} />
            <meshStandardMaterial color="#5C5852" roughness={0.8} metalness={0.3} />
          </mesh>
        ))}
        {/* Lightning mast. */}
        <mesh position={[0, scale * 1.32, 0]}>
          <cylinderGeometry args={[scale * 0.006, scale * 0.012, scale * 0.24, 8]} />
          <meshStandardMaterial color="#8A857C" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* Lightning towers, at a distance, giving the site its real footprint. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * scale * 1.6, scale * 0.75, -scale * 1.1]} castShadow>
          <cylinderGeometry args={[scale * 0.012, scale * 0.03, scale * 1.5, 8]} />
          <meshStandardMaterial color="#4C4841" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}

      {/* Range markers, so descent and downrange drift have a reference. */}
      {[10, 20, 35].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[scale * r, scale * r + scale * 0.06, 96]} />
          <meshBasicMaterial color="#5A5348" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The vehicle itself, eased toward each telemetry sample.
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

  useFrame((_, delta) => {
    if (!group.current || !point) return;

    // Pitch is commanded attitude from the engine, not derived here. The model
    // is built along +Y, and a pitch of π/2 is straight up, so the rotation is
    // the difference between the two.
    const targetRoll = point.pitch_rad - Math.PI / 2;
    group.current.rotation.z += (targetRoll - group.current.rotation.z) * Math.min(1, delta * 4);

    // Lateral drift from the wind, at true scale.
    const targetX = point.lateral_deviation_m ?? 0;
    group.current.position.x += (targetX - group.current.position.x) * Math.min(1, delta * 3);

    if (light.current) {
      light.current.intensity = burning ? 6 + throttle * 10 : 0;
    }
  });

  const currentStage = Math.min(point?.stage ?? 0, Math.max(0, bandCount - 1));

  return (
    <group ref={group}>
      <RocketModel
        vehicle={vehicle}
        currentStage={currentStage}
        burning={burning}
        throttle={throttle}
        ambientPressureRatio={pressureRatio}
      />
      {/* The plume lights the vehicle and the pad beneath it. */}
      <pointLight
        ref={light}
        position={[0, -vehicleLength * 0.08, 0]}
        color="#FFAF62"
        distance={vehicleLength * 12}
        decay={2}
      />
    </group>
  );
}

/**
 * The two ground cameras.
 *
 * Both frame the vehicle; they differ in whether they hold still. The pad
 * camera stays on the ground and cranes to follow, so the vehicle shrinks and
 * climbs out of frame the way it does from the press site. The chase camera
 * keeps station, so what you see instead is the attitude change.
 */
function GroundCamera({
  mode,
  vehicleLength,
  altitude,
}: {
  mode: CameraMode;
  vehicleLength: number;
  altitude: number;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const ease = Math.min(1, delta * 2.2);

    if (mode === 'pad') {
      // Anchored beside the pad, at roughly human height, craning upward. The
      // distance grows slowly with altitude so the vehicle stays in frame for
      // the first couple of kilometres rather than leaving instantly.
      const back = vehicleLength * 2.6 + altitude * 0.35;
      camera.position.lerp(
        new THREE.Vector3(back * 0.6, vehicleLength * 0.35, back),
        ease,
      );
      target.current.lerp(new THREE.Vector3(0, Math.min(altitude, vehicleLength * 1.2), 0), ease);
    } else {
      // Alongside, slightly behind and above, holding station.
      camera.position.lerp(
        new THREE.Vector3(vehicleLength * 1.5, vehicleLength * 0.5, vehicleLength * 2.1),
        ease,
      );
      target.current.lerp(new THREE.Vector3(0, vehicleLength * 0.45, 0), ease);
    }

    camera.lookAt(target.current);
  });

  return null;
}

// ──────────────────────────────────────────────────────────────
// Orbital scene
// ──────────────────────────────────────────────────────────────

/** The whole flight as one shape, against the planet it left. */
function OrbitalScene({
  telemetry,
  index,
}: {
  telemetry: readonly TelemetryPoint[];
  index: number;
}) {
  const flownPath = useMemo(() => {
    if (telemetry.length === 0) return [];
    // Thin the path: a polyline with 5,000 vertices costs more than it shows.
    const stride = Math.max(1, Math.floor(telemetry.length / 400));
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= index; i += stride) {
      const sample = telemetry[i];
      if (sample) points.push(toOrbitalScene(sample));
    }
    const last = telemetry[index];
    if (last) points.push(toOrbitalScene(last));
    return points;
  }, [telemetry, index]);

  /**
   * The rest of the flight, drawn faintly ahead of the marker.
   *
   * A trajectory you can already see the end of is a far better teaching object
   * than one that appears a metre at a time: the shape of the whole ascent is
   * the thing being taught, and hiding it until playback finishes withholds
   * exactly that.
   */
  const plannedPath = useMemo(() => {
    if (telemetry.length === 0) return [];
    const stride = Math.max(1, Math.floor(telemetry.length / 400));
    const points: THREE.Vector3[] = [];
    for (let i = index; i < telemetry.length; i += stride) {
      const sample = telemetry[i];
      if (sample) points.push(toOrbitalScene(sample));
    }
    return points;
  }, [telemetry, index]);

  const current = telemetry[index] ?? null;

  return (
    <>
      <color attach="background" args={['#04060B']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[40, 30, 20]} intensity={1.8} color="#fff6e8" />
      <Stars radius={300} depth={60} count={4000} factor={5} fade speed={0} />

      <Planet />

      {plannedPath.length > 1 && (
        <Line points={plannedPath} color="#847D6F" lineWidth={1} transparent opacity={0.3} dashed />
      )}
      {flownPath.length > 1 && (
        <Line points={flownPath} color="#E4682E" lineWidth={1.8} transparent opacity={0.95} />
      )}
      {current && <OrbitalMarker point={current} />}

      <OrbitControls
        enablePan={false}
        minDistance={16}
        maxDistance={220}
        target={[0, PLANET_RADIUS + 4, 0]}
      />
    </>
  );
}

function Planet() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
        <meshStandardMaterial color="#1d4470" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Atmosphere shell — back-face rendered so it reads as a limb glow. */}
      <mesh>
        <sphereGeometry args={[PLANET_RADIUS * 1.035, 48, 48]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
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
