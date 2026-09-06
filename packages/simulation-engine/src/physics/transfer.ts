/**
 * Orbital transfer mechanics — patched conics, in closed form.
 *
 * The flight simulation integrates an *ascent*: a vehicle leaving a launch pad
 * and reaching a parking orbit. Everything above that orbit — the departure
 * burn, the months of cruise, the arrival — happens on timescales the
 * integrator would take days to chew through, and modelling it that way would
 * teach nobody anything they could not read off a conic in closed form.
 *
 * So this module does it in closed form. That is not a shortcut invented here;
 * it is how real mission design produces its first cut, and it is exactly right
 * for the question being asked: *can this rocket get there, and what does going
 * there cost?*
 *
 * ## What this deliberately does not do
 *
 * No gravity assists, no finite-burn losses, no n-body perturbation, no
 * optimisation. A Hohmann transfer is the cheapest two-impulse transfer between
 * circular coplanar orbits, and every real mission beats it by some margin.
 * Treating these numbers as a *budget to beat* is correct; treating them as a
 * prediction of a specific flight is not, and the interface says so.
 *
 * Everything here is a pure function of numbers, with no dependency on the
 * destination catalogue or on any other layer. Mission planning that knows
 * about specific places lives in `core/mission-planning.ts`.
 *
 * @module physics/transfer
 */

/** Standard gravitational parameter of the Sun. Unit: m³/s² */
export const MU_SUN = 1.327_124_400_18e20;

/** Astronomical unit, exact by definition (IAU 2012). Unit: m */
export const AU_M = 149_597_870_700;

/** A two-impulse Hohmann transfer between two circular, coplanar orbits. */
export interface HohmannTransfer {
  /** Departure burn. Unit: m/s */
  readonly departureDeltaV_ms: number;
  /** Arrival burn. Unit: m/s */
  readonly arrivalDeltaV_ms: number;
  /** Both burns. Unit: m/s */
  readonly totalDeltaV_ms: number;
  /** Half the period of the transfer ellipse. Unit: s */
  readonly transferTime_s: number;
  /** Semi-major axis of the transfer ellipse. Unit: m */
  readonly transferSemiMajorAxis_m: number;
  /**
   * Where the target must be, relative to the departure body, at the moment of
   * the departure burn. Unit: degrees.
   *
   * This is the whole of what a "launch window" means. Get it wrong and the
   * vehicle arrives at the right orbit at the wrong time, with the destination
   * somewhere else entirely.
   */
  readonly departurePhaseAngle_deg: number;
}

/**
 * Solve a Hohmann transfer from one circular orbit to another.
 *
 * @param r1_m - Departure orbit radius about the central body. Unit: m
 * @param r2_m - Arrival orbit radius about the central body. Unit: m
 * @param mu - Gravitational parameter of the central body. Unit: m³/s²
 * @param targetPeriod_s - Orbital period of the target, for the phase angle.
 *   Pass 0 to skip the phase-angle calculation.
 * @returns The two burns, the coast time, and the required departure geometry.
 */
export function hohmannTransfer(
  r1_m: number,
  r2_m: number,
  mu: number,
  targetPeriod_s = 0,
): HohmannTransfer {
  const a_t = (r1_m + r2_m) / 2;

  // Speed on a circular orbit at each radius.
  const v1 = Math.sqrt(mu / r1_m);
  const v2 = Math.sqrt(mu / r2_m);

  // Vis-viva on the transfer ellipse, at each end of it.
  const vPeri = Math.sqrt(mu * (2 / r1_m - 1 / a_t));
  const vApo = Math.sqrt(mu * (2 / r2_m - 1 / a_t));

  const departure = Math.abs(vPeri - v1);
  const arrival = Math.abs(v2 - vApo);
  const transferTime = Math.PI * Math.sqrt((a_t * a_t * a_t) / mu);

  // The target moves while the vehicle coasts. It must be this far ahead of the
  // departure point at ignition for the two to meet at the far end.
  let phase = 0;
  if (targetPeriod_s > 0) {
    const targetSweep = (2 * Math.PI * transferTime) / targetPeriod_s;
    phase = ((Math.PI - targetSweep) * 180) / Math.PI;
    // Fold into (-180, 180], which is how a phase angle is quoted.
    phase = ((((phase + 180) % 360) + 360) % 360) - 180;
  }

  return {
    departureDeltaV_ms: departure,
    arrivalDeltaV_ms: arrival,
    totalDeltaV_ms: departure + arrival,
    transferTime_s: transferTime,
    transferSemiMajorAxis_m: a_t,
    departurePhaseAngle_deg: phase,
  };
}

/**
 * How often two bodies return to the same relative geometry. Unit: s
 *
 * This is the launch-window interval. Mars's is 780 days, which is why Mars
 * missions come in clumps roughly two years apart, and why missing a window is
 * measured in years rather than weeks.
 */
export function synodicPeriod(period1_s: number, period2_s: number): number {
  if (period1_s <= 0 || period2_s <= 0) return 0;
  const difference = Math.abs(1 / period1_s - 1 / period2_s);
  return difference === 0 ? Number.POSITIVE_INFINITY : 1 / difference;
}

/**
 * Orbital period from a semi-major axis. Kepler's third law. Unit: s
 */
export function orbitalPeriod(semiMajorAxis_m: number, mu: number): number {
  if (semiMajorAxis_m <= 0 || mu <= 0) return 0;
  return 2 * Math.PI * Math.sqrt((semiMajorAxis_m * semiMajorAxis_m * semiMajorAxis_m) / mu);
}

/** Speed on a circular orbit of the given radius. Unit: m/s */
export function circularSpeed(radius_m: number, mu: number): number {
  if (radius_m <= 0) return 0;
  return Math.sqrt(mu / radius_m);
}

/** Escape speed from the given radius. Unit: m/s */
export function escapeSpeed(radius_m: number, mu: number): number {
  if (radius_m <= 0) return 0;
  return Math.sqrt((2 * mu) / radius_m);
}

/**
 * Δv to capture from a hyperbolic approach into a closed orbit. Unit: m/s
 *
 * At periapsis the incoming speed is √(v∞² + 2μ/r_p) and the speed needed to
 * stay is √(μ(1+e)/r_p). The difference is the burn. The reason capture is
 * cheapest at low periapsis — the Oberth effect — falls straight out of this:
 * the deeper the pass, the larger both speeds and the smaller their difference.
 *
 * @param excessSpeed_ms - Hyperbolic excess velocity, v∞. Unit: m/s
 * @param periapsis_m - Radius of closest approach. Unit: m
 * @param mu - Gravitational parameter of the capturing body. Unit: m³/s²
 * @param targetEccentricity - Eccentricity of the orbit being captured into.
 *   Zero gives a circular orbit; a real mission captures into a high ellipse
 *   because it is far cheaper.
 */
export function captureDeltaV(
  excessSpeed_ms: number,
  periapsis_m: number,
  mu: number,
  targetEccentricity = 0,
): number {
  if (periapsis_m <= 0) return 0;
  const arrival = Math.sqrt(excessSpeed_ms * excessSpeed_ms + (2 * mu) / periapsis_m);
  const captured = Math.sqrt((mu * (1 + targetEccentricity)) / periapsis_m);
  return Math.max(0, arrival - captured);
}

/**
 * Δv to land on an airless body from a low circular orbit. Unit: m/s
 *
 * Orbital speed at the surface, plus about 12% for the gravity losses of a
 * descent that is not instantaneous and for the hover margin every real lander
 * carries. Where there is an atmosphere this is the wrong model entirely.
 */
export function airlessLandingDeltaV(surfaceRadius_m: number, mu: number): number {
  return circularSpeed(surfaceRadius_m, mu) * 1.12;
}

/**
 * Ballistic coefficient of a reference parachute-borne lander. Unit: kg/m²
 *
 * `m / (Cd·A)`. Ten is representative of a real entry vehicle under a fully
 * inflated main canopy — Huygens and the Viking landers both sat near this. It
 * is a *reference* figure, chosen so terminal velocities can be compared
 * honestly between destinations, not a property of any vehicle a user builds.
 */
export const REFERENCE_BALLISTIC_COEFFICIENT = 10;

/** The fastest a robust lander can meet the ground and still work. Unit: m/s */
export const SURVIVABLE_TOUCHDOWN_SPEED = 10;

/**
 * Terminal velocity under a parachute. Unit: m/s
 *
 * `v = √(2·β·g / ρ)`. This one expression explains why Mars is hard and Titan
 * is easy better than any amount of prose: at Mars it comes out near 60 m/s,
 * far too fast to land on, which is exactly why every Mars lander fires engines
 * after the chute. At Titan it is about 2 m/s — a walking pace.
 *
 * Returns Infinity where there is no atmosphere to fall through.
 *
 * @param gravity_ms2 - Surface gravity. Unit: m/s²
 * @param density_kgm3 - Atmospheric density at the surface. Unit: kg/m³
 * @param ballisticCoefficient - m/(Cd·A). Unit: kg/m²
 */
export function parachuteTerminalVelocity(
  gravity_ms2: number,
  density_kgm3: number,
  ballisticCoefficient = REFERENCE_BALLISTIC_COEFFICIENT,
): number {
  if (density_kgm3 <= 0 || gravity_ms2 <= 0) return Number.POSITIVE_INFINITY;
  return Math.sqrt((2 * ballisticCoefficient * gravity_ms2) / density_kgm3);
}
