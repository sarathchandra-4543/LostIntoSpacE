import type { BodyAppearance } from './planetTexture';

/**
 * The solar system, as data.
 *
 * Every radius, orbital distance, period and tilt here is a published bulk
 * parameter from NASA's planetary fact sheets and JPL Solar System Dynamics.
 * The appearance fields carry the same measured colours the object catalogue
 * uses, so a body drawn here and the same body drawn in Explore cannot
 * disagree.
 *
 * ## The scale problem, and what is done about it
 *
 * A true-scale solar system is unviewable and that is not a rendering
 * limitation — it is the actual fact about space that most people have never
 * seen made concrete. The Sun is 109 Earths across; Neptune is 30 AU out. Draw
 * both honestly in one frame and either the Sun is a pixel or Neptune is a
 * kilometre off screen.
 *
 * So the view offers two modes and names them:
 *
 * - **Compressed** (default). Orbital *distances* are compressed
 *   logarithmically so every planet is on screen at once, while **radii stay in
 *   exact proportion to one another**. You are looking at a diagram with honest
 *   sizes and dishonest spacing, and the interface says so.
 * - **True scale.** Distances and radii both to scale, from one metre-based
 *   unit. Nothing is faked; most things are invisible without flying to them.
 *   This is the mode that teaches the thing the diagram cannot.
 *
 * Bodies are never scaled *relative to each other* in either mode. The
 * compression applies to orbital radius alone.
 */

/** Astronomical unit. Unit: m */
export const AU = 149_597_870_700;

/** One body in the system. */
export interface SystemBody {
  readonly id: string;
  readonly name: string;
  /** What it orbits. Null for the Sun. */
  readonly parent: string | null;
  readonly kind: 'star' | 'planet' | 'dwarf_planet' | 'moon';
  /** Mean radius. Unit: m */
  readonly radius_m: number;
  /** Semi-major axis about its parent. Unit: m. Zero for the Sun. */
  readonly orbitRadius_m: number;
  /** Orbital period about its parent. Unit: days. Zero for the Sun. */
  readonly orbitPeriod_d: number;
  /** Orbital inclination to the ecliptic. Unit: degrees */
  readonly inclination_deg: number;
  /** Sidereal rotation period. Negative is retrograde. Unit: hours */
  readonly rotationPeriod_h: number;
  /** Axial tilt. Unit: degrees */
  readonly axialTilt_deg: number;
  /** One line, for the label panel. */
  readonly tagline: string;
  readonly appearance: BodyAppearance;
}

const noRing = null;

export const SYSTEM_BODIES: readonly SystemBody[] = [
  {
    id: 'sol',
    name: 'The Sun',
    parent: null,
    kind: 'star',
    radius_m: 695_700_000,
    orbitRadius_m: 0,
    orbitPeriod_d: 0,
    inclination_deg: 0,
    rotationPeriod_h: 609.12,
    axialTilt_deg: 7.25,
    tagline: '99.86% of the mass of the solar system.',
    appearance: {
      base_color: '#FFCF87',
      accent_color: '#FF9A3C',
      texture: 'stellar',
      albedo: 1,
      atmosphere_color: '#FFB454',
      atmosphere_strength: 1,
      emissive: true,
      axial_tilt_deg: 7.25,
      ring: noRing,
    },
  },
  {
    id: 'mercury',
    name: 'Mercury',
    parent: 'sol',
    kind: 'planet',
    radius_m: 2_439_700,
    orbitRadius_m: 57.909e9,
    orbitPeriod_d: 87.969,
    inclination_deg: 7.005,
    rotationPeriod_h: 1407.6,
    axialTilt_deg: 0.034,
    tagline: 'Airless, cratered, and 430 °C in the sun.',
    appearance: {
      base_color: '#8C8177',
      accent_color: '#57504A',
      texture: 'cratered',
      albedo: 0.142,
      atmosphere_strength: 0,
      emissive: false,
      axial_tilt_deg: 0.034,
      ring: noRing,
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    parent: 'sol',
    kind: 'planet',
    radius_m: 6_051_800,
    orbitRadius_m: 108.21e9,
    orbitPeriod_d: 224.701,
    inclination_deg: 3.395,
    rotationPeriod_h: -5832.6,
    axialTilt_deg: 177.36,
    tagline: '92 atmospheres of CO₂ at 737 K.',
    appearance: {
      base_color: '#D8B26B',
      accent_color: '#B08D45',
      band_colors: ['#E4C687', '#D8B26B', '#C4A05C'],
      texture: 'banded',
      albedo: 0.689,
      atmosphere_color: '#F0D9A0',
      atmosphere_strength: 0.95,
      emissive: false,
      axial_tilt_deg: 177.36,
      ring: noRing,
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    parent: 'sol',
    kind: 'planet',
    radius_m: 6_371_000,
    orbitRadius_m: 149.598e9,
    orbitPeriod_d: 365.256,
    inclination_deg: 0,
    rotationPeriod_h: 23.9345,
    axialTilt_deg: 23.44,
    tagline: 'The only place known to have life.',
    appearance: {
      base_color: '#1F4E79',
      accent_color: '#5E7F4A',
      texture: 'oceanic',
      albedo: 0.306,
      atmosphere_color: '#7FB4E0',
      atmosphere_strength: 0.75,
      emissive: false,
      axial_tilt_deg: 23.44,
      ring: noRing,
    },
  },
  {
    id: 'luna',
    name: 'The Moon',
    parent: 'earth',
    kind: 'moon',
    radius_m: 1_737_400,
    orbitRadius_m: 384_400_000,
    orbitPeriod_d: 27.322,
    inclination_deg: 5.145,
    rotationPeriod_h: 655.72,
    axialTilt_deg: 6.68,
    tagline: 'The only other world anyone has stood on.',
    appearance: {
      base_color: '#B5AFA3',
      accent_color: '#77706A',
      texture: 'cratered',
      albedo: 0.136,
      atmosphere_strength: 0,
      emissive: false,
      axial_tilt_deg: 6.68,
      ring: noRing,
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    parent: 'sol',
    kind: 'planet',
    radius_m: 3_389_500,
    orbitRadius_m: 227.956e9,
    orbitPeriod_d: 686.98,
    inclination_deg: 1.848,
    rotationPeriod_h: 24.6229,
    axialTilt_deg: 25.19,
    tagline: 'Iron oxide, polar caps, and a 6 mbar sky.',
    appearance: {
      base_color: '#B4552F',
      accent_color: '#7A3520',
      texture: 'rocky',
      albedo: 0.25,
      atmosphere_color: '#D08A62',
      atmosphere_strength: 0.22,
      emissive: false,
      axial_tilt_deg: 25.19,
      ring: noRing,
    },
  },
  {
    id: 'phobos',
    name: 'Phobos',
    parent: 'mars',
    kind: 'moon',
    radius_m: 11_267,
    orbitRadius_m: 9_376_000,
    orbitPeriod_d: 0.3189,
    inclination_deg: 1.093,
    rotationPeriod_h: 7.65,
    axialTilt_deg: 0,
    tagline: 'Orbits faster than Mars rotates, and is falling.',
    appearance: {
      base_color: '#6E655C',
      accent_color: '#4A433C',
      texture: 'irregular',
      albedo: 0.071,
      atmosphere_strength: 0,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'ceres',
    name: 'Ceres',
    parent: 'sol',
    kind: 'dwarf_planet',
    radius_m: 469_700,
    orbitRadius_m: 413.7e9,
    orbitPeriod_d: 1681.63,
    inclination_deg: 10.59,
    rotationPeriod_h: 9.074,
    axialTilt_deg: 4,
    tagline: 'The largest object in the asteroid belt.',
    appearance: {
      base_color: '#77706A',
      accent_color: '#4C4744',
      texture: 'cratered',
      albedo: 0.09,
      atmosphere_strength: 0,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    parent: 'sol',
    kind: 'planet',
    radius_m: 69_911_000,
    orbitRadius_m: 778.479e9,
    orbitPeriod_d: 4332.589,
    inclination_deg: 1.304,
    rotationPeriod_h: 9.925,
    axialTilt_deg: 3.13,
    tagline: 'Two and a half times the mass of every other planet combined.',
    appearance: {
      base_color: '#C8956B',
      accent_color: '#9A5F3C',
      band_colors: ['#E0C4A0', '#B07A4E', '#D8B48E', '#8A5636', '#CBA278'],
      texture: 'banded',
      albedo: 0.538,
      atmosphere_color: '#E8C9A4',
      atmosphere_strength: 0.6,
      emissive: false,
      axial_tilt_deg: 3.13,
      ring: noRing,
    },
  },
  {
    id: 'io',
    name: 'Io',
    parent: 'jupiter',
    kind: 'moon',
    radius_m: 1_821_600,
    orbitRadius_m: 421_800_000,
    orbitPeriod_d: 1.769,
    inclination_deg: 0.05,
    rotationPeriod_h: 42.46,
    axialTilt_deg: 0,
    tagline: 'The most volcanically active body in the solar system.',
    appearance: {
      base_color: '#D8C36B',
      accent_color: '#A8721F',
      texture: 'volcanic',
      albedo: 0.63,
      atmosphere_strength: 0,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'europa',
    name: 'Europa',
    parent: 'jupiter',
    kind: 'moon',
    radius_m: 1_560_800,
    orbitRadius_m: 671_100_000,
    orbitPeriod_d: 3.551,
    inclination_deg: 0.47,
    rotationPeriod_h: 85.22,
    axialTilt_deg: 0.1,
    tagline: 'More liquid water than Earth, under an ice shell.',
    appearance: {
      base_color: '#C6B79E',
      accent_color: '#8A6E52',
      texture: 'icy',
      albedo: 0.67,
      atmosphere_strength: 0,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    parent: 'jupiter',
    kind: 'moon',
    radius_m: 2_634_100,
    orbitRadius_m: 1_070_400_000,
    orbitPeriod_d: 7.155,
    inclination_deg: 0.2,
    rotationPeriod_h: 171.7,
    axialTilt_deg: 0,
    tagline: 'The largest moon in the solar system — bigger than Mercury.',
    appearance: {
      base_color: '#9A9086',
      accent_color: '#6B625A',
      texture: 'icy',
      albedo: 0.43,
      atmosphere_strength: 0,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'callisto',
    name: 'Callisto',
    parent: 'jupiter',
    kind: 'moon',
    radius_m: 2_410_300,
    orbitRadius_m: 1_882_700_000,
    orbitPeriod_d: 16.689,
    inclination_deg: 0.19,
    rotationPeriod_h: 400.5,
    axialTilt_deg: 0,
    tagline: 'The most heavily cratered object known.',
    appearance: {
      base_color: '#6E655E',
      accent_color: '#48423C',
      texture: 'cratered',
      albedo: 0.22,
      atmosphere_strength: 0,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    parent: 'sol',
    kind: 'planet',
    radius_m: 58_232_000,
    orbitRadius_m: 1432.041e9,
    orbitPeriod_d: 10_759.22,
    inclination_deg: 2.485,
    rotationPeriod_h: 10.656,
    axialTilt_deg: 26.73,
    tagline: 'Less dense than water, and wearing the finest rings there are.',
    appearance: {
      base_color: '#D5BD8B',
      accent_color: '#A8905C',
      band_colors: ['#E8D5A8', '#D5BD8B', '#C0A46E', '#CBB27E'],
      texture: 'banded',
      albedo: 0.499,
      atmosphere_color: '#EEDDB4',
      atmosphere_strength: 0.55,
      emissive: false,
      axial_tilt_deg: 26.73,
      ring: {
        inner_radius_ratio: 1.24,
        outer_radius_ratio: 2.27,
        color: '#CDBE9A',
        opacity: 0.7,
        tilt_deg: 26.73,
        gaps: [1.95],
      },
    },
  },
  {
    id: 'titan',
    name: 'Titan',
    parent: 'saturn',
    kind: 'moon',
    radius_m: 2_574_700,
    orbitRadius_m: 1_221_870_000,
    orbitPeriod_d: 15.945,
    inclination_deg: 0.35,
    rotationPeriod_h: 382.68,
    axialTilt_deg: 0.3,
    tagline: 'A thicker atmosphere than Earth, over methane lakes.',
    appearance: {
      base_color: '#D98E3D',
      accent_color: '#8A5622',
      band_colors: ['#E6A455', '#D98E3D', '#B5762F'],
      texture: 'banded',
      albedo: 0.22,
      atmosphere_color: '#F0B268',
      atmosphere_strength: 0.9,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    parent: 'saturn',
    kind: 'moon',
    radius_m: 252_100,
    orbitRadius_m: 237_948_000,
    orbitPeriod_d: 1.37,
    inclination_deg: 0.009,
    rotationPeriod_h: 32.9,
    axialTilt_deg: 0,
    tagline: 'Venting water from a subsurface ocean into space.',
    appearance: {
      base_color: '#E4EAEC',
      accent_color: '#A8B8C0',
      texture: 'icy',
      albedo: 0.81,
      atmosphere_strength: 0.05,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    parent: 'sol',
    kind: 'planet',
    radius_m: 25_362_000,
    orbitRadius_m: 2867.043e9,
    orbitPeriod_d: 30_688.5,
    inclination_deg: 0.77,
    rotationPeriod_h: -17.24,
    axialTilt_deg: 97.77,
    tagline: 'Tipped on its side, and orbiting that way.',
    appearance: {
      base_color: '#7FA8A6',
      accent_color: '#5E8785',
      band_colors: ['#94BDBB', '#7FA8A6', '#6E9997'],
      texture: 'banded',
      albedo: 0.488,
      atmosphere_color: '#A6D0CE',
      atmosphere_strength: 0.6,
      emissive: false,
      axial_tilt_deg: 97.77,
      ring: {
        inner_radius_ratio: 1.64,
        outer_radius_ratio: 2.0,
        color: '#6E8A8A',
        opacity: 0.28,
        tilt_deg: 97.77,
      },
    },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    parent: 'sol',
    kind: 'planet',
    radius_m: 24_622_000,
    orbitRadius_m: 4514.953e9,
    orbitPeriod_d: 60_195,
    inclination_deg: 1.77,
    rotationPeriod_h: 16.11,
    axialTilt_deg: 28.32,
    tagline: 'The fastest winds of any planet, at 2,100 km/h.',
    appearance: {
      base_color: '#3B5FA8',
      accent_color: '#27407A',
      band_colors: ['#4C74C0', '#3B5FA8', '#2E4E92'],
      texture: 'banded',
      albedo: 0.442,
      atmosphere_color: '#6E92D8',
      atmosphere_strength: 0.62,
      emissive: false,
      axial_tilt_deg: 28.32,
      ring: noRing,
    },
  },
  {
    id: 'triton',
    name: 'Triton',
    parent: 'neptune',
    kind: 'moon',
    radius_m: 1_353_400,
    orbitRadius_m: 354_759_000,
    orbitPeriod_d: -5.877,
    inclination_deg: 157,
    rotationPeriod_h: 141.04,
    axialTilt_deg: 0,
    tagline: 'Orbits backwards — it was captured, not formed there.',
    appearance: {
      base_color: '#C4BEB8',
      accent_color: '#8E8880',
      texture: 'icy',
      albedo: 0.76,
      atmosphere_strength: 0.05,
      emissive: false,
      ring: noRing,
    },
  },
  {
    id: 'pluto',
    name: 'Pluto',
    parent: 'sol',
    kind: 'dwarf_planet',
    radius_m: 1_188_300,
    orbitRadius_m: 5906.38e9,
    orbitPeriod_d: 90_560,
    inclination_deg: 17.16,
    rotationPeriod_h: -153.29,
    axialTilt_deg: 122.53,
    tagline: 'Nitrogen glaciers, 5.9 billion km out.',
    appearance: {
      base_color: '#A08D7C',
      accent_color: '#6E5F52',
      texture: 'icy',
      albedo: 0.52,
      atmosphere_strength: 0.08,
      emissive: false,
      ring: noRing,
    },
  },
];

/** Bodies by id. */
export const BODIES_BY_ID: ReadonlyMap<string, SystemBody> = new Map(
  SYSTEM_BODIES.map((b) => [b.id, b]),
);

/** The planets and dwarf planets that orbit the Sun, in order. */
export const PLANETS = SYSTEM_BODIES.filter((b) => b.parent === 'sol');

/** Moons of a given body. */
export function moonsOf(parentId: string): SystemBody[] {
  return SYSTEM_BODIES.filter((b) => b.parent === parentId);
}

/**
 * Map a destination id onto the body it corresponds to.
 *
 * The destination catalogue and the system body table are separate on purpose —
 * one is about *going somewhere*, the other about *drawing it* — but the ids
 * mostly coincide, and where they do not the difference is spelled out here
 * rather than guessed at by string munging.
 */
export function bodyForDestination(destinationId: string): SystemBody | null {
  const direct = BODIES_BY_ID.get(destinationId);
  if (direct) return direct;

  const aliases: Record<string, string> = {
    // An Earth orbit is not a body; the thing you are looking at is Earth.
    leo: 'earth',
    gto: 'earth',
  };
  const aliased = aliases[destinationId];
  return aliased ? (BODIES_BY_ID.get(aliased) ?? null) : null;
}

// ──────────────────────────────────────────────────────────────
// Scale
// ──────────────────────────────────────────────────────────────

/** How the view maps metres onto scene units. */
export type ScaleMode = 'compressed' | 'true';

/**
 * Scene units per metre for *radii*.
 *
 * Applied to every body without exception in both modes, so the size of one
 * world against another is always honest — Jupiter is exactly eleven Earths
 * across here because it is eleven Earths across. One scene unit is 1,000 km,
 * which puts Earth at 6.4 units and the Sun at 696.
 */
export const RADIUS_SCALE = 1 / 1_000_000;

/**
 * Orbital radius in scene units.
 *
 * True mode uses the same linear scale as the radii, so the picture is
 * internally consistent and almost entirely empty.
 *
 * Diagram mode compresses distance by a square root. A logarithm was tried
 * first and squashed the whole system into a ratio of under two between
 * Mercury and Neptune, which destroys the very thing the view is for — the
 * sense that the outer system is *far*. A square root keeps Neptune about nine
 * times further out than Mercury (against thirty in reality), which reads as a
 * real gradient while still fitting in one frame.
 */
export function orbitRadiusToScene(orbitRadius_m: number, mode: ScaleMode): number {
  if (orbitRadius_m <= 0) return 0;
  if (mode === 'true') return orbitRadius_m * RADIUS_SCALE;
  const millionsKm = orbitRadius_m / 1e9;
  return Math.sqrt(millionsKm) * 2000;
}

/**
 * How much bodies are enlarged in diagram mode.
 *
 * At honest size against compressed distances every planet is a sub-pixel dot,
 * which is *true* and is what true-scale mode is for, but useless as a diagram.
 * This magnifies every body by the same factor, so the proportion between any
 * two of them is untouched and only the size-against-distance relationship is
 * exaggerated. That is the one distortion this view makes, and the caption
 * says so.
 *
 * The ceiling on this number is the Sun. It is 83 times smaller than Mercury's
 * orbital radius, and the square-root distance compression eats into that
 * margin, so magnifying much past six puts Mercury *inside* the Sun — the
 * distortion stops being a readable exaggeration and becomes a false picture.
 * Six keeps every body outside its primary while making the planets large
 * enough to find, and the camera does the rest: click a body to fly to it.
 */
export const DIAGRAM_BODY_MAGNIFICATION = 6;

/**
 * Drawn radius in scene units.
 *
 * The floor exists so a small moon stays selectable at system-wide zoom, and it
 * is capped against the body's own primary. Without that cap, Phobos — eleven
 * kilometres across — was lifted to the same floor as everything else and drew
 * *larger than Mars*, which is a far worse lie than being too small to see.
 *
 * With the cap, a moon can never exceed 40% of its parent's drawn radius, so
 * the floor only ever rescues something genuinely invisible and never inverts a
 * size relationship. Bodies above the floor keep exact proportion.
 */
export function bodyRadiusToScene(
  radius_m: number,
  mode: ScaleMode,
  parentRadius_m?: number,
): number {
  const trueRadius = radius_m * RADIUS_SCALE;
  if (mode === 'true') return trueRadius;

  const magnified = trueRadius * DIAGRAM_BODY_MAGNIFICATION;
  const ceiling =
    parentRadius_m && parentRadius_m > 0
      ? parentRadius_m * RADIUS_SCALE * DIAGRAM_BODY_MAGNIFICATION * 0.4
      : Number.POSITIVE_INFINITY;

  return Math.min(Math.max(magnified, 12), Math.max(magnified, ceiling));
}

/**
 * How far out the whole system reaches, in scene units.
 *
 * Used to frame the default camera so the view opens on the system rather than
 * inside the Sun.
 */
export function systemExtent(mode: ScaleMode): number {
  return Math.max(
    ...SYSTEM_BODIES.filter((b) => b.parent === 'sol').map((b) =>
      orbitRadiusToScene(b.orbitRadius_m, mode),
    ),
  );
}
