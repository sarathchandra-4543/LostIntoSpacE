import { useMemo } from 'react';
import * as THREE from 'three';

import type { SimVehicle } from '@/types/simulation';

/**
 * A rocket that looks like a rocket.
 *
 * What was here before was a `coneGeometry` — one twelve-sided cone standing in
 * for an entire launch vehicle, with a smaller cone underneath it for the
 * flame. It read as a paper dart, and it undercut everything else on the page:
 * a user is being asked to believe a physics engine that cannot draw the thing
 * it is flying.
 *
 * ## Built from the vehicle, not from taste
 *
 * Every dimension here is read off the `SimVehicle` that was actually flown.
 * Total length and diameter come from the vehicle record; each stage's share of
 * the length is proportional to its wet mass, which is how a real launcher
 * divides up — a first stage carrying 80% of the propellant is most of the
 * airframe. Fin span is derived from body diameter, engine bells from stage
 * diameter. Nothing is a magic number chosen to look right, so a stubby vehicle
 * draws stubby and a pencil draws as a pencil.
 *
 * ## Why lathes rather than primitives
 *
 * A nose cone is not a cone. Real ones are ogives — a circular arc tangent to
 * the body — because that is what minimises transonic drag, and the drag model
 * in this engine already assumes one. `LatheGeometry` takes the profile curve
 * directly, so the silhouette on screen is the silhouette the physics costed.
 * The engine bell is the same story: a bell is a parabolic expansion, not a
 * truncated cone, and at these sizes the difference is the most recognisable
 * shape on the vehicle.
 */

/** Radial segments. Enough to read as round at any size the camera reaches. */
const RADIAL = 32;

/** Fraction of total length given over to the nose cone. */
const NOSE_FRACTION = 0.11;

/**
 * The profile of a tangent-ogive nose cone.
 *
 * The ogive radius is fixed by the requirement that the curve meet the body
 * tangentially at the base — that tangency is the whole point, since a
 * discontinuity in slope there is a shock the drag model would have to pay for.
 *
 * Returns points from tip to base, in metres, for a lathe about the Y axis.
 */
function ogiveProfile(radius: number, length: number, segments = 20): THREE.Vector2[] {
  // ρ = (R² + L²) / 2R, the classic tangent-ogive construction.
  const rho = (radius * radius + length * length) / (2 * radius);
  const points: THREE.Vector2[] = [];

  for (let i = 0; i <= segments; i++) {
    const y = (i / segments) * length;
    // x(y) = √(ρ² − (L − y)²) − (ρ − R)
    const inner = rho * rho - (length - y) * (length - y);
    const x = Math.max(0, Math.sqrt(Math.max(0, inner)) - (rho - radius));
    points.push(new THREE.Vector2(x, y));
  }
  return points;
}

/**
 * The profile of a bell nozzle.
 *
 * Converging to the throat, then a parabolic expansion to the exit. The exit
 * plane is left open, because a nozzle is a hole and closing it makes the
 * engine read as a lump.
 */
function bellProfile(exitRadius: number, length: number, segments = 12): THREE.Vector2[] {
  const throat = exitRadius * 0.3;
  const points: THREE.Vector2[] = [new THREE.Vector2(throat * 1.5, 0)];

  // Convergent section, short and steep as a real chamber throat is.
  points.push(new THREE.Vector2(throat, length * 0.18));

  // Parabolic bell.
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const y = length * (0.18 + 0.82 * t);
    const r = throat + (exitRadius - throat) * Math.sqrt(t);
    points.push(new THREE.Vector2(r, y));
  }
  return points;
}

/** A swept, tapered fin — the planform real launchers actually fly. */
function finShape(rootChord: number, tipChord: number, span: number): THREE.Shape {
  const shape = new THREE.Shape();
  const sweep = rootChord * 0.55;
  shape.moveTo(0, 0);
  shape.lineTo(0, rootChord);
  shape.lineTo(span, rootChord - sweep);
  shape.lineTo(span, rootChord - sweep - tipChord);
  shape.closePath();
  return shape;
}

/** One stage's share of the airframe, worked out from its wet mass. */
interface StageBand {
  readonly index: number;
  /** Height of this stage's base above the vehicle's own base. Unit: m */
  readonly base_m: number;
  /** Length of this stage. Unit: m */
  readonly length_m: number;
  /** Body radius of this stage. Unit: m */
  readonly radius_m: number;
  /** Bell exit radius. Unit: m */
  readonly bellRadius_m: number;
}

/**
 * Divide the airframe between the stages.
 *
 * Stage 0 is at the bottom and carries the most propellant, so it gets the most
 * length. Upper stages are drawn slightly narrower, which is what an interstage
 * taper looks like and what makes the stack legible as a stack.
 */
export function stageBands(vehicle: SimVehicle | null): StageBand[] {
  const length = vehicle?.length_m && vehicle.length_m > 0 ? vehicle.length_m : 30;
  const diameter = vehicle?.diameter_m && vehicle.diameter_m > 0 ? vehicle.diameter_m : 2.4;
  const stages = vehicle?.stages?.length ? vehicle.stages : null;

  const bodyLength = length * (1 - NOSE_FRACTION);
  const radius = diameter / 2;

  if (!stages) {
    return [
      { index: 0, base_m: 0, length_m: bodyLength, radius_m: radius, bellRadius_m: radius * 0.62 },
    ];
  }

  const masses = stages.map((s) => Math.max(1, s.dry_mass_kg + s.propellant_mass_kg));
  const total = masses.reduce((a, b) => a + b, 0);

  const bands: StageBand[] = [];
  let cursor = 0;
  stages.forEach((_, i) => {
    // A stage never shrinks below a tenth of the airframe, or a tiny kick stage
    // becomes an invisible seam rather than a visible stage.
    const share = Math.max(0.1, masses[i]! / total);
    const stageLength = bodyLength * share;
    // Upper stages step in. Never below 55% of the first stage's radius.
    const stageRadius = radius * Math.max(0.55, 1 - i * 0.16);
    bands.push({
      index: i,
      base_m: cursor,
      length_m: stageLength,
      radius_m: stageRadius,
      bellRadius_m: stageRadius * 0.62,
    });
    cursor += stageLength;
  });

  // Normalise so the stack ends exactly where the nose begins.
  const scale = bodyLength / Math.max(cursor, 1e-6);
  return bands.map((band) => ({
    ...band,
    base_m: band.base_m * scale,
    length_m: band.length_m * scale,
  }));
}

/** Hull, engine and trim materials, shared across every mesh that uses them. */
function useMaterials() {
  return useMemo(() => {
    const hull = new THREE.MeshStandardMaterial({
      color: '#D8D3C9',
      metalness: 0.62,
      roughness: 0.34,
    });
    const hullDark = new THREE.MeshStandardMaterial({
      color: '#8A8478',
      metalness: 0.7,
      roughness: 0.42,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: '#C0392B',
      metalness: 0.3,
      roughness: 0.55,
    });
    const engine = new THREE.MeshStandardMaterial({
      color: '#4A4640',
      metalness: 0.85,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const shadowed = new THREE.MeshStandardMaterial({
      color: '#2A2724',
      metalness: 0.6,
      roughness: 0.6,
    });
    return { hull, hullDark, trim, engine, shadowed };
  }, []);
}

export interface RocketModelProps {
  /** The vehicle that was flown. Drives every dimension. */
  vehicle: SimVehicle | null;
  /** Which stage is currently attached. Lower stages below it are gone. */
  currentStage: number;
  /** Whether an engine is lit. */
  burning: boolean;
  /**
   * Thrust as a fraction of the vehicle's own maximum, driving plume length.
   * A throttled engine has a visibly shorter plume.
   */
  throttle: number;
  /**
   * Ambient pressure as a fraction of sea level.
   *
   * The plume expands as the air thins — a first stage that leaves the pad with
   * a tight blue flame is flying a plume several times the vehicle's diameter
   * by the time it stages. That is real, and it is one of the most recognisable
   * things about a launch.
   */
  ambientPressureRatio: number;
}

/**
 * The vehicle, drawn from its own dimensions.
 *
 * Built along +Y with its base at the origin, so a caller positions it by
 * altitude and rotates it by pitch without compensating for the model.
 */
export function RocketModel({
  vehicle,
  currentStage,
  burning,
  throttle,
  ambientPressureRatio,
}: RocketModelProps) {
  const materials = useMaterials();
  const bands = useMemo(() => stageBands(vehicle), [vehicle]);

  const length = vehicle?.length_m && vehicle.length_m > 0 ? vehicle.length_m : 30;
  const noseLength = length * NOSE_FRACTION;
  const topBand = bands[bands.length - 1]!;

  const noseGeometry = useMemo(
    () => new THREE.LatheGeometry(ogiveProfile(topBand.radius_m, noseLength), RADIAL),
    [topBand.radius_m, noseLength],
  );

  // Only the attached stages are drawn. A separated stage has physically gone.
  const attached = bands.filter((band) => band.index >= currentStage);
  const activeBand = attached[0] ?? topBand;

  const bellGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        bellProfile(activeBand.bellRadius_m, activeBand.radius_m * 1.5),
        RADIAL,
      ),
    [activeBand.bellRadius_m, activeBand.radius_m],
  );

  const finGeometry = useMemo(() => {
    const root = activeBand.length_m * 0.26;
    return new THREE.ExtrudeGeometry(
      finShape(root, root * 0.42, activeBand.radius_m * 1.15),
      { depth: activeBand.radius_m * 0.09, bevelEnabled: false },
    );
  }, [activeBand.length_m, activeBand.radius_m]);

  // The stack sinks as stages leave, so the attached vehicle always sits on the
  // origin. Without this the rocket appears to jump upward at every separation.
  const stackBase = activeBand.base_m;

  // A vacuum plume is wider and far longer than a sea-level one.
  const expansion = 1 + (1 - Math.min(1, Math.max(0, ambientPressureRatio))) * 2.4;
  const plumeLength = activeBand.radius_m * 5 * throttle * expansion;
  const plumeRadius = activeBand.bellRadius_m * (0.85 + expansion * 0.22);

  return (
    <group position={[0, -stackBase, 0]}>
      {attached.map((band) => {
        const isActive = band.index === currentStage;
        return (
          <group key={band.index}>
            {/* Body tube */}
            <mesh
              position={[0, band.base_m + band.length_m / 2, 0]}
              material={isActive ? materials.hull : materials.hullDark}
              castShadow
            >
              <cylinderGeometry
                args={[band.radius_m, band.radius_m, band.length_m, RADIAL, 1]}
              />
            </mesh>

            {/* Interstage: a slightly proud collar, so the joint is visible. */}
            {band.index > 0 && (
              <mesh
                position={[0, band.base_m + band.length_m * 0.02, 0]}
                material={materials.shadowed}
              >
                <cylinderGeometry
                  args={[band.radius_m * 1.03, band.radius_m * 1.03, band.length_m * 0.05, RADIAL]}
                />
              </mesh>
            )}

            {/* A single livery band, the way a real launcher is marked. */}
            <mesh
              position={[0, band.base_m + band.length_m * 0.82, 0]}
              material={materials.trim}
            >
              <cylinderGeometry
                args={[band.radius_m * 1.012, band.radius_m * 1.012, band.length_m * 0.07, RADIAL]}
              />
            </mesh>
          </group>
        );
      })}

      {/* Nose cone — a tangent ogive, the profile the drag model assumes. */}
      <mesh
        position={[0, topBand.base_m + topBand.length_m, 0]}
        geometry={noseGeometry}
        material={materials.hull}
        castShadow
      />

      {/* Engine bell on whichever stage is currently flying. */}
      <group position={[0, activeBand.base_m, 0]}>
        <mesh geometry={bellGeometry} material={materials.engine} rotation={[Math.PI, 0, 0]} />
        {/* The thrust structure the bell hangs from. */}
        <mesh position={[0, activeBand.radius_m * 0.2, 0]} material={materials.shadowed}>
          <cylinderGeometry
            args={[activeBand.radius_m * 0.85, activeBand.radius_m * 0.95, activeBand.radius_m * 0.4, RADIAL]}
          />
        </mesh>
      </group>

      {/* Fins, on the flying stage only — upper stages fly in vacuum. */}
      {currentStage === 0 &&
        [0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              geometry={finGeometry}
              material={materials.hullDark}
              position={[
                Math.cos(angle) * activeBand.radius_m * 0.98,
                activeBand.base_m + activeBand.radius_m * 0.3,
                Math.sin(angle) * activeBand.radius_m * 0.98,
              ]}
              rotation={[0, -angle, 0]}
              castShadow
            />
          );
        })}

      {/* The plume. Additive, so it reads as light rather than as a solid. */}
      {burning && throttle > 0.01 && (
        <group position={[0, activeBand.base_m - activeBand.radius_m * 1.4, 0]}>
          {/* Outer, cooler envelope. */}
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[plumeRadius, plumeLength, 24, 1, true]} />
            <meshBasicMaterial
              color="#E4682E"
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* The core: white-hot, and much shorter. */}
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[plumeRadius * 0.42, plumeLength * 0.55, 20, 1, true]} />
            <meshBasicMaterial
              color="#FFF3DC"
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Mach diamonds: only in the over-expanded sea-level regime. */}
          {ambientPressureRatio > 0.35 &&
            [0.3, 0.5, 0.7].map((t) => (
              <mesh key={t} position={[0, -plumeLength * t, 0]}>
                <sphereGeometry args={[plumeRadius * 0.3 * (1 - t * 0.5), 10, 8]} />
                <meshBasicMaterial
                  color="#FFD9A0"
                  transparent
                  opacity={0.5}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            ))}
        </group>
      )}
    </group>
  );
}
