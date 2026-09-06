"""The Indian space programme in the object catalog.

ISRO's record belongs in a space-education product on merit, not as a gesture.
It contains several results that are genuinely first-of-kind — the confirmation
of water on the Moon, the only Mars mission anywhere to succeed on its first
attempt, the first landing near the lunar south pole, and a record for the most
satellites launched on a single rocket that stood for years — and a cost
discipline that is itself an engineering lesson: Mangalyaan reached Mars orbit
for less than the production budget of a film about going to Mars.

It also matters for what this product is *for*. A student in Sriharikota or
Bengaluru learning orbital mechanics should find their own space agency in the
catalogue, with the same rigour applied to it as to NASA's.

Records here are held to exactly the same standard as everything else: published
figures from ISRO mission pages and agency releases, cited, with nothing rounded
into a claim the source does not make. Where no verified photograph exists the
object carries none and falls through to the procedural renderer.

Python floor for this tree is 3.9: use ``Optional[X]`` and ``List[X]``.
"""

from datetime import datetime, timezone
from typing import List

from contracts.provenance import SourceReference, SourceType

from ._helpers import prop, text_prop
from .models import Appearance, CatalogObject, ObjectKind, SurfaceTexture

__all__ = ["indian_space_objects", "INDIAN_SPACE_IDS", "ISRO"]

_T = SurfaceTexture
_RETRIEVED = datetime(2026, 9, 6, tzinfo=timezone.utc)

#: The Indian Space Research Organisation.
ISRO = SourceReference(
    source_name="ISRO",
    source_type=SourceType.BUNDLED_REFERENCE,
    source_url="https://www.isro.gov.in/",
    retrieved_at=_RETRIEVED,
    attribution="Indian Space Research Organisation, Department of Space, Government of India",
)

#: NASA pages covering joint missions and instruments carried on ISRO craft.
NASA_ISRO = SourceReference(
    source_name="NASA — joint missions with ISRO",
    source_type=SourceType.BUNDLED_REFERENCE,
    source_url="https://science.nasa.gov/",
    retrieved_at=_RETRIEVED,
    attribution="NASA Science Mission Directorate",
)

_SRC = [ISRO]
_JOINT = [ISRO, NASA_ISRO]


def indian_space_objects() -> List[CatalogObject]:
    """ISRO missions, satellites and launch vehicles."""
    return _lunar() + _planetary() + _earth_observation() + _launch_vehicles()


def _lunar() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="chandrayaan-1",
            name="Chandrayaan-1",
            kind=ObjectKind.SPACECRAFT,
            parent_id="luna",
            classification="Lunar orbiter",
            tagline="India's first mission beyond Earth orbit, and the one that found water on the Moon.",
            overview=(
                "Launched in October 2008 on a PSLV, Chandrayaan-1 carried eleven instruments from "
                "six space agencies into lunar orbit. The most consequential was NASA's Moon "
                "Mineralogy Mapper, which detected the spectral signature of water and hydroxyl "
                "across the lunar surface — overturning the long-standing assumption that the Moon "
                "was bone dry, and reframing every subsequent plan for lunar exploration, since "
                "water means propellant and breathable oxygen that need not be launched from "
                "Earth. The mission also released an impactor that struck near the south pole and "
                "confirmed water in the ejecta."
            ),
            physical=[
                prop("Launch mass", 1380, "kg"),
                prop("Dry mass", 675, "kg"),
                prop("Power", 700, "W"),
                prop("Instruments", 11, note="From India, NASA, ESA, Bulgaria and Sweden"),
            ],
            orbital=[
                text_prop("Launch", "22 October 2008, PSLV-XL C11 from Satish Dhawan Space Centre"),
                prop("Operational orbit", 100, "km", note="Polar lunar orbit"),
                text_prop("Mission end", "August 2009, after 312 days — 3,400 orbits"),
            ],
            facts=[
                "The Moon Mineralogy Mapper found water and hydroxyl across the surface, including in sunlit regions where nobody expected it.",
                "The Moon Impact Probe made India the fourth nation to place an object on the lunar surface.",
                "Designed for two years, it operated for ten months before losing thermal control — but returned 95% of its planned science.",
                "It cost about ₹386 crore, roughly 80 million US dollars.",
            ],
            related_ids=["luna", "chandrayaan-3", "pslv"],
            concept_slugs=["gravity"],
            appearance=Appearance(
                base_color="#B9BDC2",
                accent_color="#E4682E",
                radius_km=0.0015,
                texture=_T.ENGINEERED,
                albedo=0.6,
            ),
            sources=_JOINT,
        ),
        CatalogObject(
            id="chandrayaan-2",
            name="Chandrayaan-2",
            kind=ObjectKind.SPACECRAFT,
            parent_id="luna",
            classification="Lunar orbiter, lander and rover",
            tagline="The lander was lost. The orbiter is still working, and it found the landing site for the next one.",
            overview=(
                "Chandrayaan-2 attempted an orbiter, a lander and a rover together in 2019. The "
                "Vikram lander lost attitude control during its final braking phase and was "
                "destroyed on impact, two kilometres from its target. The orbiter, however, "
                "reached its orbit successfully and has been returning data ever since — its "
                "high-resolution camera is the sharpest ever flown to the Moon, and it mapped the "
                "terrain that Chandrayaan-3 later landed on. Its failure analysis directly shaped "
                "that success, which is the ordinary way engineering progresses and worth stating "
                "plainly rather than glossing over."
            ),
            physical=[
                prop("Launch mass", 3850, "kg"),
                prop("Orbiter mass", 2379, "kg"),
                prop("Lander mass", 1471, "kg", note="Vikram, lost on descent"),
                prop("Rover mass", 27, "kg", note="Pragyan, carried by Vikram"),
                prop("Camera resolution", 0.25, "m", note="Highest resolution of any lunar orbiter"),
            ],
            orbital=[
                text_prop("Launch", "22 July 2019, GSLV Mk III M1"),
                prop("Orbiter orbit", 100, "km", note="Polar"),
                text_prop("Lander outcome", "Lost during powered descent, 6 September 2019"),
            ],
            facts=[
                "The orbiter carries the highest-resolution camera ever sent to the Moon, at 25 cm per pixel.",
                "It was designed for one year and is still operating well beyond that, relaying data for later missions.",
                "Its terrain mapping is what allowed Chandrayaan-3 to pick and verify a safe landing site.",
            ],
            related_ids=["chandrayaan-1", "chandrayaan-3", "luna", "gslv-mk3"],
            appearance=Appearance(
                base_color="#B9BDC2",
                accent_color="#D9A441",
                radius_km=0.0032,
                texture=_T.ENGINEERED,
                albedo=0.6,
            ),
            sources=_SRC,
        ),
        CatalogObject(
            id="vikram-lander",
            name="Vikram",
            designation="Chandrayaan-3 lander module",
            kind=ObjectKind.SPACECRAFT,
            parent_id="luna",
            classification="Lunar lander",
            tagline="The first spacecraft ever to land near the lunar south pole.",
            overview=(
                "On 23 August 2023 Vikram touched down at 69.4° south, closer to the lunar south "
                "pole than anything before it, making India the fourth country to land on the Moon "
                "and the first to land in that region. The south pole matters because its "
                "permanently shadowed craters hold water ice — the resource that makes a sustained "
                "lunar presence arithmetically possible instead of merely aspirational. The "
                "lander is named for Vikram Sarabhai, who founded the Indian space programme."
            ),
            physical=[
                prop("Landing mass", 1749, "kg", note="Including the Pragyan rover"),
                prop("Power", 738, "W"),
                prop("Landing latitude", -69.37, "°", note="Closer to the pole than any previous landing"),
                prop("Touchdown velocity", 1.68, "m/s", note="Vertical, within a 2 m/s limit"),
            ],
            orbital=[
                text_prop("Launch", "14 July 2023, LVM3 M4"),
                text_prop("Landing", "23 August 2023, Shiv Shakti Point"),
                text_prop("Mission life", "One lunar day — about 14 Earth days"),
            ],
            facts=[
                "It performed a hop after landing, lifting 40 cm and setting down again — a rehearsal for a future sample-return ascent.",
                "The ChaSTE probe measured the lunar soil temperature profile directly, finding a far steeper gradient than models predicted.",
                "It cost about ₹615 crore, roughly 75 million US dollars — less than many feature films.",
            ],
            related_ids=["pragyan-rover", "chandrayaan-2", "luna"],
            appearance=Appearance(
                base_color="#C8B48E",
                accent_color="#E4682E",
                radius_km=0.002,
                texture=_T.ENGINEERED,
                albedo=0.55,
            ),
            sources=_SRC,
        ),
        CatalogObject(
            id="pragyan-rover",
            name="Pragyan",
            designation="Chandrayaan-3 rover",
            kind=ObjectKind.SPACECRAFT,
            parent_id="luna",
            classification="Lunar rover",
            tagline="A 26-kilogram rover that confirmed sulphur in the lunar south-pole soil.",
            overview=(
                "Pragyan — Sanskrit for wisdom — rolled off the Vikram lander's ramp hours after "
                "touchdown and covered about a hundred metres over one lunar day. Its two "
                "spectrometers made the first in-situ elemental measurements of the south polar "
                "region, confirming sulphur and detecting aluminium, calcium, iron, chromium and "
                "titanium. It was not built to survive the lunar night, where temperatures fall "
                "below 100 K, and did not wake again."
            ),
            physical=[
                prop("Mass", 26, "kg"),
                prop("Power", 50, "W", note="Solar"),
                prop("Distance travelled", 101.4, "m"),
                prop("Speed", 0.01, "m/s", note="1 cm/s"),
                prop("Operational life", 14, "days", note="One lunar day"),
            ],
            facts=[
                "It confirmed sulphur in the south polar regolith by direct measurement — something no orbiter could settle.",
                "Its six wheels stamped the ISRO logo and the Indian national emblem into the regolith with every rotation.",
                "There is no wind or water on the Moon, so those tracks will remain for millions of years.",
            ],
            related_ids=["vikram-lander", "luna", "perseverance"],
            appearance=Appearance(
                base_color="#B5AFA3",
                accent_color="#8FB573",
                radius_km=0.0005,
                texture=_T.ENGINEERED,
                albedo=0.5,
            ),
            sources=_SRC,
        ),
    ]


def _planetary() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="mangalyaan",
            name="Mangalyaan",
            designation="Mars Orbiter Mission (MOM)",
            kind=ObjectKind.SPACECRAFT,
            parent_id="mars",
            classification="Mars orbiter",
            tagline="The only Mars mission anywhere to succeed on its first attempt.",
            overview=(
                "Roughly half of all missions sent to Mars have failed, and no agency had ever "
                "arrived on its first try — not NASA, not the Soviet Union, not ESA. India did, in "
                "September 2014, for about 74 million US dollars. The cost is not a curiosity but "
                "a consequence of the engineering: a light 15 kg instrument payload, a modular "
                "spacecraft reusing proven components, and a launch on the modest PSLV, which "
                "meant the orbiter had to raise its own orbit over six progressive burns before it "
                "could depart for Mars at all. Designed for six months, it operated for eight "
                "years."
            ),
            physical=[
                prop("Launch mass", 1337, "kg"),
                prop("Dry mass", 482, "kg"),
                prop("Propellant", 852, "kg", note="Most of the launch mass"),
                prop("Payload mass", 15, "kg", note="Five instruments"),
                prop("Power", 840, "W"),
            ],
            orbital=[
                text_prop("Launch", "5 November 2013, PSLV-XL C25"),
                text_prop("Mars orbit insertion", "24 September 2014"),
                prop("Periapsis", 421.7, "km"),
                prop("Apoapsis", 76_993.6, "km"),
                prop("Orbital period", 72.0, "hours"),
                text_prop("Mission end", "Contact lost in April 2022, after eight years"),
            ],
            facts=[
                "It cost about ₹450 crore — roughly 74 million US dollars, less than many films about space travel.",
                "The PSLV could not send it directly, so it spent a month raising its orbit around Earth in six burns before departure.",
                "Its Mars Colour Camera returned full-disc images of Mars that few other orbiters could, because its orbit was so elongated.",
                "Designed for six months. It worked for eight years.",
            ],
            related_ids=["mars", "pslv", "chandrayaan-1"],
            concept_slugs=["gravity"],
            appearance=Appearance(
                base_color="#D9A441",
                accent_color="#B4552F",
                radius_km=0.0015,
                texture=_T.ENGINEERED,
                albedo=0.6,
            ),
            sources=_SRC,
        ),
        CatalogObject(
            id="aditya-l1",
            name="Aditya-L1",
            kind=ObjectKind.SPACECRAFT,
            parent_id="sol",
            classification="Solar observatory at Sun–Earth L1",
            tagline="India's first solar observatory, parked where it can watch the Sun without interruption.",
            overview=(
                "Aditya-L1 sits in a halo orbit around the first Sun–Earth Lagrange point, 1.5 "
                "million kilometres sunward, where the gravity of the two bodies and the orbital "
                "motion balance. The value of that location is uninterrupted viewing: no eclipse, "
                "no night, no atmosphere. Its seven instruments study the photosphere, the "
                "chromosphere and the corona, and it carries the first Indian coronagraph capable "
                "of observing the corona from as close as 1.05 solar radii — closer to the disc "
                "than any comparable instrument."
            ),
            physical=[
                prop("Launch mass", 1475, "kg"),
                prop("Payload mass", 244, "kg", note="Seven instruments"),
                prop("Distance from Earth", 1.5e6, "km", note="At Sun–Earth L1, about 1% of the way to the Sun"),
                prop("Mission life", 5.2, "years"),
            ],
            orbital=[
                text_prop("Launch", "2 September 2023, PSLV-C57"),
                text_prop("L1 insertion", "6 January 2024, after a 127-day cruise"),
                text_prop("Orbit", "Halo orbit about the L1 point"),
            ],
            facts=[
                "L1 is not a place you can simply sit: the point is unstable, and the spacecraft has to make small corrections indefinitely.",
                "Its VELC coronagraph observes the corona from 1.05 solar radii, closer to the disc than any other instrument in operation.",
                "From L1 the Sun is never occulted by Earth, so the observation record has no gaps.",
            ],
            related_ids=["sol", "parker-solar-probe", "pslv"],
            concept_slugs=["gravity"],
            appearance=Appearance(
                base_color="#FFCF87",
                accent_color="#E4682E",
                radius_km=0.0015,
                texture=_T.ENGINEERED,
                albedo=0.65,
            ),
            sources=_SRC,
        ),
    ]


def _earth_observation() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="nisar",
            name="NISAR",
            designation="NASA-ISRO Synthetic Aperture Radar",
            kind=ObjectKind.SATELLITE,
            parent_id="earth",
            classification="Earth-observation radar satellite",
            tagline="The most expensive Earth-imaging satellite ever built, and a joint NASA–ISRO mission.",
            overview=(
                "NISAR carries two synthetic-aperture radars — an L-band from NASA and an S-band "
                "from ISRO — on a shared bus, behind a twelve-metre deployable mesh reflector. "
                "Radar sees through cloud and works at night, so unlike an optical satellite it "
                "images the same ground every twelve days regardless of weather. It measures "
                "changes in the Earth's surface down to about a centimetre, which is what makes it "
                "useful for ice-sheet motion, subsidence, earthquake deformation, and the loss of "
                "forest and wetland."
            ),
            physical=[
                prop("Launch mass", 2800, "kg"),
                prop("Reflector diameter", 12, "m", note="Deployable wire mesh"),
                prop("Swath width", 240, "km"),
                prop("Ground resolution", 5, "m"),
                prop("Repeat cycle", 12, "days"),
                text_prop("Instruments", "L-band SAR (NASA) and S-band SAR (ISRO), sharing one reflector"),
            ],
            orbital=[
                prop("Altitude", 747, "km", note="Sun-synchronous"),
                prop("Inclination", 98.4, "°"),
                text_prop("Launch vehicle", "GSLV Mk II, from Satish Dhawan Space Centre"),
            ],
            facts=[
                "All of its data is free and open to anyone, which is unusual for a satellite of this cost.",
                "It detects ground movement of about a centimetre — enough to watch a glacier flow or a city subside.",
                "It is the first satellite to carry dual-frequency radar with both bands looking through the same aperture.",
            ],
            related_ids=["earth", "bhuvan", "iss"],
            appearance=Appearance(
                base_color="#7FA8B8",
                accent_color="#E4682E",
                radius_km=0.006,
                texture=_T.ENGINEERED,
                albedo=0.6,
            ),
            sources=_JOINT,
        ),
        CatalogObject(
            id="bhuvan",
            name="Bhuvan",
            designation="ISRO Geoportal",
            kind=ObjectKind.SATELLITE,
            parent_id="earth",
            classification="Earth-observation programme and geoportal",
            tagline="India's own view of its own territory, from its own satellites.",
            overview=(
                "Bhuvan is the public face of India's Earth-observation fleet: a geoportal serving "
                "imagery and derived data from the Resourcesat, Cartosat, Oceansat and RISAT "
                "series. Its point is sovereignty over data. Rather than depending on foreign "
                "imagery for flood mapping, crop forecasting, groundwater assessment and disaster "
                "response, India flies its own sensors and publishes the products domestically — "
                "including operational services used by state governments for planning."
            ),
            physical=[
                text_prop("Satellite series", "Cartosat, Resourcesat, Oceansat, RISAT, EOS"),
                prop("Best resolution", 0.25, "m", note="Cartosat-3 panchromatic"),
                text_prop("Coverage", "All of India, with global coverage from several sensors"),
            ],
            orbital=[
                text_prop("Typical orbit", "Sun-synchronous, 500–800 km"),
                text_prop("Launched by", "PSLV, from Satish Dhawan Space Centre"),
            ],
            facts=[
                "Cartosat-3 resolves objects 25 cm across from orbit — among the sharpest civilian imaging anywhere.",
                "Bhuvan data underpins operational flood and cyclone response across Indian states.",
                "It launched in 2009 as an Indian counterpart to global mapping portals, built on Indian imagery.",
            ],
            related_ids=["earth", "nisar", "pslv"],
            appearance=Appearance(
                base_color="#4E7C8E",
                accent_color="#8FB573",
                radius_km=0.004,
                texture=_T.ENGINEERED,
                albedo=0.55,
            ),
            sources=_SRC,
        ),
        CatalogObject(
            id="gaganyaan",
            name="Gaganyaan",
            kind=ObjectKind.SPACECRAFT,
            parent_id="earth",
            classification="Crewed orbital spacecraft (in development)",
            tagline="India's first crewed spacecraft, and the vehicle that would make it the fourth nation to fly its own astronauts.",
            overview=(
                "Gaganyaan is a three-seat capsule intended to carry Indian astronauts to low "
                "Earth orbit on a human-rated LVM3. Human rating is the hard part and the reason "
                "the schedule has moved: it means a crew escape system that works from the pad "
                "through to orbit, redundancy on every critical path, and an uncrewed test "
                "campaign to prove all of it. India has already flown Rakesh Sharma, aboard a "
                "Soviet Soyuz in 1984; Gaganyaan would be the first flight on an Indian vehicle."
            ),
            physical=[
                prop("Crew", 3),
                prop("Total mass", 8200, "kg", note="Orbital module"),
                prop("Crew module mass", 5300, "kg"),
                prop("Mission duration", 3, "days", note="Planned"),
                prop("Target orbit", 400, "km", note="Low Earth orbit"),
            ],
            orbital=[
                text_prop("Launch vehicle", "Human-rated LVM3 (HLVM3)"),
                text_prop("Launch site", "Satish Dhawan Space Centre, Sriharikota"),
                text_prop("Status", "Uncrewed test flights and crew-escape tests conducted"),
            ],
            facts=[
                "Success would make India the fourth nation to launch its own crew, after the USSR, the USA and China.",
                "The crew escape system has to work from the pad all the way to orbit — it was flight-tested in 2023.",
                "Rakesh Sharma flew in 1984 aboard Soyuz T-11, but on a Soviet vehicle rather than an Indian one.",
            ],
            related_ids=["earth", "iss", "gslv-mk3"],
            appearance=Appearance(
                base_color="#CAC3B7",
                accent_color="#E4682E",
                radius_km=0.0037,
                texture=_T.ENGINEERED,
                albedo=0.62,
            ),
            sources=_SRC,
        ),
    ]


def _launch_vehicles() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="pslv",
            name="PSLV",
            designation="Polar Satellite Launch Vehicle",
            kind=ObjectKind.LAUNCH_VEHICLE,
            parent_id="earth",
            classification="Medium-lift expendable launch vehicle",
            tagline="The workhorse that launched Chandrayaan-1, Mangalyaan, and 104 satellites at once.",
            overview=(
                "The PSLV is a four-stage vehicle that alternates solid and liquid stages — solid, "
                "liquid, solid, liquid — an unusual arrangement that gives it both the thrust to "
                "leave the pad and the fine control to place multiple payloads into distinct "
                "orbits. That restartable fourth stage is why it became the world's preferred "
                "rideshare launcher, and in February 2017 it placed 104 satellites in orbit on a "
                "single flight, a record that stood for four years."
            ),
            physical=[
                prop("Height", 44, "m"),
                prop("Diameter", 2.8, "m"),
                prop("Lift-off mass", 320_000, "kg"),
                prop("Payload to LEO", 3800, "kg"),
                prop("Payload to SSO", 1750, "kg", note="Sun-synchronous, 600 km"),
                prop("Stages", 4),
                text_prop("Propellants", "Stages 1 and 3 solid (HTPB); stages 2 and 4 liquid (UDMH/N₂O₄)"),
            ],
            facts=[
                "It launched 104 satellites on one flight in February 2017 — a record held until 2021.",
                "Its restartable liquid fourth stage is what lets it drop payloads into several different orbits on one flight.",
                "It carried both Chandrayaan-1 and Mangalyaan, and neither would have been affordable on a larger vehicle.",
            ],
            related_ids=["chandrayaan-1", "mangalyaan", "aditya-l1", "gslv-mk3"],
            concept_slugs=["tsiolkovsky", "staging", "delta-v-budget"],
            appearance=Appearance(
                base_color="#E3DDD3",
                accent_color="#E4682E",
                radius_km=0.0014,
                texture=_T.ENGINEERED,
                albedo=0.7,
            ),
            sources=_SRC,
        ),
        CatalogObject(
            id="gslv-mk3",
            name="LVM3",
            designation="GSLV Mk III / Launch Vehicle Mark-3",
            kind=ObjectKind.LAUNCH_VEHICLE,
            parent_id="earth",
            classification="Heavy-lift expendable launch vehicle",
            tagline="India's heaviest rocket, and the one that will carry its first crew.",
            overview=(
                "LVM3 is a three-stage vehicle: two large solid boosters, a liquid core, and a "
                "cryogenic upper stage burning liquid hydrogen and liquid oxygen. The cryogenic "
                "stage is the significant part. Hydrogen boils at 20 kelvin and leaks through "
                "almost anything, and building an engine that handles it took India decades and "
                "several failures after an international technology transfer fell through. It flew "
                "Chandrayaan-2 and Chandrayaan-3, and a human-rated variant is the intended "
                "vehicle for Gaganyaan."
            ),
            physical=[
                prop("Height", 43.5, "m"),
                prop("Diameter", 4, "m"),
                prop("Lift-off mass", 640_000, "kg"),
                prop("Payload to LEO", 10_000, "kg"),
                prop("Payload to GTO", 4000, "kg"),
                prop("Stages", 3),
                text_prop("Propellants", "S200 solid boosters; L110 liquid core; C25 cryogenic upper (LH₂/LOX)"),
            ],
            facts=[
                "Its S200 boosters are among the largest solid rocket motors flying anywhere.",
                "The CE-20 cryogenic engine was developed domestically after a technology transfer agreement collapsed under external pressure.",
                "It launched both Chandrayaan-2 and Chandrayaan-3, and a human-rated version is planned for Gaganyaan.",
            ],
            related_ids=["chandrayaan-2", "vikram-lander", "gaganyaan", "pslv"],
            concept_slugs=["tsiolkovsky", "staging", "delta-v-budget"],
            appearance=Appearance(
                base_color="#E3DDD3",
                accent_color="#C0392B",
                radius_km=0.002,
                texture=_T.ENGINEERED,
                albedo=0.7,
            ),
            sources=_SRC,
        ),
    ]


#: Every id in this module, for validation and cross-reference checks.
INDIAN_SPACE_IDS = [
    "chandrayaan-1", "chandrayaan-2", "vikram-lander", "pragyan-rover",
    "mangalyaan", "aditya-l1",
    "nisar", "bhuvan", "gaganyaan",
    "pslv", "gslv-mk3",
]
