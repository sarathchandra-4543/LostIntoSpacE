/**
 * Mission planning — what a destination demands of a design.
 *
 * This is the join the product was missing. Before it, a launch had a target
 * *altitude* and nothing else, so every mission was the same mission at a
 * different number, and the choices a user made in the builder — which
 * propellant, whether to carry a heat shield, how many stages — had nothing to
 * answer to.
 *
 * A destination answers them. The cruise duration decides whether the propellant
 * will still be liquid on arrival. The arrival atmosphere decides whether the
 * vehicle brakes on a heat shield or on an engine. The distance from the Sun
 * decides whether solar panels make any power. The light time decides whether
 * the landing can be flown from Earth at all. None of those are opinions; they
 * all fall out of numbers already in the catalogue.
 *
 * Physics lives in `physics/transfer.ts` as pure functions of numbers. This
 * module is the layer that knows about specific places.
 *
 * @module core/mission-planning
 */

import {
  AU_M,
  MU_SUN,
  airlessLandingDeltaV,
  hohmannTransfer,
  parachuteTerminalVelocity,
  SURVIVABLE_TOUCHDOWN_SPEED,
  type HohmannTransfer,
} from '../physics/transfer.js';
import {
  EARTH_YEAR_S,
  SOLAR_CONSTANT_1AU,
  aerobrakedDeltaV,
  ascentDeltaV,
  gravitationalParameter,
  heliocentricDistance,
  lightTime_s,
  solarConstant,
  surfaceGravity,
  totalDeltaV,
  type Destination,
} from './destinations.js';


/**
 * The heliocentric Hohmann transfer from Earth to a destination.
 *
 * Returns null for anywhere that is not on a heliocentric transfer — an Earth
 * orbit or the Moon, where the departure is a different problem entirely.
 */
export function transferFromEarth(destination: Destination): HohmannTransfer | null {
  if (destination.primary === 'earth') return null;

  const r2 = heliocentricDistance(destination);
  if (r2 <= 0 || Math.abs(r2 - AU_M) < 1) return null;

  // A moon transfers as its planet does: the planet's period governs the window.
  const targetPeriod =
    destination.primary === 'sun'
      ? destination.orbitalPeriod_s
      : EARTH_YEAR_S * Math.pow(r2 / AU_M, 1.5);

  return hohmannTransfer(AU_M, r2, MU_SUN, targetPeriod);
}

/** Δv to land on this body from low orbit, where it has no atmosphere. Unit: m/s */
export function landingDeltaV(destination: Destination): number {
  if (destination.radius_m <= 0) return 0;
  return airlessLandingDeltaV(destination.radius_m, gravitationalParameter(destination));
}

/** Terminal velocity of a reference lander under a parachute here. Unit: m/s */
export function terminalVelocity(destination: Destination): number {
  const atmosphere = destination.atmosphere;
  if (!atmosphere) return Number.POSITIVE_INFINITY;
  return parachuteTerminalVelocity(
    surfaceGravity(destination),
    atmosphere.surfaceDensity_kgm3,
  );
}

/** Which propellant classes survive a cruise of a given length. */
export type PropellantClass = 'cryogenic' | 'semi_cryogenic' | 'storable' | 'solid' | 'electric';

/**
 * Propellant classes that can still be fired at the end of the cruise.
 *
 * Boil-off is the constraint nobody expects and everybody hits. Liquid hydrogen
 * boils at 20 K; with passive insulation alone a stage loses it over weeks, so
 * an upper stage that works beautifully for a lunar injection is empty long
 * before Saturn. Hypergolics sit in a tank for a decade, which is why every
 * outer-planet mission has flown them.
 *
 * @param cruiseTime_s - One-way coast duration. Unit: s
 */
export function viablePropellants(cruiseTime_s: number): readonly PropellantClass[] {
  const days = cruiseTime_s / 86_400;
  if (days <= 30) return ['cryogenic', 'semi_cryogenic', 'storable', 'solid', 'electric'];
  if (days <= 365) return ['semi_cryogenic', 'storable', 'solid', 'electric'];
  return ['storable', 'solid', 'electric'];
}

/** Human-readable name for a propellant class. */
export const PROPELLANT_LABELS: Record<PropellantClass, string> = {
  cryogenic: 'cryogenic (LH₂/LOX)',
  semi_cryogenic: 'semi-cryogenic (RP-1 or CH₄ with LOX)',
  storable: 'storable hypergolic (MMH/NTO)',
  solid: 'solid',
  electric: 'electric (ion or Hall-effect)',
};

/** How a vehicle can be powered at the destination. */
export type PowerSource = 'solar' | 'solar_large_array' | 'radioisotope';

/**
 * What will still make power out there.
 *
 * Irradiance falls as the inverse square, so Jupiter gets 3.7% of Earth's and
 * Saturn 1.1%. Juno proved solar works at Jupiter, but only with three arrays
 * nine metres long; past that, everything that has flown has carried plutonium.
 */
export function viablePower(destination: Destination): PowerSource {
  const irradiance = solarConstant(destination);
  if (irradiance >= 200) return 'solar';
  if (irradiance >= 45) return 'solar_large_array';
  return 'radioisotope';
}

/** Human-readable name for a power source. */
export const POWER_LABELS: Record<PowerSource, string> = {
  solar: 'Solar array',
  solar_large_array: 'Oversized solar array — viable, but only just',
  radioisotope: 'Radioisotope generator — sunlight is too weak to use',
};

/** One design requirement a destination imposes, with the reason for it. */
export interface DesignRequirement {
  readonly id: string;
  readonly label: string;
  /** True when the mission cannot be flown without satisfying this. */
  readonly mandatory: boolean;
  /** Why the destination imposes it. */
  readonly reason: string;
  /** Component categories that satisfy it, where a component can. */
  readonly satisfiedBy: readonly string[];
}

/**
 * What this destination forces you to build.
 *
 * The fuel, the materials and the trajectory follow from where you are going,
 * rather than being three unrelated choices made in a vacuum.
 */
export function designRequirements(destination: Destination): readonly DesignRequirement[] {
  const requirements: DesignRequirement[] = [];
  const atmosphere = destination.atmosphere;
  const cruiseDays = destination.transferTime_s / 86_400;
  const propellants = viablePropellants(destination.transferTime_s);
  const power = viablePower(destination);
  const terminal = terminalVelocity(destination);

  // ── Entry heating ─────────────────────────────────────────
  if (
    atmosphere &&
    (destination.arrival === 'aerodynamic' || destination.arrival === 'assisted_entry')
  ) {
    requirements.push({
      id: 'heat-shield',
      label: 'Heat shield',
      mandatory: true,
      reason:
        `Arrival at ${destination.name} is an atmospheric entry at interplanetary speed. ` +
        'Without an ablative or ceramic shield the vehicle is destroyed long before it ' +
        'reaches the surface.',
      satisfiedBy: ['heat_shield'],
    });
  }

  // ── Descent ───────────────────────────────────────────────
  if (atmosphere && terminal <= SURVIVABLE_TOUCHDOWN_SPEED) {
    requirements.push({
      id: 'parachute',
      label: 'Parachute',
      mandatory: true,
      reason:
        'The atmosphere is dense enough that a parachute alone brings a reference lander to ' +
        `about ${terminal.toFixed(1)} m/s — slow enough to land on. No descent engine needed.`,
      satisfiedBy: ['parachute'],
    });
  } else if (atmosphere && Number.isFinite(terminal)) {
    requirements.push({
      id: 'powered-descent',
      label: 'Parachute and a descent engine',
      mandatory: destination.arrival === 'assisted_entry',
      reason:
        `A parachute only slows a reference lander to about ${terminal.toFixed(0)} m/s here — ` +
        'the air is too thin to do more. The last few kilometres have to be flown on an engine.',
      satisfiedBy: ['parachute', 'engine', 'landing_leg'],
    });
  } else if (destination.arrival === 'propulsive') {
    requirements.push({
      id: 'landing-engine',
      label: 'Throttleable descent engine and landing gear',
      mandatory: true,
      reason:
        `${destination.name} has no atmosphere. Every metre per second of the ` +
        `${landingDeltaV(destination).toFixed(0)} m/s descent is paid for by an engine, and a ` +
        'parachute would do nothing at all.',
      satisfiedBy: ['engine', 'landing_leg'],
    });
  }

  // ── Propellant ────────────────────────────────────────────
  if (!propellants.includes('cryogenic')) {
    requirements.push({
      id: 'propellant-class',
      label: 'Non-cryogenic propellant for the arrival stage',
      mandatory: true,
      reason:
        `The cruise lasts ${formatDuration(destination.transferTime_s)}. Liquid hydrogen boils ` +
        'off long before arrival, so the stage that performs the arrival burn has to run on ' +
        `${propellants.map((p) => PROPELLANT_LABELS[p]).join(', ')}.`,
      satisfiedBy: ['fuel_tank', 'oxidizer_tank', 'engine'],
    });
  }

  // ── Power ─────────────────────────────────────────────────
  if (power !== 'solar') {
    const irradiance = solarConstant(destination);
    requirements.push({
      id: 'power',
      label: POWER_LABELS[power],
      mandatory: power === 'radioisotope',
      reason:
        `Sunlight at ${destination.name} is ${irradiance.toFixed(1)} W/m², ` +
        `${((irradiance / SOLAR_CONSTANT_1AU) * 100).toFixed(1)}% of what it is at Earth.`,
      satisfiedBy: ['battery', 'avionics'],
    });
  }

  // ── Radiation ─────────────────────────────────────────────
  if (
    destination.surfaceRadiation_mSv_day !== null &&
    destination.surfaceRadiation_mSv_day >= 100
  ) {
    requirements.push({
      id: 'radiation',
      label: 'Radiation-shielded avionics',
      mandatory: true,
      reason:
        `${destination.surfaceRadiation_mSv_day.toLocaleString()} mSv per day. Unshielded ` +
        'electronics fail within weeks, and this dose is lethal to a human in under an hour.',
      satisfiedBy: ['avionics', 'guidance'],
    });
  }

  // ── Autonomy ──────────────────────────────────────────────
  const light = lightTime_s(destination);
  if (light > 60) {
    requirements.push({
      id: 'autonomy',
      label: 'Autonomous guidance',
      mandatory: true,
      reason:
        `A radio command takes ${formatDuration(light)} to arrive, so nothing time-critical can ` +
        "be flown from Earth. Entry and landing must run on the vehicle's own computer.",
      satisfiedBy: ['guidance', 'avionics', 'sensor'],
    });
  }

  // ── Cruise duration ───────────────────────────────────────
  if (cruiseDays > 365) {
    requirements.push({
      id: 'cruise-survival',
      label: 'Long-duration cruise provisions',
      mandatory: false,
      reason:
        `${formatDuration(destination.transferTime_s)} of coast. Everything on board has to ` +
        'still work on arrival, having been cold-soaked the whole way.',
      satisfiedBy: ['battery', 'avionics'],
    });
  }

  return requirements;
}

/** Whether a vehicle can actually make this trip, and by how much it misses. */
export interface MissionFeasibility {
  readonly destination: Destination;
  /** Δv the vehicle has, from the builder's own analysis. Unit: m/s */
  readonly availableDeltaV_ms: number;
  /** Δv to reach the parking orbit. Unit: m/s */
  readonly ascentDeltaV_ms: number;
  /** Δv for every leg above the parking orbit, all propulsive. Unit: m/s */
  readonly transferDeltaV_ms: number;
  /** The same, if every aerobrakeable leg is flown on a heat shield. Unit: m/s */
  readonly aerobrakedDeltaV_ms: number;
  /** Total needed, propulsive. Unit: m/s */
  readonly requiredDeltaV_ms: number;
  /** Total needed, aerobraking where possible. Unit: m/s */
  readonly requiredAerobraked_ms: number;
  /** Surplus (positive) or shortfall (negative), propulsive. Unit: m/s */
  readonly marginDeltaV_ms: number;
  /** Surplus or shortfall with aerobraking. Unit: m/s */
  readonly marginAerobraked_ms: number;
  /** True if the trip closes propulsively. */
  readonly reachable: boolean;
  /** True if it closes only by aerobraking. */
  readonly reachableWithAerobraking: boolean;
  /** What the destination forces into the design. */
  readonly requirements: readonly DesignRequirement[];
  /** The heliocentric transfer, where there is one. */
  readonly transfer: HohmannTransfer | null;
}

/**
 * Can this vehicle get there?
 *
 * @param destination - Where it is trying to go.
 * @param availableDeltaV_ms - Ideal Δv from the builder's staging analysis.
 */
export function assessMission(
  destination: Destination,
  availableDeltaV_ms: number,
): MissionFeasibility {
  const ascent = ascentDeltaV(destination);
  const transferDv = totalDeltaV(destination);
  const aerobraked = aerobrakedDeltaV(destination);
  const required = ascent + transferDv;
  const requiredAero = ascent + aerobraked;

  return {
    destination,
    availableDeltaV_ms,
    ascentDeltaV_ms: ascent,
    transferDeltaV_ms: transferDv,
    aerobrakedDeltaV_ms: aerobraked,
    requiredDeltaV_ms: required,
    requiredAerobraked_ms: requiredAero,
    marginDeltaV_ms: availableDeltaV_ms - required,
    marginAerobraked_ms: availableDeltaV_ms - requiredAero,
    reachable: availableDeltaV_ms >= required,
    reachableWithAerobraking: availableDeltaV_ms >= requiredAero,
    requirements: designRequirements(destination),
    transfer: transferFromEarth(destination),
  };
}

/** A duration written the way a mission timeline writes it. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)} min`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)} h`;
  const days = seconds / 86_400;
  if (days < 100) return `${days.toFixed(0)} days`;
  const years = days / 365.25;
  if (years < 1) return `${days.toFixed(0)} days`;
  return `${years.toFixed(1)} years`;
}
