import type { TelemetryPoint } from '@/types/simulation';

/**
 * The trajectory the ascent was *aiming* for, and how far it strayed.
 *
 * The flight view drew one line: where the vehicle went. That answers "what
 * happened" and not "was that what should have happened", and the second
 * question is the one a launch review is actually about.
 *
 * ## What "planned" means here, exactly
 *
 * It is a **reference ascent profile**, reconstructed from the mission's own
 * target — not an output of the physics engine, and not a trajectory anybody
 * optimised. The engine integrates one flight; it does not also integrate a
 * nominal to compare against.
 *
 * The reference is the standard textbook shape: altitude rising to the target
 * along a smoothed gravity-turn curve, with downrange growing as the vehicle
 * pitches over. Its purpose is to give the flown path something to be measured
 * *against*, and the interface labels it as a reference rather than as a plan
 * the vehicle was ever given.
 *
 * Two numbers come out of the comparison, and both are things a real flight
 * review looks at:
 *
 * - **Deflection** — how far the vehicle is from the reference right now, in
 *   metres. A steady drift means the vehicle is under- or over-performing; a
 *   sudden step means something happened.
 * - **Tangential angle** — the difference between the direction the vehicle is
 *   actually travelling and the direction the reference says it should be. This
 *   is the more diagnostic of the two: a vehicle can be *on* the line and
 *   heading off it, and that shows up here first.
 */

/** One point on the reference ascent. */
export interface PlanPoint {
  /** Unit: m */
  readonly altitude_m: number;
  /** Unit: m */
  readonly downrange_m: number;
}

/**
 * Build the reference ascent for a mission.
 *
 * @param targetAltitude_m - The orbit the ascent was aiming at.
 * @param maxDownrange_m - How far downrange the flight actually went, used to
 *   scale the reference so the two curves are comparable rather than one being
 *   an arbitrary length.
 * @param samples - Points along the curve.
 */
export function buildReferenceAscent(
  targetAltitude_m: number,
  maxDownrange_m: number,
  samples = 160,
): PlanPoint[] {
  const points: PlanPoint[] = [];
  const downrange = Math.max(maxDownrange_m, targetAltitude_m * 2);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;

    // Altitude: fast early, flattening as the vehicle trades climb for speed.
    // The square-root shape is what a gravity turn produces — most of the
    // altitude is bought in the first third of the downrange distance.
    const altitude = targetAltitude_m * Math.sqrt(t);

    // Downrange: slow at first while the vehicle is still going nearly
    // straight up, then accelerating as it lies over. Cubed-ish is the
    // complement of the altitude curve.
    const range = downrange * t * t;

    points.push({ altitude_m: altitude, downrange_m: range });
  }
  return points;
}

/** How far the flight is from its reference, and which way it is heading. */
export interface Deviation {
  /** Shortest distance from the vehicle to the reference curve. Unit: m */
  readonly deflection_m: number;
  /** Positive when the vehicle is above the reference. Unit: m */
  readonly altitudeError_m: number;
  /** Flight-path angle of the vehicle. Unit: degrees from horizontal */
  readonly actualAngle_deg: number;
  /** Flight-path angle the reference has at this point. Unit: degrees */
  readonly referenceAngle_deg: number;
  /** Actual minus reference. Positive means climbing steeper. Unit: degrees */
  readonly tangentialAngle_deg: number;
}

/**
 * Compare the flight against its reference at one moment.
 *
 * The deflection is a true perpendicular distance to the polyline rather than
 * a vertical difference, because a vehicle that is short *downrange* has
 * deviated just as surely as one that is short on altitude — and a vertical-only
 * measure reports zero for it.
 */
export function deviationAt(
  point: TelemetryPoint,
  plan: readonly PlanPoint[],
  previous?: TelemetryPoint,
): Deviation | null {
  if (plan.length < 2) return null;

  const x = point.downrange_m;
  const y = point.altitude_m;

  let best = Number.POSITIVE_INFINITY;
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < plan.length - 1; i++) {
    const a = plan[i]!;
    const b = plan[i + 1]!;
    const dx = b.downrange_m - a.downrange_m;
    const dy = b.altitude_m - a.altitude_m;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) continue;

    // Projection of the point onto this segment, clamped to it.
    let t = ((x - a.downrange_m) * dx + (y - a.altitude_m) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const px = a.downrange_m + dx * t;
    const py = a.altitude_m + dy * t;
    const distance = Math.hypot(x - px, y - py);

    if (distance < best) {
      best = distance;
      bestIndex = i;
      bestT = t;
    }
  }

  const a = plan[bestIndex]!;
  const b = plan[bestIndex + 1]!;
  const nearestAltitude = a.altitude_m + (b.altitude_m - a.altitude_m) * bestT;

  // The reference's own direction at the closest point.
  const referenceAngle =
    (Math.atan2(b.altitude_m - a.altitude_m, b.downrange_m - a.downrange_m) * 180) / Math.PI;

  /*
   * The vehicle's flight-path angle.
   *
   * Taken from the velocity components the engine reports rather than from a
   * finite difference of position, because the samples are a second apart and
   * differencing them would put a second of lag into an angle that changes
   * fast during pitchover. `previous` is only a fallback for a sample that
   * predates the velocity fields.
   */
  let actualAngle: number;
  if (Number.isFinite(point.vertical_speed_ms) && Number.isFinite(point.horizontal_speed_ms)) {
    actualAngle = (Math.atan2(point.vertical_speed_ms, point.horizontal_speed_ms) * 180) / Math.PI;
  } else if (previous) {
    actualAngle =
      (Math.atan2(
        point.altitude_m - previous.altitude_m,
        point.downrange_m - previous.downrange_m,
      ) *
        180) /
      Math.PI;
  } else {
    actualAngle = 90;
  }

  return {
    deflection_m: best,
    altitudeError_m: y - nearestAltitude,
    actualAngle_deg: actualAngle,
    referenceAngle_deg: referenceAngle,
    tangentialAngle_deg: actualAngle - referenceAngle,
  };
}
