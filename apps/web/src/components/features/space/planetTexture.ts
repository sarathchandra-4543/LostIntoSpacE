import * as THREE from 'three';

/**
 * Planet surfaces, generated rather than downloaded.
 *
 * The 3D views drew every world as a flat-shaded sphere — Earth was a blue
 * ball, Jupiter was a tan ball, and nothing was recognisable. Recognisability
 * matters here more than it would in a game: the whole claim of this product is
 * that these are *real places*, and a viewer who cannot tell Mars from Mercury
 * has no reason to believe the numbers attached to them either.
 *
 * ## Why generated and not photographed
 *
 * A texture atlas of real planetary maps would be tens of megabytes, would need
 * hosting and licence tracking, and would still leave every moon and asteroid
 * without one. These textures are painted at runtime onto a canvas from the
 * *same measured appearance data* the catalogue already carries — base colour,
 * band colours, albedo, atmosphere, surface class. So a body looks the way it
 * does because of what has been measured about it, the palette in the legend
 * and the sphere on screen cannot disagree, and adding a body to the catalogue
 * gives it a surface for free.
 *
 * They are *depictions built from measurements*, not photographs, and nothing
 * in the interface presents them as imagery. Where a real photograph exists,
 * Explore shows that instead.
 *
 * ## Equirectangular, and seeded
 *
 * Each map is a 2:1 equirectangular canvas that Three.js wraps onto a sphere.
 * Every random choice comes from a generator seeded on the body's id, so Mars
 * has the same craters on every load and in every session — a surface that
 * reshuffles on refresh reads as noise, not as a place.
 */

/** What the catalogue knows about how a body looks. */
export interface BodyAppearance {
  readonly base_color: string;
  readonly accent_color?: string | null;
  readonly band_colors?: string[];
  readonly texture: string;
  readonly albedo: number;
  readonly atmosphere_color?: string | null;
  readonly atmosphere_strength: number;
  readonly emissive: boolean;
  readonly axial_tilt_deg?: number;
  readonly ring?: {
    readonly inner_radius_ratio: number;
    readonly outer_radius_ratio: number;
    readonly color: string;
    readonly opacity: number;
    readonly tilt_deg: number;
    readonly gaps?: number[];
  } | null;
}

/** Deterministic PRNG. Same body, same surface, every time. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** A stable numeric seed from a body id. */
export function seedFor(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseHex(hex: string): [number, number, number] {
  const clean = (hex ?? '').replace('#', '');
  if (clean.length !== 6) return [128, 128, 128];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * k);
  const g = Math.round(g1 + (g2 - g1) * k);
  const bl = Math.round(b1 + (b2 - b1) * k);
  return `rgb(${r},${g},${bl})`;
}

/** Lighten (positive) or darken (negative) a colour by a fraction. */
function shade(hex: string, amount: number): string {
  return mix(hex, amount > 0 ? '#ffffff' : '#000000', Math.abs(amount));
}

/** Texture resolution. 1024×512 reads cleanly at any zoom this app reaches. */
const W = 1024;
const H = 512;

/** Cache: a body's surface is generated once per session, not per frame. */
const CACHE = new Map<string, THREE.CanvasTexture>();

/**
 * The surface map for one body.
 *
 * @param id - Catalogue id. Seeds the surface and keys the cache.
 * @param appearance - Measured appearance from the catalogue.
 */
export function planetTexture(id: string, appearance: BodyAppearance): THREE.CanvasTexture {
  const cached = CACHE.get(id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(seedFor(id));

  const base = appearance.base_color ?? '#888888';
  const accent = appearance.accent_color ?? shade(base, -0.25);

  // Ground the whole map, so nothing shows through a gap in a later pass.
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  switch (appearance.texture) {
    case 'banded':
    case 'gaseous':
      paintBands(ctx, rand, base, accent, appearance.band_colors ?? []);
      break;
    case 'cratered':
      paintRegolith(ctx, rand, base, accent);
      paintCraters(ctx, rand, base);
      break;
    case 'oceanic':
      paintOcean(ctx, rand, base, accent);
      break;
    case 'rocky':
      paintRocky(ctx, rand, base, accent);
      break;
    case 'icy':
      paintIce(ctx, rand, base, accent);
      break;
    case 'volcanic':
      paintVolcanic(ctx, rand, base, accent);
      break;
    case 'metallic':
      paintMetallic(ctx, rand, base, accent);
      break;
    case 'stellar':
      paintStellar(ctx, rand, base, accent);
      break;
    case 'diffuse':
    case 'galactic':
    case 'accretion':
      paintDiffuse(ctx, rand, base, accent);
      break;
    case 'irregular':
    case 'engineered':
    default:
      paintRocky(ctx, rand, base, accent);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // The map wraps in longitude and must not in latitude, or the poles smear.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  CACHE.set(id, texture);
  return texture;
}

// ──────────────────────────────────────────────────────────────
// Surface classes
// ──────────────────────────────────────────────────────────────

/**
 * Latitudinal bands, for the giants.
 *
 * Real bands are zonal jets: alternating light zones and dark belts, narrower
 * toward the poles, with turbulent edges where adjacent jets shear against each
 * other. Painting straight stripes gives a beach ball; the shear is what makes
 * it read as an atmosphere.
 */
function paintBands(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
  bandColors: string[],
): void {
  const palette = bandColors.length >= 2 ? bandColors : [shade(base, 0.18), accent, base];
  const count = 22;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const next = (i + 1) / count;
    // Bands compress toward the poles, as they do on a rotating fluid planet.
    const y0 = latitudeToY(t);
    const y1 = latitudeToY(next);

    const colour = palette[i % palette.length]!;
    const jitter = (rand() - 0.5) * 0.22;
    ctx.fillStyle = shade(colour, jitter);
    ctx.fillRect(0, y0, W, y1 - y0 + 1);
  }

  // Shear at the band edges: short horizontal streaks that break the boundary.
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    const y = rand() * H;
    const x = rand() * W;
    const w = 20 + rand() * 130;
    const h = 1 + rand() * 4;
    // Sample-ish: tint from the palette so streaks belong to the band system.
    ctx.fillStyle = shade(palette[Math.floor(rand() * palette.length)]!, (rand() - 0.5) * 0.5);
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A great spot: one long-lived vortex, because the giants all have them.
  const spotY = latitudeToY(0.62);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = shade(accent, -0.2);
  ctx.beginPath();
  ctx.ellipse(W * 0.34, spotY, W * 0.075, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(accent, 0.15);
  ctx.beginPath();
  ctx.ellipse(W * 0.34, spotY, W * 0.05, H * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Map a 0–1 band index onto a y that compresses toward the poles. */
function latitudeToY(t: number): number {
  // sin easing puts more bands near the equator, as on a real giant.
  return (0.5 - Math.sin((0.5 - t) * Math.PI) / 2) * H;
}

/** Fine noise, so a surface is never a flat fill. */
function paintRegolith(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  for (let i = 0; i < 5200; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 1 + rand() * 7;
    ctx.globalAlpha = 0.05 + rand() * 0.16;
    ctx.fillStyle = rand() > 0.5 ? shade(base, 0.16) : shade(accent, -0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Impact craters.
 *
 * Each is a darker floor, a brighter raised rim, and a bright ejecta ray system
 * on the youngest ones. Size follows a power law — a great many small craters
 * and a few large ones, which is what an unweathered airless surface looks like.
 */
function paintCraters(ctx: CanvasRenderingContext2D, rand: () => number, base: string): void {
  const count = 260;
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    // Power law: mostly small.
    const r = 3 + Math.pow(rand(), 3) * 46;

    // Floor.
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = shade(base, -0.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim, lit from one side so the crater reads as a depression.
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = shade(base, 0.3);
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.15, Math.PI * 1.15);
    ctx.stroke();

    // Ray system on the newest few.
    if (r > 26 && rand() > 0.72) {
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = shade(base, 0.45);
      ctx.lineWidth = 1.5;
      const rays = 9 + Math.floor(rand() * 9);
      for (let k = 0; k < rays; k++) {
        const angle = rand() * Math.PI * 2;
        const length = r * (2 + rand() * 4);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * An ocean world with land and weather.
 *
 * Continents are blobs of overlapping circles rather than one shape, which
 * gives them the ragged coastline real landmasses have. Ice caps are painted at
 * the poles because every ocean world in this catalogue has them, and a cloud
 * layer goes on last because it sits above everything.
 */
function paintOcean(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  // Deep ocean, with shallower shelves.
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 400; i++) {
    // Continental shelves are lighter; abyssal plains darker. Both, so the
    // ocean has depth rather than being one flat blue.
    ctx.fillStyle = rand() > 0.45 ? shade(base, 0.22) : shade(base, -0.28);
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 8 + rand() * 60, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Landmasses. Weighted away from the poles, where the caps go.
  const land = accent ?? '#6E8A5A';
  for (let c = 0; c < 9; c++) {
    const cx = rand() * W;
    const cy = H * (0.2 + rand() * 0.6);
    const blobs = 26 + Math.floor(rand() * 34);
    let x = cx;
    let y = cy;
    for (let b = 0; b < blobs; b++) {
      const r = 10 + rand() * 40;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = rand() > 0.75 ? shade(land, 0.16) : shade(land, -0.1 + rand() * 0.2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Random walk, so the coastline wanders rather than staying circular.
      x += (rand() - 0.5) * 90;
      y += (rand() - 0.5) * 62;
      y = Math.max(H * 0.12, Math.min(H * 0.88, y));
    }
  }
  ctx.globalAlpha = 1;

  paintIceCaps(ctx, rand, '#F2F6F8');

  // Cloud deck, banded the way real weather systems are.
  //
  // Deliberately sparse. A denser deck is arguably more realistic — Earth is
  // about two-thirds cloud-covered at any moment — but it buries the
  // continents, and the continents are the reason anyone recognises the planet.
  // This is the one place the depiction is tuned for legibility over average
  // conditions, and it is a small lie about weather rather than about geography.
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 320; i++) {
    const y = rand() * H;
    // Clouds cluster in the tropics and the mid-latitude storm tracks.
    const bias = Math.abs(y / H - 0.5);
    if (rand() < bias * 1.3) continue;
    ctx.beginPath();
    ctx.ellipse(rand() * W, y, 10 + rand() * 46, 3 + rand() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A dry, oxidised, cratered world — Mars and its kind. */
function paintRocky(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  paintRegolith(ctx, rand, base, accent);

  // Broad albedo features: the dark patches that were mapped from Earth long
  // before anything flew there.
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = shade(accent, -0.25);
    ctx.beginPath();
    ctx.ellipse(
      rand() * W,
      H * (0.15 + rand() * 0.7),
      40 + rand() * 150,
      20 + rand() * 60,
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A canyon system and some impact basins.
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = shade(base, -0.4);
  ctx.lineWidth = 7;
  ctx.beginPath();
  let x = W * 0.1;
  const y = H * 0.54;
  ctx.moveTo(x, y);
  for (let i = 0; i < 22; i++) {
    x += W * 0.03;
    ctx.lineTo(x, y + (rand() - 0.5) * 26);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  paintCraters(ctx, rand, base);
  paintIceCaps(ctx, rand, '#EDF2F4');
}

/** Polar caps, sized with a little asymmetry because real ones are not equal. */
function paintIceCaps(ctx: CanvasRenderingContext2D, rand: () => number, colour: string): void {
  for (const [edge, extent] of [
    [0, 0.055 + rand() * 0.04],
    [1, 0.05 + rand() * 0.045],
  ] as const) {
    const height = H * extent;
    const gradient = ctx.createLinearGradient(
      0,
      edge === 0 ? 0 : H,
      0,
      edge === 0 ? height * 1.8 : H - height * 1.8,
    );
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, edge === 0 ? 0 : H - height * 1.8, W, height * 1.8);
  }
}

/** A cracked ice shell — Europa, Enceladus, Triton. */
function paintIce(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  ctx.fillStyle = shade(base, 0.1);
  ctx.fillRect(0, 0, W, H);

  // Linea: long, gently curving fractures that criss-cross the whole shell.
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.45;
    ctx.strokeStyle = rand() > 0.4 ? shade(accent, -0.25) : shade(base, -0.3);
    ctx.lineWidth = 1 + rand() * 5;
    ctx.beginPath();
    let x = rand() * W;
    let y = rand() * H;
    ctx.moveTo(x, y);
    const dx = (rand() - 0.5) * 90;
    const dy = (rand() - 0.5) * 44;
    for (let k = 0; k < 14; k++) {
      x += dx + (rand() - 0.5) * 30;
      y += dy + (rand() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Chaos terrain: patches where the shell has broken up and refrozen.
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = shade(accent, -0.15);
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, 18 + rand() * 60, 14 + rand() * 40, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Sulphur volcanism — Io. */
function paintVolcanic(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  paintRegolith(ctx, rand, base, accent);

  // Volcanic centres, each with a dark vent and a coloured deposit ring.
  for (let i = 0; i < 70; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 10 + rand() * 44;

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shade('#F2D06B', -0.1 + rand() * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = rand() > 0.5 ? '#40260F' : '#7A1F14';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A metal-rich body — Psyche and its kind. */
function paintMetallic(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  paintRegolith(ctx, rand, base, accent);
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = shade(base, 0.4);
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, 3 + rand() * 16, 2 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  paintCraters(ctx, rand, base);
}

/** A star's photosphere: granulation, plus darker active regions. */
function paintStellar(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Convection cells.
  for (let i = 0; i < 5000; i++) {
    ctx.globalAlpha = 0.1 + rand() * 0.28;
    ctx.fillStyle = rand() > 0.5 ? shade(base, 0.32) : shade(accent, -0.12);
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 3 + rand() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunspot groups, in the active latitude bands rather than at the poles.
  for (let i = 0; i < 14; i++) {
    const x = rand() * W;
    const y = H * (0.3 + rand() * 0.4);
    const r = 8 + rand() * 22;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = shade(base, -0.5);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = shade(base, -0.72);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Diffuse emission — a nebula or a galaxy, rendered as a soft cloud. */
function paintDiffuse(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  base: string,
  accent: string,
): void {
  ctx.fillStyle = '#05060A';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    ctx.globalAlpha = 0.02 + rand() * 0.12;
    ctx.fillStyle = rand() > 0.5 ? base : accent;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, 20 + rand() * 130, 14 + rand() * 80, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Release every generated texture. Called when a scene tears down for good. */
export function disposePlanetTextures(): void {
  for (const texture of CACHE.values()) texture.dispose();
  CACHE.clear();
}
