# Simulation Assumptions and Approximations

Every approximation the flight simulation makes, and what each one costs.

This exists because approximate output is easy to present dishonestly. The
engine produces confident-looking numbers to two decimal places; this file is
what stops those numbers being mistaken for engineering truth.

**The simulation is educational. It is not flight-certified engineering
software, and no result it produces is a statement about a real vehicle.**

Where an assumption is stated below, it is stated because the code does it —
the file and function are named so a claim here can be checked against the
implementation.

---

## Frame and integration

| Assumption | Where | Consequence |
|---|---|---|
| **3 degrees of freedom.** Translation only. Attitude is *commanded*, never derived from moments. | `engine/guidance.py` | No rotational dynamics, no gimbal response, no control-loop lag. A vehicle that would tumble in reality flies its commanded attitude here. Static stability is computed by the builder and reported, but does not feed back into the trajectory. |
| **Launch-centred ENU frame**, axes fixed at T=0. | `models/frames.py` | Valid for Newtonian integration under the non-rotating-Earth assumption. Orbital elements are converted to ECI-aligned axes first, because inclination measured against the launch site's horizon is meaningless. |
| **RK4 by default**, fixed step. 0.05 s powered, 0.5 s vacuum coast. | `models/integrator.py` | Global error O(dt⁴) — far below the fidelity of the force models feeding it. Euler and velocity Verlet are selectable; Euler is offered as a teaching contrast, not as a serious option. |
| **Mass is not in the integrator state.** Propellant flow is constant across a step, so m(t) is exactly linear and is evaluated analytically at each substep. | `models/integrator.py`, `engine/runner.py` | Operator splitting where the split is exact. Folding mass into the RK4 state would add error, not remove it. |
| **Fine timestep inside the atmosphere**, even unpowered. | `engine/runner.py` | Without it a descending vehicle jumps tens of metres past the ground between coast steps and impact is registered late. |

## Gravity

| Assumption | Where | Consequence |
|---|---|---|
| **Spherical Earth**, R = 6,371,000 m. No WGS-84 flattening. | `models/constants.py` | Geodetic and geocentric latitude are treated as equal. Sub-percent effect at these fidelities. |
| **Point-mass inverse-square field.** No J2. | `models/gravity.py` | No nodal regression, no apsidal precession. An orbit here does not drift the way a real one does. Irrelevant over a single ascent; wrong over days. |
| **No third bodies.** No lunar or solar gravity. | — | The *integrator* models Earth-orbit flight only and still cannot fly a transfer to another body. Missions to other destinations are handled outside it, in closed form — see [Destinations and transfers](#destinations-and-transfers). |
| **Non-rotating Earth.** | `models/frames.py` | **The largest single omission.** A real eastward equatorial launch gains roughly 465 m/s from Earth's rotation, and about 410 m/s from Cape Canaveral. This engine gives none of it, so an ascent here needs *more* delta-v than the real thing. Launch-site latitude still sets achievable inclination. |

## Atmosphere

| Assumption | Where | Consequence |
|---|---|---|
| **US Standard Atmosphere 1976**, 7-layer piecewise model, 0–86 km. | `models/atmosphere.py` | A static average profile. No weather, no seasonal variation, no latitude variation, no day-to-day pressure change. |
| **Exponential decay above 86 km**, 6.5 km scale height. | `models/atmosphere.py` | Rough, and deliberately so: drag is negligible above ~100 km, so the error does not reach the trajectory. |
| **Geopotential altitude conversion applied.** | `models/atmosphere.py` | Neglecting it costs ~0.3% density error at 80 km. |
| **Wind is not applied to the trajectory.** | — | `wind_speed_ms` is accepted in the configuration and carried through to telemetry metadata, but the force model does not use it. Stated here rather than quietly ignored. |

## Aerodynamics

| Assumption | Where | Consequence |
|---|---|---|
| **One drag coefficient per vehicle**, from the assembled stack. | `core/builder.ts` | No per-component drag build-up, no interference effects. |
| **Shape-agnostic Mach curve**: 1.0 below M 0.8, rising linearly to 2.5× at M 1.2, decaying to a 1.1× floor by M 5. | `models/drag.py` | **Not wind-tunnel data.** It is a piecewise-linear educational curve. It captures the transonic drag rise that makes max-Q happen where it does; it does not describe any particular airframe. |
| **No angle-of-attack dependence.** Drag is anti-parallel to velocity regardless of attitude. | `models/drag.py` | Angle of attack is computed and reported in telemetry, and is not fed back into the aerodynamic forces. A vehicle flying sideways pays no penalty here. |
| **No lift.** | — | Fins provide stability in the builder's analysis, not aerodynamic force in flight. |

## Propulsion

| Assumption | Where | Consequence |
|---|---|---|
| **Thrust and Isp interpolate linearly with ambient pressure** between sea-level and vacuum values. | `models/thrust.py` | The real relationship is close to linear over the relevant range. Good enough that altitude compensation is visible in the data. |
| **Mass flow from actual Isp**: ṁ = F/(Isp·g₀). | `models/thrust.py` | Burn time is a consequence of the engine and propellant load, not a configured number. |
| **No throttling.** An engine is on at full thrust or off. | `engine/runner.py` | Real vehicles throttle through max-Q; here you avoid a structural failure by designing for it, not by flying around it. |
| **No engine start/shutdown transient.** Thrust is a step function. | `engine/runner.py` | The first two seconds of a real ascent are not like this. The insufficient-TWR rule allows for it by waiting 2 s before firing. |
| **No ullage, no restart limits, no propellant settling.** | — | An upper stage always relights. |

## Staging

| Assumption | Where | Consequence |
|---|---|---|
| **Separation is instantaneous** after a configured delay. | `engine/runner.py` | No separation dynamics, no collision, no residual thrust. |
| **A spent stage vanishes.** Its dry mass leaves the vehicle at separation. | `engine/runner.py` | No tracking of the discarded stage. |
| **Payload mass is inside stage dry mass**, not added separately. | `engine/runner.py` | Matches `core/vehicle.ts`. `payload_mass_kg` is reported for information only; adding it again would inflate launch mass and can push a healthy vehicle's TWR below 1. |

## Guidance

| Assumption | Where | Consequence |
|---|---|---|
| **Three programs**: vertical, pitch program (scheduled on altitude), gravity turn. | `engine/guidance.py` | The pitch program is linear in altitude, not time, so it does not depend on how fast the vehicle happens to be climbing. |
| **A gravity turn needs a real kick** — 12° by default, ramped across a band. | `engine/guidance.py` | Thrust held exactly along a vertical velocity vector produces no turning at all. A 1–2° kick leaves the vehicle climbing nearly straight up while gravity bends it far too slowly. |
| **Cutoff on target orbit** when the osculating orbit clears the atmosphere and the apoapsis reaches the target. | `engine/runner.py` | What real guidance computers do. Without it an over-performing vehicle burns its whole load into a wildly elliptical orbit instead of the circular one the mission asked for. |
| **No steering losses modelled separately.** | — | They appear implicitly, as the difference between ideal and achieved Δv. |

## Orbital mechanics

| Assumption | Where | Consequence |
|---|---|---|
| **Two-body osculating elements.** | `models/orbital.py` | Read as "the orbit you would coast into from here", not as a prediction. During powered flight they change every step. |
| **Reported only above 100 km.** | `engine/runner.py` | Below the Kármán line the two-body solution describes a trajectory that intersects the ground and drag dominates anyway. The numbers would be noise. |
| **"Stable orbit" means closed and clear of the surface.** No atmospheric-decay margin. | `models/orbital.py` | A 100 km "orbit" here is stable; a real one would decay within days. |

## Destinations and transfers

A mission now has a destination — the Moon, Mars, Titan, and so on — and the
interface reports what reaching it costs. **None of that is integrated.** The
integrator flies the ascent to a parking orbit and stops, exactly as before.
Everything above that orbit is solved analytically, and the split is worth
stating plainly because the two halves have very different standing: the ascent
is a numerical trajectory, and the transfer is a textbook estimate.

| Assumption | Where | Consequence |
|---|---|---|
| **Patched conics.** The transfer is treated as three separate two-body problems — Earth, then Sun, then the target — joined at their spheres of influence. | `physics/transfer.ts` | The standard first-cut method in real mission design. It ignores the gradual handover between gravity wells, which is worth a few tens of m/s on a departure. |
| **Hohmann transfers only.** Two impulses, between circular coplanar orbits. | `physics/transfer.ts::hohmannTransfer` | The cheapest such transfer, and therefore a *lower bound* on Δv and an *upper bound* on trip time. Every real mission does better on one axis by spending on the other. |
| **Circular, coplanar planetary orbits.** Real eccentricity and inclination are stored on each destination but are not used by the transfer solver. | `core/destinations.ts` | Mars's eccentricity of 0.093 makes real windows vary by several hundred m/s between oppositions. The figure here is the average, not the good year or the bad one. |
| **No gravity assists.** | — | The single largest omission here. MESSENGER reached Mercury on far less Δv than the direct budget below, using six flybys over 6.6 years. The quoted Mercury figure is what a direct transfer costs, which is why it exceeds Saturn's. |
| **Δv budgets are published reference figures**, not solver output. Each leg is a catalogued constant with its rationale attached. | `core/destinations.ts` | These are the standard mission-design numbers. They are a target to clear, not a prediction of a specific flight, and the interface says so wherever they appear. |
| **Impulsive burns.** No finite-burn losses. | `physics/transfer.ts` | A real capture burn lasting tens of minutes loses 1–3% to steering and gravity while it fires. |
| **Aerocapture is modelled as free.** A leg marked aerobrakeable costs zero Δv if flown on a heat shield. | `core/destinations.ts` | It is not free in reality: it costs heat-shield mass, and it is far riskier than a burn. The trade is shown as Δv-against-thermal-protection because that is the decision, but the mass penalty is not modelled. |
| **Arrival environment is not simulated.** Surface gravity, atmosphere, temperature and terminal velocity are *reported* from published parameters; no landing is flown. | `core/mission-planning.ts` | The parachute terminal velocity quoted for each destination is `√(2βg/ρ)` for a reference ballistic coefficient of 10 kg/m², which is representative of a real entry vehicle but is not the user's vehicle. |
| **Launch windows are stated, never enforced.** The synodic period and departure phase angle are computed and shown; the simulation does not require you to launch in one. | `core/mission-planning.ts` | You can fly a Mars mission on any date here. Reality would make you wait up to 26 months. |
| **Ascent Δv is estimated as circular speed plus a flat 1,800 m/s** for gravity, drag and steering losses. | `core/destinations.ts::ascentDeltaV` | The middle of the real range for a launch to low Earth orbit. Your actual ascent losses come out of the integrated flight, and will differ. |

The destination catalogue's *physical* data — radii, masses, rotation periods,
atmospheres, temperatures, orbital elements — are published bulk parameters from
NASA's planetary fact sheets and JPL Solar System Dynamics. Derived quantities
(surface gravity, escape velocity, mean density, solar irradiance) are computed
from those rather than stored, so they cannot disagree with their own inputs.

One consequence of deriving rather than storing: for the gas giants the surface
gravity computed from mass and mean radius runs a few percent above the quoted
figure, because the published value is measured at the *equatorial* radius at the
1-bar level and is reduced by rotation. Saturn is the worst case at about 7%.
Both numbers are correct for what they describe; the derived one is the one that
is consistent with the sphere the renderer and the physics use.

## Failures

| Assumption | Where | Consequence |
|---|---|---|
| **Four detection rules**: insufficient liftoff TWR, dynamic pressure over the airframe limit, g-load over the configured maximum, aerodynamic heating (a speed-and-altitude threshold). | `engine/failures.py` | Matches the TypeScript engine's rule set. |
| **Heating is a threshold, not a temperature.** | `engine/failures.py` | No thermal model exists. Nothing computes skin temperature, heat flux or thermal mass. The rule stands in for a real thermal analysis and says so in its own explanation text. |
| **Structural limits are set by the weakest component.** | `core/vehicle.ts` | A stack is only as strong as the part that gives way first. No load-path analysis. |
| **Injected failures are deterministic**, seeded LCG, never `random`. | `engine/failures.py` | Two runs of the same config produce byte-identical failure sequences. |
| **A modelled failure is not a real accident.** | — | The engine can tell you a vehicle with this TWR will not lift off. It cannot tell you why any particular real launch failed, and never claims to. |

## Determinism

A run is a pure function of its configuration. No wall-clock reads, no `random`,
no iteration over unordered collections. `simulation/tests/test_flight_physics.py`
asserts that identical configs produce identical telemetry and identical events.

This matters for a teaching tool: "change one thing and see what happens"
requires that everything else stayed the same.

---

## Cross-validation

The Python engine is checked against the independently written TypeScript engine
(`packages/simulation-engine`, 570 tests) by flying the same reference vehicles
through both and comparing. `simulation/tests/test_cross_engine.py`.

Agreement on a two-stage orbital ascent, burning to depletion:

| Quantity | Difference |
|---|---|
| Max altitude | +0.3% |
| Max speed | −0.0% |
| Max g-load | −0.1% |
| Max dynamic pressure | −0.1% |
| Max-Q altitude | +0.3% |
| Propellant used | 0.0% |
| Ideal Δv | exact |
| Gravity loss | +0.0% |
| Drag loss | −0.1% |

Two implementations agreeing is not proof either is right — they share model
*definitions*, and a wrong shared definition would agree beautifully. What it
does establish is that neither has drifted, and that the numbers are not an
artifact of one implementation's bugs.

The tolerance is 2%. The engines do not share step sequencing, so exact
agreement is neither expected nor required.

---

## What would change if this were made rigorous

In rough order of how much each would alter the answer:

1. **Earth rotation** — worth ~410 m/s at Cape Canaveral. The single largest
   error in the model.
2. **6-DOF with a real control loop** — would make stability margin matter to
   the trajectory instead of being advisory.
3. **Throttling** — would let a vehicle survive max-Q by flying around it.
4. **Angle-of-attack-dependent aerodynamics** — would penalise bad guidance.
5. **J2** — matters over orbits, not over an ascent.
6. **A thermal model** — would replace a threshold with physics.

None of these are needed for the product's purpose, which is to make the
relationships between mass, thrust, Isp, drag and trajectory legible. All of
them would be needed before anyone called a number here an engineering result.
