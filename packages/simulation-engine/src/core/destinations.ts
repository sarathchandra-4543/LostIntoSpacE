/**
 * Mission destinations — where a vehicle is actually trying to go.
 *
 * Until now a flight had a *target altitude* and nothing else, which made every
 * mission the same mission at a different number. A destination is the thing
 * that gives a launch its constraints: how much Δv the trip costs, how long the
 * cruise lasts, whether the propellant you chose will still be in the tank when
 * you arrive, whether there is air to brake in, how hard the arrival gravity
 * pulls, and how often the geometry even allows you to leave.
 *
 * ## Everything here is a published bulk parameter
 *
 * Radii, masses, rotation periods, orbital elements, surface pressures and
 * temperatures come from NASA's planetary fact sheets and JPL Solar System
 * Dynamics, quoted to the precision the reference gives them. Δv figures are
 * the standard mission-design budget values and they are *estimates for a
 * reference trajectory*, not the output of a trajectory optimiser. They are
 * labelled as such everywhere they surface.
 *
 * ## What is derived rather than stored
 *
 * Anything that follows from something else is computed, not typed in again:
 * μ from mass, surface gravity from μ and radius, escape velocity from both,
 * solar constant from the heliocentric distance. Storing a derived value
 * invites it to disagree with its own inputs.
 *
 * @module core/destinations
 */

// AU and the Sun's gravitational parameter belong to the transfer solver that
// uses them most; re-declaring them here would let two copies drift apart.
import { AU_M } from '../physics/transfer.js';

/** Newtonian constant of gravitation. CODATA 2018. Unit: m³/(kg·s²) */
export const G_NEWTON = 6.674_30e-11;

/** Solar irradiance at 1 AU. Unit: W/m² */
export const SOLAR_CONSTANT_1AU = 1361;

/** Speed of light in vacuum, exact by definition. Unit: m/s */
export const C_LIGHT = 299_792_458;

/** Standard gravitational parameter of Earth (EGM96). Unit: m³/s² */
export const MU_EARTH_SI = 3.986_004_418e14;

/** Earth's mean radius. Unit: m */
export const EARTH_RADIUS_M = 6_371_000;

/** Earth's sidereal orbital period. Unit: s */
export const EARTH_YEAR_S = 365.256_363_004 * 86_400;

/** What kind of place this is. Drives how arrival is modelled. */
export type DestinationKind =
  | 'earth_orbit'
  | 'moon'
  | 'planet'
  | 'dwarf_planet'
  | 'natural_satellite'
  | 'star';

/** Which body the destination orbits, and therefore which transfer applies. */
export type PrimaryBody = 'earth' | 'sun' | 'jupiter' | 'saturn';

/**
 * How you can arrive.
 *
 * The distinction matters more than any other single fact about a destination,
 * because it decides whether the arrival is paid for in propellant or in heat
 * shield. Mars has enough atmosphere to brake in but not enough to land on
 * without help, which is why it gets its own category.
 */
export type ArrivalMode =
  /** No atmosphere. Every metre per second of arrival is paid for by an engine. */
  | 'propulsive'
  /** Enough atmosphere to capture and land aerodynamically. */
  | 'aerodynamic'
  /** Enough to brake in, not enough to land on. Entry, then powered descent. */
  | 'assisted_entry'
  /** Nothing to land on. A flyby or an orbit is the mission. */
  | 'orbit_only';

/** One leg of the Δv budget, with the reason it costs what it costs. */
export interface DeltaVLeg {
  readonly id: string;
  readonly label: string;
  /** Unit: m/s */
  readonly deltaV_ms: number;
  /** Why this leg costs this much, in one sentence. */
  readonly note: string;
  /** True when a heat shield can pay for this leg instead of propellant. */
  readonly aerobrakeable?: boolean;
}

/** The atmosphere at the destination, where there is one worth the name. */
export interface DestinationAtmosphere {
  /** Surface (or 1-bar reference level) pressure. Unit: Pa */
  readonly surfacePressure_Pa: number;
  /** Surface density. Unit: kg/m³ */
  readonly surfaceDensity_kgm3: number;
  /** Pressure scale height near the surface. Unit: m */
  readonly scaleHeight_m: number;
  /** Principal constituents, most abundant first. */
  readonly composition: string;
  /** Typical near-surface wind. Unit: m/s */
  readonly windSpeed_ms: number;
  /** The strongest winds anywhere in the atmosphere. Unit: m/s */
  readonly maxWindSpeed_ms: number;
  /** What that wind is, in one phrase. */
  readonly windNote: string;
}

/** A destination: a real place, with the numbers that constrain going there. */
export interface Destination {
  readonly id: string;
  readonly name: string;
  readonly kind: DestinationKind;
  readonly primary: PrimaryBody;
  /** One line on why anyone goes. */
  readonly tagline: string;
  /** The engineering problem this destination sets, in a short paragraph. */
  readonly challenge: string;

  // ── Physical ──────────────────────────────────────────────
  /** Mean radius. Unit: m. Zero for a point destination such as an orbit. */
  readonly radius_m: number;
  /** Mass. Unit: kg. Zero for a point destination. */
  readonly mass_kg: number;
  /** Sidereal rotation period. Negative means retrograde. Unit: s */
  readonly rotationPeriod_s: number;
  /** Axial tilt to the orbital plane. Unit: degrees */
  readonly axialTilt_deg: number;

  // ── Orbit about the primary ───────────────────────────────
  /** Semi-major axis about the primary. Unit: m */
  readonly semiMajorAxis_m: number;
  /** Orbital eccentricity. */
  readonly eccentricity: number;
  /** Orbital inclination to the primary's reference plane. Unit: degrees */
  readonly inclination_deg: number;
  /** Sidereal orbital period about the primary. Unit: s */
  readonly orbitalPeriod_s: number;

  // ── Distance from Earth ───────────────────────────────────
  /** Closest approach to Earth. Unit: m */
  readonly minDistanceFromEarth_m: number;
  /** Mean distance from Earth. Unit: m */
  readonly meanDistanceFromEarth_m: number;
  /** Greatest separation from Earth. Unit: m */
  readonly maxDistanceFromEarth_m: number;

  // ── Environment ───────────────────────────────────────────
  /** Mean surface or reference-level temperature. Unit: K */
  readonly meanTemperature_K: number;
  /** Coldest recorded or modelled temperature. Unit: K */
  readonly minTemperature_K: number;
  /** Hottest recorded or modelled temperature. Unit: K */
  readonly maxTemperature_K: number;
  /** The atmosphere, or null where there is effectively none. */
  readonly atmosphere: DestinationAtmosphere | null;
  /** Surface radiation dose rate, where it is a design driver. Unit: mSv/day */
  readonly surfaceRadiation_mSv_day: number | null;

  // ── Mission design ────────────────────────────────────────
  /** How you can arrive. */
  readonly arrival: ArrivalMode;
  /** The Δv budget, leg by leg, from a 200 km circular parking orbit. */
  readonly deltaVBudget: readonly DeltaVLeg[];
  /** Altitude of the Earth parking orbit the ascent should target. Unit: m */
  readonly parkingOrbitAltitude_m: number;
  /** Reference one-way cruise time for the trajectory the budget assumes. Unit: s */
  readonly transferTime_s: number;
  /**
   * Mean interval between departure opportunities. Unit: s.
   *
   * For a heliocentric target this is the synodic period with Earth — how often
   * the two planets return to the same relative geometry. For an Earth-orbit or
   * lunar target the geometry is available continually and this is zero.
   */
  readonly launchWindowInterval_s: number;

  // ── Rendering and identity ────────────────────────────────
  /** Visible-light colour. Used by the renderer and the picker alike. */
  readonly color: string;
  /** Secondary colour, for bands, haze or terminator shading. */
  readonly accentColor: string;
  /** Catalogue object id, where this destination is also a catalogue entry. */
  readonly catalogId: string | null;
  /** Missions that have actually gone. Real flights only. */
  readonly precedents: readonly string[];
}

// ──────────────────────────────────────────────────────────────
// Derived quantities
// ──────────────────────────────────────────────────────────────

/** Standard gravitational parameter, μ = G·M. Unit: m³/s² */
export function gravitationalParameter(destination: Destination): number {
  return G_NEWTON * destination.mass_kg;
}

/** Surface gravity, g = μ/r². Unit: m/s² */
export function surfaceGravity(destination: Destination): number {
  if (destination.radius_m <= 0) return 0;
  return gravitationalParameter(destination) / (destination.radius_m * destination.radius_m);
}

/** Escape velocity from the surface, v = √(2μ/r). Unit: m/s */
export function escapeVelocity(destination: Destination): number {
  if (destination.radius_m <= 0) return 0;
  return Math.sqrt((2 * gravitationalParameter(destination)) / destination.radius_m);
}

/** Speed of a circular orbit just above the surface. Unit: m/s */
export function surfaceOrbitalVelocity(destination: Destination): number {
  if (destination.radius_m <= 0) return 0;
  return Math.sqrt(gravitationalParameter(destination) / destination.radius_m);
}

/** Mean bulk density. Unit: kg/m³ */
export function meanDensity(destination: Destination): number {
  if (destination.radius_m <= 0) return 0;
  const volume = (4 / 3) * Math.PI * destination.radius_m ** 3;
  return destination.mass_kg / volume;
}

/** Radius as a multiple of Earth's — the comparison people actually hold. */
export function earthRadiusRatio(destination: Destination): number {
  return destination.radius_m / EARTH_RADIUS_M;
}

/** Surface gravity as a multiple of Earth's. */
export function earthGravityRatio(destination: Destination): number {
  return surfaceGravity(destination) / 9.80665;
}

/** Heliocentric semi-major axis of each primary, for irradiance and transfers. */
const HELIOCENTRIC_DISTANCE: Record<PrimaryBody, number> = {
  earth: AU_M,
  sun: AU_M,
  jupiter: 778.479e9,
  saturn: 1432.041e9,
};

/**
 * Heliocentric distance of a destination. Unit: m
 *
 * A moon is at its planet's distance from the Sun — Europa and Jupiter get the
 * same sunlight, and the same transfer from Earth.
 */
export function heliocentricDistance(destination: Destination): number {
  if (destination.primary === 'sun' && destination.semiMajorAxis_m > 0) {
    return destination.semiMajorAxis_m;
  }
  return HELIOCENTRIC_DISTANCE[destination.primary];
}

/**
 * Solar irradiance at the destination. Unit: W/m²
 *
 * Falls as the inverse square, which is why a Jupiter mission runs on plutonium
 * and a Venus mission runs on a solar array a quarter the size of Earth's.
 */
export function solarConstant(destination: Destination): number {
  const au = heliocentricDistance(destination) / AU_M;
  if (au <= 0) return SOLAR_CONSTANT_1AU;
  return SOLAR_CONSTANT_1AU / (au * au);
}

/**
 * One-way light time at mean distance. Unit: s
 *
 * The number that decides whether a vehicle can be flown or only commanded. At
 * Mars this is between three and twenty-two minutes each way, which is why
 * entry, descent and landing has to be entirely autonomous.
 */
export function lightTime_s(destination: Destination): number {
  return destination.meanDistanceFromEarth_m / C_LIGHT;
}

/** Total Δv from a 200 km parking orbit, summing every leg. Unit: m/s */
export function totalDeltaV(destination: Destination): number {
  return destination.deltaVBudget.reduce((sum, leg) => sum + leg.deltaV_ms, 0);
}

/**
 * Δv from parking orbit if every aerobrakeable leg is flown on a heat shield.
 *
 * The gap between this and {@link totalDeltaV} is the single largest lever in
 * interplanetary mission design: at Mars it is about 2 km/s, which is the
 * difference between a vehicle that fits on an existing launcher and one that
 * does not. Unit: m/s
 */
export function aerobrakedDeltaV(destination: Destination): number {
  return destination.deltaVBudget.reduce(
    (sum, leg) => sum + (leg.aerobrakeable ? 0 : leg.deltaV_ms),
    0,
  );
}

/**
 * Δv to put the vehicle in the parking orbit the destination needs.
 *
 * Roughly circular orbital speed plus a flat allowance for gravity, drag and
 * steering losses. The allowance is 1,800 m/s, the middle of the real range for
 * an ascent to low Earth orbit. Unit: m/s
 */
export function ascentDeltaV(destination: Destination): number {
  const radius = EARTH_RADIUS_M + destination.parkingOrbitAltitude_m;
  return Math.sqrt(MU_EARTH_SI / radius) + 1800;
}

/** Δv for the whole mission: ascent to parking orbit, then every onward leg. */
export function missionDeltaV(destination: Destination, aerobrake = false): number {
  return (
    ascentDeltaV(destination) +
    (aerobrake ? aerobrakedDeltaV(destination) : totalDeltaV(destination))
  );
}

// ──────────────────────────────────────────────────────────────
// The catalogue
// ──────────────────────────────────────────────────────────────

/** Vacuum, near enough. Used where a body's exosphere is not a design factor. */
const NO_ATMOSPHERE = null;

const DAY = 86_400;
const HOUR = 3_600;

export const DESTINATIONS: readonly Destination[] = [
  // ── Earth orbit ───────────────────────────────────────────
  {
    id: 'leo',
    name: 'Low Earth orbit',
    kind: 'earth_orbit',
    primary: 'earth',
    tagline: 'Four hundred kilometres up, and still inside the top of the atmosphere.',
    challenge:
      'Getting to orbit is almost entirely a horizontal problem. Four hundred kilometres of ' +
      'altitude costs under 2 km/s; the 7.7 km/s of sideways speed needed to stay there is the ' +
      'whole of the rest. A vehicle that goes straight up and comes straight back down has done ' +
      'the easy tenth of the work.',
    radius_m: 0,
    mass_kg: 0,
    rotationPeriod_s: 0,
    axialTilt_deg: 0,
    semiMajorAxis_m: EARTH_RADIUS_M + 400_000,
    eccentricity: 0.0003,
    inclination_deg: 51.6,
    orbitalPeriod_s: 92.68 * 60,
    minDistanceFromEarth_m: 400_000,
    meanDistanceFromEarth_m: 400_000,
    maxDistanceFromEarth_m: 400_000,
    meanTemperature_K: 290,
    minTemperature_K: 173,
    maxTemperature_K: 393,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: 0.5,
    arrival: 'orbit_only',
    deltaVBudget: [
      {
        id: 'circularise',
        label: 'Circularise at altitude',
        deltaV_ms: 120,
        note: 'Raising perigee out of the atmosphere once apogee is reached.',
      },
    ],
    parkingOrbitAltitude_m: 400_000,
    transferTime_s: 9 * 60,
    launchWindowInterval_s: 0,
    color: '#4E7C8E',
    accentColor: '#7FA8B8',
    catalogId: 'earth',
    precedents: ['Vostok 1 (1961)', 'International Space Station', 'Gaganyaan (ISRO, crewed, in development)'],
  },
  {
    id: 'gto',
    name: 'Geostationary transfer orbit',
    kind: 'earth_orbit',
    primary: 'earth',
    tagline: 'The workhorse commercial orbit: an ellipse that reaches 35,786 km.',
    challenge:
      'A launcher rarely delivers a satellite to geostationary orbit directly. It delivers it to ' +
      'an ellipse whose apogee is at geostationary altitude and lets the satellite circularise ' +
      'itself. Launch latitude bites hard here: the plane change to reach an equatorial orbit is ' +
      'paid at apogee, and it costs less the closer to the equator you left from.',
    radius_m: 0,
    mass_kg: 0,
    rotationPeriod_s: 0,
    axialTilt_deg: 0,
    semiMajorAxis_m: 24_400_000,
    eccentricity: 0.73,
    inclination_deg: 6,
    orbitalPeriod_s: 10.5 * HOUR,
    minDistanceFromEarth_m: 185_000,
    meanDistanceFromEarth_m: 35_786_000,
    maxDistanceFromEarth_m: 35_786_000,
    meanTemperature_K: 290,
    minTemperature_K: 100,
    maxTemperature_K: 400,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: 2.5,
    arrival: 'orbit_only',
    deltaVBudget: [
      {
        id: 'gto-injection',
        label: 'Transfer injection',
        deltaV_ms: 2440,
        note: 'Raising apogee from 200 km to geostationary altitude.',
      },
      {
        id: 'geo-circularise',
        label: 'Apogee circularisation',
        deltaV_ms: 1470,
        note: 'Raising perigee to meet apogee, and removing the residual inclination.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 5.25 * HOUR,
    launchWindowInterval_s: 0,
    color: '#7FA8B8',
    accentColor: '#A6C9D6',
    catalogId: 'earth',
    precedents: ['Intelsat I (1965)', 'INSAT series (ISRO)', 'GSAT series (ISRO, on GSLV/LVM3)'],
  },

  // ── The Moon ──────────────────────────────────────────────
  {
    id: 'luna',
    name: 'The Moon',
    kind: 'moon',
    primary: 'earth',
    tagline: 'Three days away, and the only other world anyone has stood on.',
    challenge:
      'The Moon has no atmosphere, so every metre per second of the arrival is paid for by an ' +
      'engine — there is nothing to brake against. That single fact is why a lunar lander is ' +
      'mostly propellant tank, and why the descent stage is left behind on the surface rather ' +
      'than carried back up.',
    radius_m: 1_737_400,
    mass_kg: 7.346e22,
    rotationPeriod_s: 655.72 * HOUR,
    axialTilt_deg: 6.68,
    semiMajorAxis_m: 384_400_000,
    eccentricity: 0.0549,
    inclination_deg: 5.145,
    orbitalPeriod_s: 27.321_661 * DAY,
    minDistanceFromEarth_m: 356_500_000,
    meanDistanceFromEarth_m: 384_400_000,
    maxDistanceFromEarth_m: 406_700_000,
    meanTemperature_K: 250,
    minTemperature_K: 95,
    maxTemperature_K: 390,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: 1.37,
    arrival: 'propulsive',
    deltaVBudget: [
      {
        id: 'tli',
        label: 'Trans-lunar injection',
        deltaV_ms: 3120,
        note: 'Raising apogee from low Earth orbit out to the Moon’s distance.',
      },
      {
        id: 'loi',
        label: 'Lunar orbit insertion',
        deltaV_ms: 820,
        note: 'Braking into a 100 km lunar orbit. No atmosphere, so this is all propellant.',
      },
      {
        id: 'descent',
        label: 'Powered descent and landing',
        deltaV_ms: 1870,
        note: 'Cancelling orbital speed and the last of the altitude, on the engine alone.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 3 * DAY,
    launchWindowInterval_s: 0,
    color: '#B5AFA3',
    accentColor: '#77706A',
    catalogId: 'luna',
    precedents: [
      'Luna 2 (first impact, 1959)',
      'Apollo 11 (first crew, 1969)',
      'Chandrayaan-1 (ISRO, confirmed lunar water, 2008)',
      'Chandrayaan-3 (ISRO, first landing near the south pole, 2023)',
    ],
  },

  // ── Terrestrial planets ───────────────────────────────────
  {
    id: 'mars',
    name: 'Mars',
    kind: 'planet',
    primary: 'sun',
    tagline: 'Enough atmosphere to burn you up, not enough to land you.',
    challenge:
      'Mars sets the hardest arrival problem in the inner solar system. The atmosphere is thick ' +
      'enough to require a heat shield and to tear a badly built vehicle apart, and thin enough ' +
      'that parachutes alone will never slow you to a survivable landing. Every successful ' +
      'landing has used all three in sequence: shield, then chute, then engines.',
    radius_m: 3_389_500,
    mass_kg: 6.4171e23,
    rotationPeriod_s: 24.6229 * HOUR,
    axialTilt_deg: 25.19,
    semiMajorAxis_m: 227.956e9,
    eccentricity: 0.0935,
    inclination_deg: 1.848,
    orbitalPeriod_s: 686.98 * DAY,
    minDistanceFromEarth_m: 54.6e9,
    meanDistanceFromEarth_m: 225e9,
    maxDistanceFromEarth_m: 401e9,
    meanTemperature_K: 210,
    minTemperature_K: 130,
    maxTemperature_K: 308,
    atmosphere: {
      surfacePressure_Pa: 610,
      surfaceDensity_kgm3: 0.02,
      scaleHeight_m: 11_100,
      composition: 'CO₂ 95.1%, N₂ 2.6%, Ar 1.9%',
      windSpeed_ms: 7,
      maxWindSpeed_ms: 30,
      windNote: 'Planet-wide dust storms, but in air so thin the force is slight.',
    },
    surfaceRadiation_mSv_day: 0.7,
    arrival: 'assisted_entry',
    deltaVBudget: [
      {
        id: 'tmi',
        label: 'Trans-Mars injection',
        deltaV_ms: 3600,
        note: 'Leaving Earth onto a heliocentric ellipse that reaches Mars’s orbit.',
      },
      {
        id: 'moi',
        label: 'Mars orbit insertion',
        deltaV_ms: 2100,
        note: 'Braking into orbit — or spending a heat shield instead and paying almost nothing.',
        aerobrakeable: true,
      },
      {
        id: 'edl',
        label: 'Entry, descent and landing',
        deltaV_ms: 700,
        note: 'Shield, then supersonic parachute, then a powered final descent.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 259 * DAY,
    launchWindowInterval_s: 779.94 * DAY,
    color: '#B4552F',
    accentColor: '#7A3520',
    catalogId: 'mars',
    precedents: [
      'Mariner 4 (first flyby, 1965)',
      'Viking 1 (first sustained landing, 1976)',
      'Mars Orbiter Mission / Mangalyaan (ISRO, 2014 — succeeded on its first attempt)',
      'Perseverance (2021)',
    ],
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'planet',
    primary: 'sun',
    tagline: 'Ninety-two atmospheres at 737 kelvin. Landers last hours, not years.',
    challenge:
      'Venus is the easiest inner planet to reach and the hardest to survive. The surface is hot ' +
      'enough to melt lead, under pressure equivalent to 900 m of ocean. The thick atmosphere is ' +
      'a gift on arrival — you can aerocapture and parachute down for almost no propellant — and ' +
      'a death sentence on the ground, where the longest any lander has lasted is 127 minutes.',
    radius_m: 6_051_800,
    mass_kg: 4.8675e24,
    rotationPeriod_s: -5832.6 * HOUR,
    axialTilt_deg: 177.36,
    semiMajorAxis_m: 108.21e9,
    eccentricity: 0.0067,
    inclination_deg: 3.395,
    orbitalPeriod_s: 224.701 * DAY,
    minDistanceFromEarth_m: 38e9,
    meanDistanceFromEarth_m: 170e9,
    maxDistanceFromEarth_m: 261e9,
    meanTemperature_K: 737,
    minTemperature_K: 655,
    maxTemperature_K: 773,
    atmosphere: {
      surfacePressure_Pa: 9.2e6,
      surfaceDensity_kgm3: 65,
      scaleHeight_m: 15_900,
      composition: 'CO₂ 96.5%, N₂ 3.5%, with sulphuric acid cloud decks',
      windSpeed_ms: 0.6,
      maxWindSpeed_ms: 100,
      windNote: 'Near-still at the surface; the whole upper atmosphere super-rotates at 100 m/s.',
    },
    surfaceRadiation_mSv_day: null,
    arrival: 'aerodynamic',
    deltaVBudget: [
      {
        id: 'tvi',
        label: 'Trans-Venus injection',
        deltaV_ms: 3500,
        note: 'Dropping inward onto an ellipse that meets Venus’s orbit.',
      },
      {
        id: 'voi',
        label: 'Venus orbit insertion',
        deltaV_ms: 3350,
        note: 'Braking into orbit — or aerocapturing, in an atmosphere with plenty to spare.',
        aerobrakeable: true,
      },
      {
        id: 'descent',
        label: 'Descent',
        deltaV_ms: 0,
        note: 'The atmosphere does all of it. A parachute slows the fall; it is not what saves you.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 146 * DAY,
    launchWindowInterval_s: 583.92 * DAY,
    color: '#D8B26B',
    accentColor: '#8F7238',
    catalogId: 'venus',
    precedents: [
      'Venera 7 (first survivable landing, 1970)',
      'Magellan (radar mapping, 1990)',
      'Shukrayaan-1 (ISRO orbiter, planned)',
    ],
  },
  {
    id: 'mercury',
    name: 'Mercury',
    kind: 'planet',
    primary: 'sun',
    tagline: 'The closest planet, and one of the most expensive places to stop.',
    challenge:
      'Mercury is a lesson in why distance is the wrong measure of difficulty. Falling toward the ' +
      'Sun is easy; arriving slowly enough to be captured is not, because the Sun’s gravity has ' +
      'been accelerating you the whole way and there is no atmosphere to shed any of it. Reaching ' +
      'Mercury directly costs more Δv than reaching Saturn.',
    radius_m: 2_439_700,
    mass_kg: 3.3011e23,
    rotationPeriod_s: 1407.6 * HOUR,
    axialTilt_deg: 0.034,
    semiMajorAxis_m: 57.909e9,
    eccentricity: 0.2056,
    inclination_deg: 7.005,
    orbitalPeriod_s: 87.969 * DAY,
    minDistanceFromEarth_m: 77e9,
    meanDistanceFromEarth_m: 155e9,
    maxDistanceFromEarth_m: 222e9,
    meanTemperature_K: 440,
    minTemperature_K: 100,
    maxTemperature_K: 700,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: null,
    arrival: 'propulsive',
    deltaVBudget: [
      {
        id: 'tmi',
        label: 'Trans-Mercury injection',
        deltaV_ms: 5500,
        note: 'Dropping deep into the Sun’s gravity well.',
      },
      {
        id: 'moi',
        label: 'Mercury orbit insertion',
        deltaV_ms: 3100,
        note: 'All of the arrival speed, killed on the engine. Nothing to brake against.',
      },
      {
        id: 'descent',
        label: 'Descent and landing',
        deltaV_ms: 3060,
        note: 'Orbital velocity here is 3.0 km/s and the atmosphere takes none of it.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 105 * DAY,
    launchWindowInterval_s: 115.88 * DAY,
    color: '#8C8177',
    accentColor: '#57504A',
    catalogId: 'mercury',
    precedents: [
      'Mariner 10 (1974)',
      'MESSENGER (orbit, 2011 — after 6.6 years and six gravity assists)',
      'BepiColombo (en route)',
    ],
  },

  // ── Giant planets and their moons ─────────────────────────
  {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'planet',
    primary: 'sun',
    tagline: 'No surface to land on, and a radiation belt that kills electronics.',
    challenge:
      'There is nothing to land on: the atmosphere simply gets denser until the vehicle is ' +
      'crushed. The mission is the orbit. The real constraint is radiation — the magnetosphere ' +
      'accelerates particles hard enough that unshielded electronics die in weeks, so a Jupiter ' +
      'orbiter flies its computer inside a titanium vault.',
    radius_m: 69_911_000,
    mass_kg: 1.8982e27,
    rotationPeriod_s: 9.925 * HOUR,
    axialTilt_deg: 3.13,
    semiMajorAxis_m: 778.479e9,
    eccentricity: 0.0489,
    inclination_deg: 1.304,
    orbitalPeriod_s: 4332.589 * DAY,
    minDistanceFromEarth_m: 588e9,
    meanDistanceFromEarth_m: 778e9,
    maxDistanceFromEarth_m: 968e9,
    meanTemperature_K: 165,
    minTemperature_K: 110,
    maxTemperature_K: 165,
    atmosphere: {
      surfacePressure_Pa: 100_000,
      surfaceDensity_kgm3: 0.16,
      scaleHeight_m: 27_000,
      composition: 'H₂ 89.8%, He 10.2%, with ammonia and methane cloud decks',
      windSpeed_ms: 150,
      maxWindSpeed_ms: 170,
      windNote: 'Zonal jets that have run in the same bands for centuries.',
    },
    surfaceRadiation_mSv_day: 36_000,
    arrival: 'orbit_only',
    deltaVBudget: [
      {
        id: 'tji',
        label: 'Trans-Jupiter injection',
        deltaV_ms: 6300,
        note: 'Climbing five astronomical units out of the Sun’s well.',
      },
      {
        id: 'joi',
        label: 'Jupiter orbit insertion',
        deltaV_ms: 1400,
        note: 'A capture burn at close periapsis, where it is cheapest.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 997 * DAY,
    launchWindowInterval_s: 398.88 * DAY,
    color: '#C8956B',
    accentColor: '#8A6647',
    catalogId: 'jupiter',
    precedents: ['Pioneer 10 (1973)', 'Galileo (orbit, 1995)', 'Juno (2016)'],
  },
  {
    id: 'europa',
    name: 'Europa',
    kind: 'natural_satellite',
    primary: 'jupiter',
    tagline: 'A saltwater ocean under ice, inside the worst radiation environment we know of.',
    challenge:
      'Europa holds more liquid water than Earth, kept warm by tidal flexing rather than ' +
      'sunlight, and it sits deep inside Jupiter’s radiation belts. A surface mission absorbs a ' +
      'lethal human dose in minutes. Europa Clipper does not orbit Europa at all — it orbits ' +
      'Jupiter and makes repeated fast flybys, so the instruments spend most of their life ' +
      'outside the worst of it.',
    radius_m: 1_560_800,
    mass_kg: 4.7998e22,
    rotationPeriod_s: 3.551 * DAY,
    axialTilt_deg: 0.1,
    semiMajorAxis_m: 671_100_000,
    eccentricity: 0.009,
    inclination_deg: 0.47,
    orbitalPeriod_s: 3.551 * DAY,
    minDistanceFromEarth_m: 588e9,
    meanDistanceFromEarth_m: 778e9,
    maxDistanceFromEarth_m: 968e9,
    meanTemperature_K: 102,
    minTemperature_K: 50,
    maxTemperature_K: 125,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: 5400,
    arrival: 'propulsive',
    deltaVBudget: [
      { id: 'tji', label: 'Trans-Jupiter injection', deltaV_ms: 6300, note: 'The same departure as any Jupiter mission.' },
      { id: 'joi', label: 'Jupiter orbit insertion', deltaV_ms: 1400, note: 'Capture at periapsis.' },
      { id: 'eoi', label: 'Europa orbit insertion', deltaV_ms: 1400, note: 'Descending the Jovian well and matching Europa’s orbit.' },
      { id: 'descent', label: 'Descent and landing', deltaV_ms: 1450, note: 'Airless. Orbital speed is 1.43 km/s, all of it on the engine.' },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 997 * DAY,
    launchWindowInterval_s: 398.88 * DAY,
    color: '#C6B79E',
    accentColor: '#8C7F6C',
    catalogId: 'europa',
    precedents: ['Galileo (flybys, 1995–2003)', 'Europa Clipper (en route)', 'JUICE (ESA, en route)'],
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'planet',
    primary: 'sun',
    tagline: 'Six years out, at one and a half percent of Earth’s sunlight.',
    challenge:
      'The distance is the problem, and it is a problem of *time* rather than Δv. A Hohmann ' +
      'transfer takes six years, which rules out cryogenic propellant — hydrogen boils off long ' +
      'before arrival — and rules out solar power at 15 W/m². Everything that flies here runs on ' +
      'storable propellant and a radioisotope generator.',
    radius_m: 58_232_000,
    mass_kg: 5.6834e26,
    rotationPeriod_s: 10.656 * HOUR,
    axialTilt_deg: 26.73,
    semiMajorAxis_m: 1432.041e9,
    eccentricity: 0.0565,
    inclination_deg: 2.485,
    orbitalPeriod_s: 10_759.22 * DAY,
    minDistanceFromEarth_m: 1195e9,
    meanDistanceFromEarth_m: 1432e9,
    maxDistanceFromEarth_m: 1660e9,
    meanTemperature_K: 134,
    minTemperature_K: 82,
    maxTemperature_K: 134,
    atmosphere: {
      surfacePressure_Pa: 100_000,
      surfaceDensity_kgm3: 0.19,
      scaleHeight_m: 59_500,
      composition: 'H₂ 96.3%, He 3.25%, with ammonia ice cloud decks',
      windSpeed_ms: 400,
      maxWindSpeed_ms: 500,
      windNote: 'The fastest sustained equatorial jet of any planet.',
    },
    surfaceRadiation_mSv_day: 100,
    arrival: 'orbit_only',
    deltaVBudget: [
      { id: 'tsi', label: 'Trans-Saturn injection', deltaV_ms: 7300, note: 'Nearly ten astronomical units out.' },
      { id: 'soi', label: 'Saturn orbit insertion', deltaV_ms: 1000, note: 'Cassini’s capture burn ran 96 minutes.' },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 2208 * DAY,
    launchWindowInterval_s: 378.09 * DAY,
    color: '#D5BD8B',
    accentColor: '#9A8656',
    catalogId: 'saturn',
    precedents: ['Pioneer 11 (1979)', 'Cassini–Huygens (2004–2017)'],
  },
  {
    id: 'titan',
    name: 'Titan',
    kind: 'natural_satellite',
    primary: 'saturn',
    tagline: 'A thicker atmosphere than Earth’s, over lakes of liquid methane.',
    challenge:
      'Titan is the friendliest arrival in the solar system and the longest wait for it. Surface ' +
      'pressure is 1.45 bar and gravity is a seventh of Earth’s, so the atmosphere alone will ' +
      'land you — Huygens descended on parachutes for two and a half hours. In air that thick at ' +
      'that gravity, a person could fly by flapping strapped-on wings.',
    radius_m: 2_574_700,
    mass_kg: 1.3452e23,
    rotationPeriod_s: 15.945 * DAY,
    axialTilt_deg: 0.3,
    semiMajorAxis_m: 1_221_870_000,
    eccentricity: 0.0288,
    inclination_deg: 0.35,
    orbitalPeriod_s: 15.945 * DAY,
    minDistanceFromEarth_m: 1195e9,
    meanDistanceFromEarth_m: 1432e9,
    maxDistanceFromEarth_m: 1660e9,
    meanTemperature_K: 94,
    minTemperature_K: 90,
    maxTemperature_K: 94,
    atmosphere: {
      surfacePressure_Pa: 146_700,
      surfaceDensity_kgm3: 5.4,
      scaleHeight_m: 21_000,
      composition: 'N₂ 94.2%, CH₄ 5.65%, H₂ 0.1%',
      windSpeed_ms: 0.5,
      maxWindSpeed_ms: 30,
      windNote: 'Near-still at the surface; methane weather and dune-building winds aloft.',
    },
    surfaceRadiation_mSv_day: null,
    arrival: 'aerodynamic',
    deltaVBudget: [
      { id: 'tsi', label: 'Trans-Saturn injection', deltaV_ms: 7300, note: 'The long climb out.' },
      { id: 'soi', label: 'Saturn orbit insertion', deltaV_ms: 1000, note: 'Capture at periapsis.' },
      { id: 'toi', label: 'Titan orbit insertion', deltaV_ms: 1400, note: 'Or aerocapture — the atmosphere is more than deep enough.', aerobrakeable: true },
      { id: 'descent', label: 'Descent', deltaV_ms: 0, note: 'Parachutes alone. Thick air, weak gravity, no serious heat problem.' },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 2208 * DAY,
    launchWindowInterval_s: 378.09 * DAY,
    color: '#D98E3D',
    accentColor: '#8A5622',
    catalogId: 'titan',
    precedents: ['Huygens (ESA, first outer-solar-system landing, 2005)', 'Dragonfly (rotorcraft, planned)'],
  },

  // ── Small bodies ──────────────────────────────────────────
  {
    id: 'ceres',
    name: 'Ceres',
    kind: 'dwarf_planet',
    primary: 'sun',
    tagline: 'The largest object in the asteroid belt, and an ice world.',
    challenge:
      'Ceres is cheap to reach and almost free to land on: surface gravity is 0.028 g and escape ' +
      'velocity is 510 m/s, slower than a rifle bullet. The difficulty is the opposite of Mars — ' +
      'holding *onto* the surface. Dawn did not land at all; it spiralled in on ion engines over ' +
      'months, because at that gravity there is no hurry and no atmosphere to fall through.',
    radius_m: 469_700,
    mass_kg: 9.3835e20,
    rotationPeriod_s: 9.074 * HOUR,
    axialTilt_deg: 4,
    semiMajorAxis_m: 413.7e9,
    eccentricity: 0.0785,
    inclination_deg: 10.59,
    orbitalPeriod_s: 1681.63 * DAY,
    minDistanceFromEarth_m: 264e9,
    meanDistanceFromEarth_m: 414e9,
    maxDistanceFromEarth_m: 596e9,
    meanTemperature_K: 168,
    minTemperature_K: 110,
    maxTemperature_K: 235,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: null,
    arrival: 'propulsive',
    deltaVBudget: [
      { id: 'tci', label: 'Trans-Ceres injection', deltaV_ms: 4900, note: 'Out to the middle of the asteroid belt.' },
      { id: 'coi', label: 'Ceres orbit insertion', deltaV_ms: 400, note: 'Cheap: there is very little gravity well to fall into.' },
      { id: 'descent', label: 'Descent and landing', deltaV_ms: 370, note: 'Orbital speed here is 360 m/s. A landing is barely a manoeuvre.' },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 480 * DAY,
    launchWindowInterval_s: 466.6 * DAY,
    color: '#77706A',
    accentColor: '#4C4744',
    catalogId: 'ceres',
    precedents: ['Dawn (orbited both Vesta and Ceres, 2015–2018)'],
  },

  // ── The star ──────────────────────────────────────────────
  {
    id: 'sol',
    name: 'The Sun',
    kind: 'star',
    primary: 'sun',
    tagline: 'The hardest destination in the solar system to actually hit.',
    challenge:
      'Earth is moving sideways at 29.8 km/s. To fall into the Sun you must cancel nearly all of ' +
      'that, which costs far more than leaving the solar system entirely. Parker Solar Probe does ' +
      'not do it directly: it uses seven Venus gravity assists over seven years to shed angular ' +
      'momentum one pass at a time.',
    radius_m: 695_700_000,
    mass_kg: 1.9885e30,
    rotationPeriod_s: 609.12 * HOUR,
    axialTilt_deg: 7.25,
    semiMajorAxis_m: 0,
    eccentricity: 0,
    inclination_deg: 0,
    orbitalPeriod_s: 0,
    minDistanceFromEarth_m: 147.1e9,
    meanDistanceFromEarth_m: 149.6e9,
    maxDistanceFromEarth_m: 152.1e9,
    meanTemperature_K: 5772,
    minTemperature_K: 5772,
    maxTemperature_K: 1.571e7,
    atmosphere: NO_ATMOSPHERE,
    surfaceRadiation_mSv_day: null,
    arrival: 'orbit_only',
    deltaVBudget: [
      {
        id: 'solar-injection',
        label: 'Cancel Earth’s orbital motion',
        deltaV_ms: 24_000,
        note: 'A direct descent to the Sun. Gravity assists replace most of this in practice.',
      },
      {
        id: 'perihelion',
        label: 'Perihelion pass',
        deltaV_ms: 0,
        note: 'No insertion burn — the mission is the pass, at 690,000 km/h.',
      },
    ],
    parkingOrbitAltitude_m: 200_000,
    transferTime_s: 64 * DAY,
    launchWindowInterval_s: 0,
    color: '#FFCF87',
    accentColor: '#FF9A3C',
    catalogId: 'sol',
    precedents: [
      'Helios 2 (1976)',
      'Parker Solar Probe (flew through the corona, 2021)',
      'Aditya-L1 (ISRO solar observatory at Sun–Earth L1, 2023)',
    ],
  },
];

/** Every destination, by id. */
export const DESTINATIONS_BY_ID: ReadonlyMap<string, Destination> = new Map(
  DESTINATIONS.map((d) => [d.id, d]),
);

/** Look up a destination, or undefined if the id is unknown. */
export function getDestination(id: string): Destination | undefined {
  return DESTINATIONS_BY_ID.get(id);
}

/** The default destination for a new mission. */
export const DEFAULT_DESTINATION_ID = 'leo';

/** Destinations grouped the way a mission planner thinks about them. */
export const DESTINATION_GROUPS: readonly {
  readonly label: string;
  readonly note: string;
  readonly ids: readonly string[];
}[] = [
  { label: 'Earth orbit', note: 'Hours away. The horizontal problem.', ids: ['leo', 'gto'] },
  { label: 'Cislunar', note: 'Days away. No atmosphere at the far end.', ids: ['luna'] },
  {
    label: 'Inner planets',
    note: 'Months away, on a window that comes round every year or two.',
    ids: ['mars', 'venus', 'mercury'],
  },
  { label: 'The belt', note: 'A year and a half out. Almost no gravity to fight.', ids: ['ceres'] },
  {
    label: 'Outer system',
    note: 'Years away. Storable propellant and nuclear power only.',
    ids: ['jupiter', 'europa', 'saturn', 'titan'],
  },
  { label: 'The Sun', note: 'The most expensive place to go, by a wide margin.', ids: ['sol'] },
];
