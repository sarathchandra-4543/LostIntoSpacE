import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { currentTexture, loadBodyMap } from './bodyTextures';
import { type BodyAppearance } from './planetTexture';

/**
 * One world, drawn as a world.
 *
 * A sphere with its measured surface mapped onto it, its axial tilt applied,
 * turning at its own rotation period, wrapped in an atmosphere where it has one
 * and wearing rings where it has those.
 *
 * The tilt is not decoration. Uranus lies on its side at 98°, Venus is upside
 * down at 177°, and those two facts are visible here for the same reason they
 * are in the data: they are the most distinctive thing about each planet's
 * rotation.
 */

export interface Body3DProps {
  id: string;
  appearance: BodyAppearance;
  /** Drawn radius, in scene units. */
  radius: number;
  /** Sidereal rotation period. Negative is retrograde. Unit: hours */
  rotationPeriod_h?: number;
  /** Axial tilt. Unit: degrees */
  axialTilt_deg?: number;
  /** Seconds of simulated time per real second. Zero freezes rotation. */
  timeScale?: number;
  /** Draw a selection ring around it. */
  highlighted?: boolean;
}

export function Body3D({
  id,
  appearance,
  radius,
  rotationPeriod_h = 24,
  axialTilt_deg = 0,
  timeScale = 0,
  highlighted = false,
}: Body3DProps) {
  const spin = useRef<THREE.Mesh>(null);

  /**
   * The surface, upgraded in place.
   *
   * The generated texture is available synchronously so the sphere is never
   * blank, and the real mission mosaic — where one exists — swaps in when it
   * arrives. A world that pops into existence three seconds late is worse than
   * one that sharpens.
   */
  const [, setLoaded] = useState(0);
  const texture = currentTexture(id, appearance);

  useEffect(() => {
    let cancelled = false;
    loadBodyMap(id).then((map) => {
      if (map && !cancelled) setLoaded((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const material = useMemo(() => {
    if (appearance.emissive) {
      // A star is not lit by anything; it *is* the light. A standard material
      // would render it as a dark ball on the night side, which is wrong.
      return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    }
    return new THREE.MeshStandardMaterial({
      map: texture,
      // Albedo is a measurement, so it drives roughness rather than a guess:
      // a bright icy moon scatters, a dark carbonaceous one does not.
      roughness: 1 - Math.min(0.55, appearance.albedo * 0.6),
      metalness: appearance.texture === 'metallic' ? 0.7 : 0.05,
    });
  }, [texture, appearance]);

  useFrame((_, delta) => {
    if (!spin.current || timeScale <= 0) return;
    const period = (rotationPeriod_h || 24) * 3600;
    if (period === 0) return;
    spin.current.rotation.y += (delta * timeScale * Math.PI * 2) / period;
  });

  const tilt = (axialTilt_deg * Math.PI) / 180;
  const atmosphere = appearance.atmosphere_strength ?? 0;

  return (
    <group rotation={[0, 0, tilt]}>
      <mesh ref={spin} material={material}>
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>

      {/* Atmosphere: a back-face shell, so it reads as a limb glow rather than
          as a bag over the planet. */}
      {atmosphere > 0.02 && !appearance.emissive && (
        <mesh>
          <sphereGeometry args={[radius * 1.025, 48, 32]} />
          <meshBasicMaterial
            color={appearance.atmosphere_color ?? appearance.base_color}
            transparent
            opacity={Math.min(0.42, atmosphere * 0.4)}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* A star's corona. */}
      {appearance.emissive && (
        <>
          <mesh>
            <sphereGeometry args={[radius * 1.12, 32, 24]} />
            <meshBasicMaterial
              color={appearance.atmosphere_color ?? '#FFB454'}
              transparent
              opacity={0.22}
              side={THREE.BackSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[radius * 1.45, 24, 16]} />
            <meshBasicMaterial
              color={appearance.atmosphere_color ?? '#FFB454'}
              transparent
              opacity={0.08}
              side={THREE.BackSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      )}

      {appearance.ring && <Rings radius={radius} ring={appearance.ring} />}

      {highlighted && <SelectionRing radius={radius} />}
    </group>
  );
}

/**
 * A ring system.
 *
 * Built as a flat annulus with the UVs rewritten so a radial gradient can be
 * painted across it — the default ring geometry maps UVs for a rectangle, which
 * would smear any texture into streaks. The Cassini Division is drawn because
 * it is the one gap anybody can point to.
 */
function Rings({
  radius,
  ring,
}: {
  radius: number;
  ring: NonNullable<BodyAppearance['ring']>;
}) {
  const inner = radius * ring.inner_radius_ratio;
  const outer = radius * ring.outer_radius_ratio;

  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(inner, outer, 128, 1);
    // Re-map UVs radially so the gradient runs inner-to-outer.
    const position = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      const t = (v.length() - inner) / (outer - inner);
      uv.setXY(i, t, 1);
    }
    uv.needsUpdate = true;
    return geo;
  }, [inner, outer]);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.08, ring.color);
    gradient.addColorStop(0.55, ring.color);
    // The division: a real gap, at the real radius ratio.
    gradient.addColorStop(0.62, 'rgba(0,0,0,0.05)');
    gradient.addColorStop(0.68, ring.color);
    gradient.addColorStop(0.95, ring.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [ring.color]);

  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={ring.opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * The marker that says "this is the one you chose".
 *
 * A hairline, not a hoop. The first version was thick enough and opaque enough
 * to become the subject of the frame — you noticed the marker before the
 * planet, which is exactly backwards for a view whose entire job is to show you
 * the planet. It is now the same weight as every other rule in the interface,
 * set well clear of the limb so it never crosses the body itself.
 */
function SelectionRing({ radius }: { radius: number }) {
  const ring = useRef<THREE.Mesh>(null);

  // Always faces the camera, so it reads as an annotation on the view rather
  // than as a physical hoop around the planet.
  useFrame(({ camera }) => {
    ring.current?.lookAt(camera.position);
  });

  return (
    <mesh ref={ring} renderOrder={2}>
      <ringGeometry args={[radius * 1.55, radius * 1.575, 96]} />
      <meshBasicMaterial
        // Neutral, not the accent. A selection marker is not a propulsion
        // event, and colouring it flame put the product's one loaded hue on
        // something that had merely been clicked.
        color="#CAC3B7"
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
