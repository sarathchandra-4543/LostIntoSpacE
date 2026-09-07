import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { cn } from '@/lib/utils';

import { Body3D } from './Body3D';
import {
  BODIES_BY_ID,
  PLANETS,
  SYSTEM_BODIES,
  bodyRadiusToScene,
  moonsOf,
  orbitRadiusToScene,
  systemExtent,
  type ScaleMode,
  type SystemBody,
} from './systemBodies';

/**
 * The solar system.
 *
 * A place you can fly around, rather than a diagram you look at. Every body is
 * drawn from its measured radius, surface and tilt; every orbit from its
 * measured semi-major axis and inclination; and the camera has no restrictions
 * on it at all — rotate, pan, and zoom continuously from a moon a thousand
 * kilometres across out to Neptune's orbit.
 *
 * ## Static, and honest about it
 *
 * Bodies sit at a fixed phase on their orbits. Their *positions* are therefore
 * arrangement, not ephemeris — this does not claim to show you where Mars is
 * tonight. Everything else is measured: the sizes, the orbital radii, the
 * inclinations, the tilts, the rotation periods that drive the spin. The two
 * kinds of claim are kept apart, and the panel says which is which.
 *
 * ## The scale control
 *
 * Radii are *always* in true proportion to one another. The toggle changes only
 * how far apart the orbits are drawn. That is the honest way to offer a
 * readable diagram without lying about how big anything is, and switching to
 * true scale is itself the lesson: the system is overwhelmingly empty.
 */

/**
 * The system's scene contents, without a canvas of its own.
 *
 * Exported so the flight view can mount the same solar system inside its own
 * canvas rather than reimplementing it. Two implementations of "where the
 * planets are" would eventually disagree, and the disagreement would be
 * invisible until someone compared two screens side by side.
 */
export function SolarSystemScene({
  focusId,
  onSelect,
  showOrbits = true,
  showLabels = true,
  spinning = true,
  mode = 'compressed',
}: {
  focusId?: string | null;
  onSelect?: (body: SystemBody) => void;
  showOrbits?: boolean;
  showLabels?: boolean;
  spinning?: boolean;
  mode?: ScaleMode;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const [selected, setSelected] = useState<string | null>(focusId ?? null);

  const select = (body: SystemBody) => {
    setSelected(body.id);
    onSelect?.(body);
  };

  return (
    <>
      <color attach="background" args={['#04060A']} />
      <pointLight position={[0, 0, 0]} intensity={3.2} distance={0} decay={0} color="#FFF4E2" />
      <ambientLight intensity={0.07} />
      <Stars radius={300_000} depth={60_000} count={7000} factor={900} fade speed={0} />

      <Suspense fallback={null}>
        <System
          mode={mode}
          selectedId={selected}
          showOrbits={showOrbits}
          showLabels={showLabels}
          spinning={spinning}
          onSelect={select}
        />
      </Suspense>

      <CameraRig focusId={focusId ?? null} mode={mode} controls={controls} />

      <OrbitControls
        ref={controls}
        enablePan
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={1.4}
        rotateSpeed={0.7}
        panSpeed={1}
        minDistance={0.05}
        maxDistance={8_000_000}
        makeDefault
      />
    </>
  );
}

export interface SolarSystemProps {
  /** Body to frame and mark on load — usually the mission's destination. */
  focusId?: string | null;
  /** Called when the viewer selects a body. */
  onSelect?: (body: SystemBody) => void;
  className?: string;
}

export function SolarSystem({ focusId, onSelect, className }: SolarSystemProps) {
  const [mode, setMode] = useState<ScaleMode>('compressed');
  const [selected, setSelected] = useState<string | null>(focusId ?? null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [spinning, setSpinning] = useState(true);
  const controls = useRef<OrbitControlsImpl>(null);

  const active = selected ? (BODIES_BY_ID.get(selected) ?? null) : null;

  // Selecting also frames. At system scale a planet is a few pixels across, so
  // "click it to look at it" is the only way to actually see one — and it is
  // what makes the honest small sizes usable rather than merely correct.
  const [framed, setFramed] = useState<string | null>(focusId ?? null);
  const select = (body: SystemBody) => {
    setSelected(body.id);
    setFramed(body.id);
    onSelect?.(body);
  };

  return (
    <div className={cn('relative', className)}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        camera={{ position: [0, 90_000, 200_000], fov: 45, near: 0.05, far: 20_000_000 }}
      >
        <color attach="background" args={['#04060A']} />

        {/* The Sun is the only light source, which is the physically correct
            arrangement and the reason every planet shows a terminator. */}
        <pointLight position={[0, 0, 0]} intensity={3.2} distance={0} decay={0} color="#FFF4E2" />
        {/* A trace of ambient so a night side is dark rather than absent. */}
        <ambientLight intensity={0.07} />

        <Stars radius={300_000} depth={60_000} count={7000} factor={900} fade speed={0} />

        <Suspense fallback={null}>
          <System
            mode={mode}
            selectedId={selected}
            showOrbits={showOrbits}
            showLabels={showLabels}
            spinning={spinning}
            onSelect={select}
          />
        </Suspense>

        <CameraRig focusId={framed} mode={mode} controls={controls} />

        <OrbitControls
          ref={controls}
          // No limits. The brief asked for freedom to rotate, revolve and zoom
          // at any point out to the whole system, so there are no polar clamps,
          // no distance clamps beyond what the near plane needs, and panning is
          // enabled so you can put anything at the centre of your own view.
          enablePan
          enableDamping
          dampingFactor={0.08}
          zoomSpeed={1.4}
          rotateSpeed={0.7}
          panSpeed={1}
          minDistance={0.05}
          maxDistance={8_000_000}
          makeDefault
        />
      </Canvas>

      {/* ── Controls ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          <Segmented
            options={[
              { value: 'compressed', label: 'Diagram' },
              { value: 'true', label: 'True scale' },
            ]}
            value={mode}
            onChange={(v) => setMode(v as ScaleMode)}
          />
          <Toggle active={showOrbits} onClick={() => setShowOrbits((v) => !v)} label="Orbits" />
          <Toggle active={showLabels} onClick={() => setShowLabels((v) => !v)} label="Labels" />
          <Toggle active={spinning} onClick={() => setSpinning((v) => !v)} label="Rotation" />
          <Toggle
            active={false}
            onClick={() => {
              setFramed(null);
              setSelected(null);
            }}
            label="Whole system"
          />
        </div>
      </div>

      {/* ── What you are looking at ────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3">
        {active ? (
          <div
            className="over-canvas-strong pointer-events-auto max-w-sm p-3"
            
          >
            <p className="font-condensed text-micro uppercase tracking-instrument oc-quiet">{active.kind.replace(/_/g, ' ')}</p>
            <h3 className="font-display text-xl leading-tight oc-loud">{active.name}</h3>
            <p className="mt-1 text-[0.7rem] leading-relaxed oc-quiet">{active.tagline}</p>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6rem] oc-quiet">
              <span>r {(active.radius_m / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km</span>
              {active.orbitRadius_m > 0 && (
                <span>
                  a{' '}
                  {(active.orbitRadius_m / 1e9).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  Gm
                </span>
              )}
              {active.orbitPeriod_d !== 0 && (
                <span>P {Math.abs(active.orbitPeriod_d).toLocaleString(undefined, { maximumFractionDigits: 1 })} d</span>
              )}
              <span>tilt {active.axialTilt_deg}°</span>
            </dl>
          </div>
        ) : (
          <p
            className="over-canvas pointer-events-none px-2 py-1 font-mono text-[0.6rem] oc-quiet"
            
          >
            drag to orbit · scroll to zoom · right-drag to pan · click a body
          </p>
        )}

        <p
          className="over-canvas pointer-events-none max-w-[18rem] px-2 py-1 text-right font-mono text-[0.55rem] leading-relaxed oc-quiet"
          
        >
          {mode === 'compressed'
            ? 'Sizes in true proportion. Orbit distances compressed to fit one frame.'
            : 'Sizes and distances both true. Most things are far too small to see.'}
          <br />
          Positions are arrangement, not ephemeris.
        </p>
      </div>
    </div>
  );
}

/** Everything in the scene, laid out for the chosen scale. */
function System({
  mode,
  selectedId,
  showOrbits,
  showLabels,
  spinning,
  onSelect,
}: {
  mode: ScaleMode;
  selectedId: string | null;
  showOrbits: boolean;
  showLabels: boolean;
  spinning: boolean;
  onSelect: (body: SystemBody) => void;
}) {
  const timeScale = spinning ? 6000 : 0;

  return (
    <group>
      {/* The Sun, at the origin. */}
      <SunBody
        body={BODIES_BY_ID.get('sol')!}
        mode={mode}
        selected={selectedId === 'sol'}
        showLabel={showLabels}
        timeScale={timeScale}
        onSelect={onSelect}
      />

      {PLANETS.map((planet) => {
        const a = orbitRadiusToScene(planet.orbitRadius_m, mode);
        const phase = phaseOf(planet.id);
        const inclination = (planet.inclination_deg * Math.PI) / 180;
        const position = new THREE.Vector3(
          Math.cos(phase) * a,
          Math.sin(inclination) * Math.sin(phase) * a,
          Math.sin(phase) * a,
        );

        return (
          <group key={planet.id}>
            {showOrbits && <OrbitPath radius={a} inclination={inclination} />}
            <group position={position}>
              <PlanetBody
                body={planet}
                mode={mode}
                selected={selectedId === planet.id}
                showLabel={showLabels}
                timeScale={timeScale}
                onSelect={onSelect}
              />
              {moonsOf(planet.id).map((moon) => {
                // Moon orbits get their own compression: at system scale a real
                // lunar orbit is smaller than the planet's drawn radius, so the
                // moon would sit inside its parent. The floor keeps it outside.
                const planetRadius = bodyRadiusToScene(planet.radius_m, mode);
                const raw = orbitRadiusToScene(moon.orbitRadius_m, mode);
                const moonA =
                  mode === 'true' ? raw : Math.max(planetRadius * 2.2, raw * 0.045);
                const moonPhase = phaseOf(moon.id);
                return (
                  <group key={moon.id}>
                    {showOrbits && <OrbitPath radius={moonA} inclination={0} faint />}
                    <group
                      position={[
                        Math.cos(moonPhase) * moonA,
                        0,
                        Math.sin(moonPhase) * moonA,
                      ]}
                    >
                      <PlanetBody
                        body={moon}
                        mode={mode}
                        selected={selectedId === moon.id}
                        showLabel={showLabels}
                        timeScale={timeScale}
                        onSelect={onSelect}
                      />
                    </group>
                  </group>
                );
              })}
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** The Sun. Separated because it lights the scene rather than being lit by it. */
function SunBody({
  body,
  mode,
  selected,
  showLabel,
  timeScale,
  onSelect,
}: {
  body: SystemBody;
  mode: ScaleMode;
  selected: boolean;
  showLabel: boolean;
  timeScale: number;
  onSelect: (body: SystemBody) => void;
}) {
  const radius = bodyRadiusToScene(body.radius_m, mode);
  return (
    <group onClick={(e) => (e.stopPropagation(), onSelect(body))}>
      <Body3D
        id={body.id}
        appearance={body.appearance}
        radius={radius}
        rotationPeriod_h={body.rotationPeriod_h}
        axialTilt_deg={body.axialTilt_deg}
        timeScale={timeScale}
        highlighted={selected}
      />
      {showLabel && (
        <BodyLabel
          name={body.name}
          offset={radius}
          selected={selected}
          visibleWithin={Number.POSITIVE_INFINITY}
        />
      )}
    </group>
  );
}

/** A planet or moon at its place in the arrangement. */
function PlanetBody({
  body,
  mode,
  selected,
  showLabel,
  timeScale,
  onSelect,
}: {
  body: SystemBody;
  mode: ScaleMode;
  selected: boolean;
  showLabel: boolean;
  timeScale: number;
  onSelect: (body: SystemBody) => void;
}) {
  // A moon is sized against its primary so the size floor can never make it
  // larger than the thing it orbits.
  const parent = body.parent ? BODIES_BY_ID.get(body.parent) : null;
  const radius = bodyRadiusToScene(
    body.radius_m,
    mode,
    parent && parent.id !== 'sol' ? parent.radius_m : undefined,
  );
  return (
    <group onClick={(e) => (e.stopPropagation(), onSelect(body))}>
      <Body3D
        id={body.id}
        appearance={body.appearance}
        radius={radius}
        rotationPeriod_h={body.rotationPeriod_h}
        axialTilt_deg={body.axialTilt_deg}
        timeScale={timeScale}
        highlighted={selected}
      />
      {showLabel && (
        <BodyLabel
          name={body.name}
          offset={radius}
          selected={selected}
          // A planet is worth naming from across the system; a moon only once
          // you are close enough to its primary to tell the two apart.
          visibleWithin={body.kind === 'moon' ? 9_000 : 320_000}
        />
      )}
    </group>
  );
}

/**
 * A body's name, floated beside it in screen space.
 *
 * `Html` keeps the label at constant size however far away the body is, which
 * is what makes a system-wide view legible — a 3D text mesh would shrink to
 * nothing at exactly the zoom level where you most need to know what you are
 * looking at.
 *
 * ## Why labels appear and disappear
 *
 * Constant screen size has a cost: at system zoom, twenty labels of fixed size
 * pile onto a few hundred pixels of inner system and become an unreadable
 * smear — Ceres over Venus over Mercury over the Moon. So a label is shown only
 * while the camera is near enough for it to mean something, which is a
 * different distance for a planet than for one of Jupiter's moons.
 *
 * The effect is that flying inward reveals detail rather than adding noise,
 * which is also how a real chart works.
 */
function BodyLabel({
  name,
  offset,
  selected,
  /** Camera distance beyond which this label is hidden, in scene units. */
  visibleWithin,
}: {
  name: string;
  offset: number;
  selected: boolean;
  visibleWithin: number;
}) {
  const anchor = useRef<THREE.Group>(null);
  const [shown, setShown] = useState(true);
  const world = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    if (!anchor.current) return;
    anchor.current.getWorldPosition(world.current);
    const next = camera.position.distanceTo(world.current) < visibleWithin;
    // Only touch state on a genuine change, or this re-renders every frame.
    if (next !== shown) setShown(next);
  });

  return (
    <group ref={anchor}>
      {(shown || selected) && (
        <Html
          position={[0, offset * 1.3 + 2, 0]}
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[10, 0]}
        >
          <span
            className={cn(
              'whitespace-nowrap font-condensed text-[0.6rem] uppercase tracking-instrument',
              selected ? 'text-ink-50' : 'text-ink-300',
            )}
            style={{ textShadow: '0 1px 5px rgba(0,0,0,0.95)' }}
          >
            {name}
          </span>
        </Html>
      )}
    </group>
  );
}

/** An orbit, drawn as a ring in its own inclined plane. */
function OrbitPath({
  radius,
  inclination,
  faint,
}: {
  radius: number;
  inclination: number;
  faint?: boolean;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 192;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(t) * radius,
          Math.sin(inclination) * Math.sin(t) * radius,
          Math.sin(t) * radius,
        ),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius, inclination]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial
        color={faint ? '#4A453C' : '#625C51'}
        transparent
        opacity={faint ? 0.3 : 0.45}
      />
    </line>
  );
}

/**
 * Where the camera goes.
 *
 * Two jobs, and they are deliberately separate. On first paint it frames the
 * *whole system*, because opening inside the Sun — which is what a fixed
 * default position did — gives no sense of what you are looking at. After
 * that, selecting a body flies the camera to it over about a second.
 *
 * Both are one-shot. Once a move finishes the camera is the viewer's again and
 * nothing here touches it, because a camera that keeps re-framing fights the
 * person trying to look at something.
 */
function CameraRig({
  focusId,
  mode,
  controls,
}: {
  focusId?: string | null;
  mode: ScaleMode;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const applied = useRef<string | null>(null);
  const flight = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
  } | null>(null);

  useFrame((_, delta) => {
    const key = `${focusId ?? '*'}:${mode}`;

    if (applied.current !== key) {
      applied.current = key;
      const destination = framingFor(focusId ?? null, mode);
      flight.current = {
        from: camera.position.clone(),
        to: destination.position,
        fromTarget: controls.current?.target.clone() ?? new THREE.Vector3(),
        toTarget: destination.target,
        // A first framing should be instant; a later move should be a move.
        t: applied.current === key && flight.current === null ? 1 : 0,
      };
      // On the very first pass there is nothing to fly from, so snap.
      if (!controls.current) {
        camera.position.copy(destination.position);
        flight.current = null;
        return;
      }
    }

    const move = flight.current;
    if (!move) return;

    move.t = Math.min(1, move.t + delta * 1.1);
    // Ease out, so the camera arrives rather than stopping.
    const k = 1 - Math.pow(1 - move.t, 3);

    camera.position.lerpVectors(move.from, move.to, k);
    if (controls.current) {
      controls.current.target.lerpVectors(move.fromTarget, move.toTarget, k);
      controls.current.update();
    }
    if (move.t >= 1) flight.current = null;
  });

  return null;
}

/**
 * Where to stand to look at something.
 *
 * With no body named, far enough out that Neptune's orbit is in frame. With
 * one, close enough that the body fills a useful part of the view — six radii
 * back, which frames a planet with room around it at any size from Phobos to
 * the Sun.
 */
function framingFor(
  focusId: string | null,
  mode: ScaleMode,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const body = focusId ? BODIES_BY_ID.get(focusId) : null;

  if (!body) {
    const extent = systemExtent(mode);
    return {
      position: new THREE.Vector3(0, extent * 0.55, extent * 1.35),
      target: new THREE.Vector3(0, 0, 0),
    };
  }

  const centre = positionOf(body, mode);
  const radius = bodyRadiusToScene(body.radius_m, mode);
  const distance = Math.max(radius * 6, 60);

  // Stand on the sunlit side, three-quarters round.
  //
  // The Sun is the only light in the scene, so a camera placed on a fixed
  // offset lands on whichever face the body's orbital phase happens to present
  // — and for half the catalogue that is the night side, which renders as a
  // black disc. Approaching from sunward and swinging a third of the way round
  // shows the lit face *and* the terminator, which is the view that actually
  // says something about where the light is coming from.
  const sunward = centre.clone().normalize().negate();
  if (sunward.lengthSq() < 1e-9) sunward.set(0, 0, 1); // The Sun itself.
  const side = new THREE.Vector3(0, 1, 0).cross(sunward).normalize();

  const position = centre
    .clone()
    .add(sunward.multiplyScalar(distance * 0.78))
    .add(side.multiplyScalar(distance * 0.55))
    .add(new THREE.Vector3(0, distance * 0.32, 0));

  return { position, target: centre };
}

/** A body's place in the fixed arrangement, in scene units. */
function positionOf(body: SystemBody, mode: ScaleMode): THREE.Vector3 {
  if (!body.parent) return new THREE.Vector3();

  const phase = phaseOf(body.id);

  if (body.parent === 'sol') {
    const a = orbitRadiusToScene(body.orbitRadius_m, mode);
    const inclination = (body.inclination_deg * Math.PI) / 180;
    return new THREE.Vector3(
      Math.cos(phase) * a,
      Math.sin(inclination) * Math.sin(phase) * a,
      Math.sin(phase) * a,
    );
  }

  // A moon sits at its parent's place plus its own (compressed) orbit.
  const parent = BODIES_BY_ID.get(body.parent);
  if (!parent) return new THREE.Vector3();
  const parentPosition = positionOf(parent, mode);
  const parentRadius = bodyRadiusToScene(parent.radius_m, mode);
  const raw = orbitRadiusToScene(body.orbitRadius_m, mode);
  const a = mode === 'true' ? raw : Math.max(parentRadius * 2.2, raw * 0.045);
  return parentPosition.add(
    new THREE.Vector3(Math.cos(phase) * a, 0, Math.sin(phase) * a),
  );
}

/**
 * The fixed phase a body sits at.
 *
 * The golden angle, indexed by catalogue position: it never repeats and never
 * lines bodies up, so the arrangement reads as a system rather than a parade.
 * The layout and the camera both call this, which is what stops them
 * disagreeing about where anything is.
 */
export function phaseOf(id: string): number {
  const index = SYSTEM_BODIES.findIndex((b) => b.id === id);
  return index < 0 ? 0 : (index * 2.399963) % (Math.PI * 2);
}

// ──────────────────────────────────────────────────────────────
// Small controls
// ──────────────────────────────────────────────────────────────

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="over-canvas flex overflow-hidden"
      
      role="group"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'px-2.5 py-1.5 font-condensed text-micro uppercase tracking-instrument transition-colors duration-quick focus-ring',
            value === option.value
              ? 'oc-active'
              : 'oc-quiet hover:text-ink-50',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'over-canvas px-2.5 py-1.5 font-condensed text-micro uppercase tracking-instrument transition-colors duration-quick focus-ring',
        active ? 'oc-loud' : 'oc-quiet opacity-70 hover:opacity-100',
      )}
      
    >
      {label}
    </button>
  );
}
