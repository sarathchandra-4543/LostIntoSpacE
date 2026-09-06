/**
 * Transfer mechanics, checked against flights that actually happened.
 *
 * A closed-form solver is only worth having if its answers match the real
 * missions it claims to describe, so the assertions here are quoted figures
 * from Apollo, Cassini, Huygens and the standard Δv map rather than numbers
 * read back out of the implementation.
 */

import { describe, it, expect } from 'vitest';

import {
  AU_M,
  MU_SUN,
  captureDeltaV,
  circularSpeed,
  escapeSpeed,
  hohmannTransfer,
  orbitalPeriod,
  parachuteTerminalVelocity,
  synodicPeriod,
} from '../../src/physics/transfer.js';
import {
  DESTINATIONS,
  MU_EARTH_SI,
  EARTH_RADIUS_M,
  earthGravityRatio,
  escapeVelocity,
  getDestination,
  lightTime_s,
  meanDensity,
  solarConstant,
  surfaceGravity,
  totalDeltaV,
} from '../../src/core/destinations.js';
import {
  assessMission,
  designRequirements,
  terminalVelocity,
  transferFromEarth,
  viablePower,
  viablePropellants,
} from '../../src/core/mission-planning.js';

const DAY = 86_400;

describe('hohmannTransfer', () => {
  it('matches the published Earth→Mars budget and coast time', () => {
    const mars = getDestination('mars')!;
    const transfer = hohmannTransfer(AU_M, mars.semiMajorAxis_m, MU_SUN, mars.orbitalPeriod_s);

    // Textbook figures: 2.94 km/s to depart, 2.65 km/s to arrive, ~259 days.
    expect(transfer.departureDeltaV_ms).toBeGreaterThan(2800);
    expect(transfer.departureDeltaV_ms).toBeLessThan(3100);
    expect(transfer.arrivalDeltaV_ms).toBeGreaterThan(2400);
    expect(transfer.arrivalDeltaV_ms).toBeLessThan(2800);
    expect(transfer.transferTime_s / DAY).toBeGreaterThan(250);
    expect(transfer.transferTime_s / DAY).toBeLessThan(265);
  });

  it('reproduces the +44° Mars departure phase angle', () => {
    // Mars must lead Earth by about 44° at ignition. It sweeps only ~136° of
    // its own orbit while the vehicle covers the transfer's 180°, so the
    // shortfall is where it has to start from.
    const mars = getDestination('mars')!;
    const transfer = hohmannTransfer(AU_M, mars.semiMajorAxis_m, MU_SUN, mars.orbitalPeriod_s);
    expect(transfer.departurePhaseAngle_deg).toBeGreaterThan(38);
    expect(transfer.departurePhaseAngle_deg).toBeLessThan(50);
  });

  it('is symmetric in cost: going inward costs what coming outward costs', () => {
    const out = hohmannTransfer(AU_M, 1.524 * AU_M, MU_SUN);
    const back = hohmannTransfer(1.524 * AU_M, AU_M, MU_SUN);
    expect(back.totalDeltaV_ms).toBeCloseTo(out.totalDeltaV_ms, 6);
    expect(back.transferTime_s).toBeCloseTo(out.transferTime_s, 6);
  });

  it('gives a transfer ellipse that touches both orbits', () => {
    const transfer = hohmannTransfer(AU_M, 5.204 * AU_M, MU_SUN);
    expect(transfer.transferSemiMajorAxis_m).toBeCloseTo((AU_M + 5.204 * AU_M) / 2, 3);
  });
});

describe('synodicPeriod', () => {
  it('gives the 780-day Mars launch window', () => {
    const earth = 365.256 * DAY;
    const mars = 686.98 * DAY;
    expect(synodicPeriod(earth, mars) / DAY).toBeCloseTo(779.9, 0);
  });

  it('gives the 584-day Venus window', () => {
    expect(synodicPeriod(365.256 * DAY, 224.701 * DAY) / DAY).toBeCloseTo(583.9, 0);
  });

  it('is infinite for two bodies with the same period', () => {
    expect(synodicPeriod(100, 100)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('orbital speeds', () => {
  it('puts low Earth orbit at 7.8 km/s', () => {
    expect(circularSpeed(EARTH_RADIUS_M + 200_000, MU_EARTH_SI)).toBeCloseTo(7784, -1);
  });

  it('puts Earth escape at 11.2 km/s', () => {
    expect(escapeSpeed(EARTH_RADIUS_M, MU_EARTH_SI) / 1000).toBeCloseTo(11.18, 1);
  });

  it('gives a 90-minute period in low orbit', () => {
    const period = orbitalPeriod(EARTH_RADIUS_M + 400_000, MU_EARTH_SI);
    expect(period / 60).toBeGreaterThan(90);
    expect(period / 60).toBeLessThan(95);
  });
});

describe('captureDeltaV', () => {
  it('costs less into an ellipse than into a circle', () => {
    const circular = captureDeltaV(2500, EARTH_RADIUS_M + 200_000, MU_EARTH_SI, 0);
    const elliptical = captureDeltaV(2500, EARTH_RADIUS_M + 200_000, MU_EARTH_SI, 0.9);
    expect(elliptical).toBeLessThan(circular);
  });

  it('costs less the deeper the periapsis, for the same captured orbit', () => {
    // This is the Oberth effect, and it only means anything with the target
    // orbit held fixed. Both burns here capture into an ellipse reaching
    // 400,000 km; the one performed deeper in the well is far cheaper.
    const apoapsis = 400_000_000;
    const forPeriapsis = (periapsis: number) =>
      captureDeltaV(
        3000,
        periapsis,
        MU_EARTH_SI,
        (apoapsis - periapsis) / (apoapsis + periapsis),
      );

    expect(forPeriapsis(EARTH_RADIUS_M + 200_000)).toBeLessThan(
      forPeriapsis(EARTH_RADIUS_M + 20_000_000),
    );
  });

  it('costs more the faster the vehicle arrives', () => {
    const slow = captureDeltaV(1000, EARTH_RADIUS_M + 200_000, MU_EARTH_SI);
    const fast = captureDeltaV(5000, EARTH_RADIUS_M + 200_000, MU_EARTH_SI);
    expect(fast).toBeGreaterThan(slow);
  });

  it('is free when the vehicle arrives with no excess speed', () => {
    expect(captureDeltaV(0, EARTH_RADIUS_M, MU_EARTH_SI, 0)).toBeCloseTo(
      escapeSpeed(EARTH_RADIUS_M, MU_EARTH_SI) - circularSpeed(EARTH_RADIUS_M, MU_EARTH_SI),
      3,
    );
  });
});

describe('parachuteTerminalVelocity', () => {
  it('lands a reference vehicle gently on Earth', () => {
    const v = parachuteTerminalVelocity(9.80665, 1.225);
    expect(v).toBeGreaterThan(8);
    expect(v).toBeLessThan(16);
  });

  it('explains why Mars needs engines: a chute alone is far too fast', () => {
    const mars = getDestination('mars')!;
    expect(terminalVelocity(mars)).toBeGreaterThan(40);
  });

  it('explains why Titan does not: a chute alone is a walking pace', () => {
    const titan = getDestination('titan')!;
    expect(terminalVelocity(titan)).toBeLessThan(5);
  });

  it('is infinite where there is no air', () => {
    const luna = getDestination('luna')!;
    expect(terminalVelocity(luna)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('destination catalogue', () => {
  it('has unique ids', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('derives surface gravity that matches the published figure', () => {
    const cases: [string, number][] = [
      ['mars', 3.72],
      ['luna', 1.62],
      ['venus', 8.87],
      ['mercury', 3.7],
      ['titan', 1.35],
      ['europa', 1.31],
      ['ceres', 0.28],
    ];
    for (const [id, expected] of cases) {
      const destination = getDestination(id)!;
      expect(surfaceGravity(destination), id).toBeCloseTo(expected, 1);
    }
  });

  it('is within a few percent of the quoted figure for the gas giants', () => {
    // A gas giant's quoted surface gravity is measured at the *equatorial*
    // radius, at the 1-bar level, and is reduced by a rotation fast enough to
    // matter. Deriving it from mass and mean radius — which is what keeps the
    // catalogue internally consistent — lands a few percent high, and that is
    // the honest number for the sphere the renderer and the physics both use.
    //
    // Saturn is the worst case at about 7%: it is the most oblate planet in the
    // solar system (60,268 km equatorial against 54,364 km polar) and turns
    // once every 10.7 hours, so equatorial and mean-radius gravity are simply
    // different quantities there rather than the same one measured twice.
    const cases: [string, number][] = [
      ['jupiter', 24.79],
      ['saturn', 10.44],
    ];
    for (const [id, quoted] of cases) {
      const derived = surfaceGravity(getDestination(id)!);
      expect(Math.abs(derived - quoted) / quoted, id).toBeLessThan(0.08);
    }
  });

  it('derives escape velocity that matches the published figure', () => {
    const cases: [string, number][] = [
      ['mars', 5030],
      ['luna', 2380],
      ['venus', 10_360],
      ['titan', 2640],
      ['ceres', 510],
    ];
    for (const [id, expected] of cases) {
      const destination = getDestination(id)!;
      expect(escapeVelocity(destination) / expected, id).toBeCloseTo(1, 1);
    }
  });

  it('derives a mean density consistent with what each body is made of', () => {
    // Rock is denser than ice, and both are far denser than a gas giant.
    expect(meanDensity(getDestination('mercury')!)).toBeGreaterThan(5000);
    expect(meanDensity(getDestination('europa')!)).toBeLessThan(3200);
    expect(meanDensity(getDestination('saturn')!)).toBeLessThan(1000);
  });

  it('gives Mars 38% of Earth gravity', () => {
    expect(earthGravityRatio(getDestination('mars')!)).toBeCloseTo(0.379, 2);
  });

  it('falls off as the inverse square of heliocentric distance', () => {
    expect(solarConstant(getDestination('mars')!)).toBeCloseTo(586, -1);
    expect(solarConstant(getDestination('jupiter')!)).toBeCloseTo(50, -1);
    // A moon gets the same sunlight as the planet it orbits.
    expect(solarConstant(getDestination('europa')!)).toBeCloseTo(
      solarConstant(getDestination('jupiter')!),
      3,
    );
  });

  it('gives Mars a light time of minutes, not seconds', () => {
    const minutes = lightTime_s(getDestination('mars')!) / 60;
    expect(minutes).toBeGreaterThan(3);
    expect(minutes).toBeLessThan(23);
  });
});

describe('designRequirements', () => {
  it('demands a heat shield at Mars and not at the Moon', () => {
    const marsIds = designRequirements(getDestination('mars')!).map((r) => r.id);
    const lunaIds = designRequirements(getDestination('luna')!).map((r) => r.id);
    expect(marsIds).toContain('heat-shield');
    expect(lunaIds).not.toContain('heat-shield');
    expect(lunaIds).toContain('landing-engine');
  });

  it('rules out hydrogen for the outer system but allows it for the Moon', () => {
    expect(viablePropellants(getDestination('luna')!.transferTime_s)).toContain('cryogenic');
    expect(viablePropellants(getDestination('saturn')!.transferTime_s)).not.toContain('cryogenic');
    expect(viablePropellants(getDestination('saturn')!.transferTime_s)).toContain('storable');
  });

  it('rules out solar power past Jupiter', () => {
    expect(viablePower(getDestination('mars')!)).toBe('solar');
    expect(viablePower(getDestination('jupiter')!)).toBe('solar_large_array');
    expect(viablePower(getDestination('saturn')!)).toBe('radioisotope');
  });

  it('demands autonomy wherever the light time exceeds a minute', () => {
    expect(designRequirements(getDestination('mars')!).map((r) => r.id)).toContain('autonomy');
    expect(designRequirements(getDestination('leo')!).map((r) => r.id)).not.toContain('autonomy');
  });

  it('demands radiation shielding at Europa', () => {
    expect(designRequirements(getDestination('europa')!).map((r) => r.id)).toContain('radiation');
  });
});

describe('assessMission', () => {
  it('lets a 9.8 km/s vehicle reach low orbit and nothing further', () => {
    const leo = assessMission(getDestination('leo')!, 9800);
    const mars = assessMission(getDestination('mars')!, 9800);
    expect(leo.reachable).toBe(true);
    expect(mars.reachable).toBe(false);
    expect(mars.marginDeltaV_ms).toBeLessThan(0);
  });

  it('makes Mars close on a heat shield that does not close propulsively', () => {
    const destination = getDestination('mars')!;
    // 14 km/s sits between the propulsive budget (~16.0) and the aerobraked one
    // (~13.9), which is exactly where the choice of arrival mode decides the
    // mission rather than merely trimming it.
    const assessment = assessMission(destination, 14_000);
    expect(assessment.requiredAerobraked_ms).toBeLessThan(assessment.requiredDeltaV_ms);
    expect(assessment.reachableWithAerobraking).toBe(true);
    expect(assessment.reachable).toBe(false);
  });

  it('costs more to stop at Mercury than to reach Saturn', () => {
    expect(totalDeltaV(getDestination('mercury')!)).toBeGreaterThan(
      totalDeltaV(getDestination('saturn')!),
    );
  });

  it('gives every heliocentric destination a transfer and Earth orbits none', () => {
    expect(transferFromEarth(getDestination('mars')!)).not.toBeNull();
    expect(transferFromEarth(getDestination('titan')!)).not.toBeNull();
    expect(transferFromEarth(getDestination('leo')!)).toBeNull();
    expect(transferFromEarth(getDestination('luna')!)).toBeNull();
  });
});
