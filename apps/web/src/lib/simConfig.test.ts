import { describe, expect, it } from 'vitest';
import { createStockRegistry } from '@lostintospace/simulation-engine/core/catalog';
import { addComponent, addStage, createRocket } from '@lostintospace/simulation-engine/core/rocket-design';
import { analyzeRocket } from '@lostintospace/simulation-engine/core/builder';
import { vehicleFromAnalysis } from '@lostintospace/simulation-engine/core/vehicle';

import { getDestination, totalDeltaV } from '@lostintospace/simulation-engine/core/destinations';

import {
  LAUNCH_SITES,
  ascentForDestination,
  buildSimConfig,
  toSimVehicle,
} from './simConfig';

/**
 * The Python/TypeScript boundary.
 *
 * This translation is the single point where a field rename in either engine
 * silently breaks the product: the builder would keep working, the simulation
 * would keep working, and the request between them would fail validation. These
 * tests assert the mapping against a vehicle the real builder produced, not a
 * hand-written fixture, so a change to either side is caught here.
 */

const registry = createStockRegistry();

function referenceVehicle() {
  let design = createRocket('Test Launcher', 'For the boundary tests');
  design = addStage(design, 'First Stage');
  design = addStage(design, 'Second Stage');

  for (const id of ['engine_m_booster', 'tank_m_fuel', 'tank_m_ox', 'decoupler_m']) {
    design = addComponent(design, registry, id, 0);
  }
  for (const id of ['engine_m_vacuum', 'tank_m_upper_fuel', 'payload_smallsat', 'nose_m_fairing']) {
    design = addComponent(design, registry, id, 1);
  }

  return vehicleFromAnalysis(analyzeRocket(design, registry), design);
}

describe('toSimVehicle', () => {
  const vehicle = referenceVehicle();
  const converted = toSimVehicle(vehicle);

  it('carries every stage across', () => {
    expect(converted.stages).toHaveLength(vehicle.stages.length);
  });

  it('preserves the numbers exactly', () => {
    expect(converted.launch_mass_kg).toBe(vehicle.launchMass_kg);
    expect(converted.reference_area_m2).toBe(vehicle.referenceArea_m2);
    expect(converted.drag_coefficient).toBe(vehicle.dragCoefficient);
    expect(converted.stages[0].thrust_sea_level_N).toBe(vehicle.stages[0].thrustSeaLevel_N);
    expect(converted.stages[0].isp_vacuum_s).toBe(vehicle.stages[0].ispVacuum_s);
    expect(converted.stages[0].propellant_mass_kg).toBe(vehicle.stages[0].propellantMass_kg);
  });

  it('produces only snake_case keys the API accepts', () => {
    const camel = Object.keys(converted).filter((key) => /[a-z][A-Z]/.test(key));
    expect(camel).toEqual([]);
  });

  it('replaces infinite structural limits with finite numbers', () => {
    // The builder leaves these as Infinity for a design that declares no limit.
    // Infinity serialises to null, which then fails Pydantic validation — so a
    // vehicle with no rated limit must arrive as a number large enough never to
    // trigger, not as a missing field.
    expect(Number.isFinite(converted.max_axial_load_N)).toBe(true);
    expect(Number.isFinite(converted.max_dynamic_pressure_Pa)).toBe(true);
  });

  it('survives a JSON round trip with no lost fields', () => {
    const round = JSON.parse(JSON.stringify(converted));
    expect(round).toEqual(converted);
    expect(JSON.stringify(converted)).not.toContain('null');
  });
});

describe('buildSimConfig', () => {
  const vehicle = referenceVehicle();

  const orbital = buildSimConfig({
    vehicle,
    missionName: 'LEO test',
    objective: 'Reach 200 km',
    targetAltitudeKm: 200,
    missionType: 'leo',
    launchSite: LAUNCH_SITES[0],
    guidanceMode: 'pitch_program',
  });

  const hop = buildSimConfig({
    vehicle,
    missionName: 'Hop',
    objective: 'Reach 100 km',
    targetAltitudeKm: 100,
    missionType: 'suborbital',
    launchSite: LAUNCH_SITES[0],
    guidanceMode: 'vertical',
  });

  it('includes the parts the API requires', () => {
    expect(orbital.vehicle).toBeDefined();
    expect(orbital.mission).toBeDefined();
    expect(orbital.mission.target.target_altitude_km).toBe(200);
    expect(orbital.mission.launch_site.name).toBe(LAUNCH_SITES[0].name);
  });

  it('scales the pitch program to the target altitude', () => {
    // A program that flattens out at a fixed altitude is right for one orbit
    // and wrong for another; tying it to the target keeps both sensible.
    expect(orbital.guidance!.pitch_program_end_altitude_m!).toBeGreaterThan(
      hop.guidance!.pitch_program_end_altitude_m!,
    );
  });

  it('only commands orbital cutoff for orbital missions', () => {
    expect(orbital.guidance!.cutoff_on_target_orbit).toBe(true);
    expect(hop.guidance!.cutoff_on_target_orbit).toBe(false);
  });

  it('gives an orbital mission a longer time window than a hop', () => {
    expect(orbital.settings!.max_time_s!).toBeGreaterThan(hop.settings!.max_time_s!);
  });

  it('takes the inclination from the launch site latitude', () => {
    expect(orbital.mission.target.inclination_deg).toBe(LAUNCH_SITES[0].latitude_deg);
  });

  it('stays inside the API request limits', () => {
    // Mirrors apps/api/src/schemas/simulation.py — a config the UI builds must
    // never be rejected by the server's own caps.
    expect(orbital.settings!.max_time_s!).toBeLessThanOrEqual(7200);
    expect(orbital.settings!.dt_powered_s!).toBeGreaterThanOrEqual(0.001);
    expect(orbital.vehicle.stages.length).toBeLessThanOrEqual(10);
  });
});

describe('launch sites', () => {
  it('uses real coordinates', () => {
    for (const site of LAUNCH_SITES) {
      expect(site.latitude_deg).toBeGreaterThanOrEqual(-90);
      expect(site.latitude_deg).toBeLessThanOrEqual(90);
      expect(site.longitude_deg).toBeGreaterThanOrEqual(-180);
      expect(site.longitude_deg).toBeLessThanOrEqual(180);
      expect(site.altitude_m).toBeGreaterThanOrEqual(0);
    }
  });

  it('records a non-zero elevation somewhere', () => {
    // The engine measures the ground from the pad, not from sea level. A set of
    // sites all at 0 m would let that regress unnoticed.
    expect(LAUNCH_SITES.some((site) => site.altitude_m > 0)).toBe(true);
  });
});


describe('destinations on the wire', () => {
  const vehicle = referenceVehicle();

  const configFor = (destinationId?: string) =>
    buildSimConfig({
      vehicle,
      missionName: 'Test',
      objective: 'Test',
      targetAltitudeKm: 200,
      missionType: 'leo',
      destinationId,
      launchSite: LAUNCH_SITES[0]!,
      guidanceMode: 'pitch_program',
    });

  it('carries the destination and its budget onto the mission target', () => {
    const target = configFor('mars').mission.target;
    expect(target.destination_id).toBe('mars');
    expect(target.destination_name).toBe('Mars');
    expect(target.destination_delta_v_ms).toBe(totalDeltaV(getDestination('mars')!));
    expect(target.transfer_time_s).toBe(getDestination('mars')!.transferTime_s);
  });

  it('omits the destination fields entirely when there is none', () => {
    const target = configFor(undefined).mission.target;
    expect(target.destination_id).toBeUndefined();
    expect(target.destination_delta_v_ms).toBeUndefined();
  });

  it('degrades to no destination rather than breaking on an unknown id', () => {
    // A saved mission referencing a destination since renamed must still fly.
    const target = configFor('a-place-that-does-not-exist').mission.target;
    expect(target.destination_id).toBeUndefined();
    expect(target.target_altitude_km).toBe(200);
  });

  it('leaves the ascent physics untouched by the destination', () => {
    // The destination changes what the flight is *for*, never how it is flown.
    const withMars = configFor('mars');
    const without = configFor(undefined);
    expect(withMars.vehicle).toEqual(without.vehicle);
    expect(withMars.settings).toEqual(without.settings);
    expect(withMars.guidance).toEqual(without.guidance);
  });
});

describe('ascentForDestination', () => {
  it('targets the parking orbit the transfer departs from', () => {
    const mars = ascentForDestination(getDestination('mars')!);
    expect(mars.targetAltitudeKm).toBe(200);
    expect(mars.objective).toContain('Mars');
  });

  it('never picks a suborbital profile, which cannot begin a transfer', () => {
    for (const id of ['leo', 'gto', 'luna', 'mars', 'titan', 'sol']) {
      const ascent = ascentForDestination(getDestination(id)!);
      expect(ascent.missionType, id).not.toBe('suborbital');
      expect(ascent.guidanceMode, id).not.toBe('vertical');
    }
  });

  it('follows the destination to a higher parking orbit where it needs one', () => {
    expect(ascentForDestination(getDestination('leo')!).targetAltitudeKm).toBe(400);
    expect(ascentForDestination(getDestination('gto')!).targetAltitudeKm).toBe(200);
  });
});
