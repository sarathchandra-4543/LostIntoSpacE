import * as THREE from 'three';

import { planetTexture, type BodyAppearance } from './planetTexture';

/**
 * Real planetary maps, with the generated surface as the fallback.
 *
 * Seven bodies have an actual mission-derived global mosaic bundled under
 * `public/textures/bodies` — NASA's Blue Marble for Earth, MESSENGER for
 * Mercury, Magellan for Venus, Viking for Mars, Cassini for Jupiter and for
 * Enceladus, New Horizons for Pluto. Those load as the surface, and the
 * difference is immediate: Mars stops being *a* rusty world and becomes *the*
 * one, with Valles Marineris across it.
 *
 * ## Why the rest are still generated
 *
 * Because no clean cylindrical mosaic could be verified for them, and every
 * alternative was worse than generating one. Four separate failure modes came
 * up, and all four shipped something wrong before being caught:
 *
 * - **The wrong body.** A search for a Saturn map returned Jupiter's, ranked
 *   first, and it passed every word filter.
 * - **The wrong kind of map.** Io and Ganymede returned *geologic* maps,
 *   coloured by rock unit rather than by appearance.
 * - **The wrong thing drawn on it.** The Moon's had a coordinate grid and
 *   marker pins across it.
 * - **The wrong projection.** Earth's returned a *cube map* — six square faces
 *   in a cross — and Europa's and Callisto's were multi-panel USGS figure
 *   sheets. Wrapped onto a sphere those render as a gridded ball with a wedge
 *   cut out, which is precisely what was on screen until the fetch script
 *   started checking that a global map is actually 2:1.
 *
 * So the rule is the same one the imagery catalogue already follows: a missing
 * asset falls back to something honestly synthetic, and never to something that
 * misrepresents. `scripts/data/fetch_planet_maps.py` validates the title, the
 * subject and now the aspect ratio, and adds a body the moment a real map for
 * it can be verified.
 *
 * ## Loading
 *
 * Textures load asynchronously and the sphere renders with its generated
 * surface immediately, swapping when the map arrives. A world that pops in
 * three seconds late is worse than one that improves in place.
 */

/**
 * Bodies with a bundled map, and the file extension it was saved with.
 *
 * The extension follows the actual file contents rather than being assumed —
 * Commons serves PNG thumbnails for PNG originals, and a `.jpg` holding PNG
 * bytes is a lie that only happens to work.
 */
const MAPS: Record<string, string> = {
  mercury: 'png',
  venus: 'jpg',
  earth: 'png',
  mars: 'jpg',
  jupiter: 'jpg',
  enceladus: 'jpg',
  pluto: 'jpg',
};

/** Where the maps are served from. */
const BASE = '/textures/bodies';

/** One loader for the whole app, so a shared body loads once. */
const loader = new THREE.TextureLoader();

/** Resolved map textures, by body id. */
const cache = new Map<string, THREE.Texture>();

/** In-flight loads, so two spheres of the same body do not fetch twice. */
const pending = new Map<string, Promise<THREE.Texture | null>>();

/** True if this body has a real photographic map bundled. */
export function hasRealMap(id: string): boolean {
  return id in MAPS;
}

/**
 * Load a body's real map, or resolve null if it has none.
 *
 * Never rejects. A texture that fails to load must degrade to the generated
 * surface, not throw inside a render tree.
 */
export function loadBodyMap(id: string): Promise<THREE.Texture | null> {
  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(id);
  if (inFlight) return inFlight;

  const extension = MAPS[id];
  if (!extension) return Promise.resolve(null);

  const promise = new Promise<THREE.Texture | null>((resolve) => {
    loader.load(
      `${BASE}/${id}.${extension}`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        // Longitude wraps; latitude must not, or the poles smear.
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        cache.set(id, texture);
        pending.delete(id);
        resolve(texture);
      },
      undefined,
      () => {
        // The file is missing or corrupt. The generated surface is still there.
        pending.delete(id);
        resolve(null);
      },
    );
  });

  pending.set(id, promise);
  return promise;
}

/**
 * The surface to draw right now.
 *
 * Returns the generated texture synchronously so a sphere always has something
 * to render, and the real map if it has already loaded.
 */
export function currentTexture(id: string, appearance: BodyAppearance): THREE.Texture {
  return cache.get(id) ?? planetTexture(id, appearance);
}

/** Attribution for the bundled maps, shown wherever they are. */
export const MAP_CREDIT =
  'Surface maps: NASA Goddard SVS, MESSENGER, Magellan, Viking, Cassini and ' +
  'New Horizons mission mosaics. Bodies without a verified map are drawn from ' +
  'their measured colour and albedo.';
