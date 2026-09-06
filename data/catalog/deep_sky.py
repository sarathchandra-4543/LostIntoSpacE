"""The catalog beyond the solar system.

Nebulae, supernova remnants, galaxies, galaxy clusters, black holes and
exoplanets. A catalog that stops at Neptune quietly teaches that the universe
stops at Neptune, and the objects here are where almost everything interesting
about astrophysics actually happens — where stars are made, where the heavy
elements in your body were forged, and where the largest gravitationally bound
structures in the universe are found.

These are measured in different units from a planet and the record types reflect
that: a distance in light years rather than kilometres, a mass in solar masses
rather than kilograms, an angular size rather than a radius. `Appearance` still
carries a `radius_km` because the field renderer needs *something* to scale by,
and for these objects it is a nominal drawing size rather than a measurement —
noted on every entry so nobody reads it as one.

Sources are NASA and ESA mission and archive pages, and the NASA Exoplanet
Archive for the planets. Distances to deep-sky objects carry real uncertainty,
often tens of percent, and are quoted the way the reference quotes them.

Python floor for this tree is 3.9: use ``Optional[X]`` and ``List[X]``.
"""

from datetime import datetime, timezone
from typing import List

from contracts.provenance import SourceReference, SourceType

from ._helpers import prop, text_prop
from .models import Appearance, CatalogObject, ObjectKind, SurfaceTexture

__all__ = ["deep_sky_objects", "DEEP_SKY_IDS"]

_T = SurfaceTexture
_RETRIEVED = datetime(2026, 9, 6, tzinfo=timezone.utc)

#: The NASA Exoplanet Archive — the reference catalogue for confirmed planets.
EXOPLANET_ARCHIVE = SourceReference(
    source_name="NASA Exoplanet Archive",
    source_type=SourceType.BUNDLED_REFERENCE,
    source_url="https://exoplanetarchive.ipac.caltech.edu/",
    retrieved_at=_RETRIEVED,
    attribution=(
        "NASA Exoplanet Archive, operated by Caltech under contract with NASA "
        "as part of the Exoplanet Exploration Program"
    ),
)

#: Mission and observatory pages for the deep-sky objects.
NASA_SCIENCE = SourceReference(
    source_name="NASA Science",
    source_type=SourceType.BUNDLED_REFERENCE,
    source_url="https://science.nasa.gov/universe/",
    retrieved_at=_RETRIEVED,
    attribution="NASA Science Mission Directorate",
)

#: ESA/Hubble and Webb public archives.
ESA_HUBBLE = SourceReference(
    source_name="ESA/Hubble and NASA",
    source_type=SourceType.BUNDLED_REFERENCE,
    source_url="https://esahubble.org/",
    retrieved_at=_RETRIEVED,
    attribution="ESA/Hubble and NASA",
)

_DEEP = [NASA_SCIENCE, ESA_HUBBLE]


def deep_sky_objects() -> List[CatalogObject]:
    """Everything beyond the heliosphere, in catalog order."""
    return _nebulae() + _remnants() + _clusters() + _galaxies() + _black_holes() + _exoplanets()


def _nebulae() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="orion-nebula",
            name="Orion Nebula",
            designation="Messier 42, NGC 1976",
            kind=ObjectKind.NEBULA,
            classification="H II region, stellar nursery",
            tagline="The nearest place where stars are being made, and the only one visible to the naked eye.",
            overview=(
                "Fourteen hundred light years away, in the sword of Orion, a cloud of hydrogen is "
                "collapsing into stars. Four massive young stars at its heart — the Trapezium — "
                "pour out enough ultraviolet light to ionise the gas around them, which is why the "
                "nebula glows rather than merely blocking what is behind it. It is close enough "
                "that telescopes resolve individual protoplanetary discs: solar systems in the act "
                "of forming, photographed in progress."
            ),
            physical=[
                prop("Distance", 1344, "light years", note="≈ 1.27×10¹⁶ km"),
                prop("Apparent diameter", 65, "arcminutes", note="Twice the width of the full Moon"),
                prop("True diameter", 24, "light years"),
                prop("Mass", 2000, "solar masses"),
                prop("Apparent magnitude", 4.0, note="Naked-eye from a dark site"),
                text_prop("Composition", "Ionised hydrogen, with helium, oxygen and dust"),
            ],
            facts=[
                "Hubble has resolved over 150 protoplanetary discs here — young solar systems caught in the act of forming.",
                "The Trapezium stars are under a million years old. The Sun is 4.6 billion.",
                "It is the closest region of massive star formation to Earth, which is why almost everything known about how big stars form was learned here.",
            ],
            related_ids=["horsehead-nebula", "sol", "carina-nebula"],
            concept_slugs=["scale-of-the-universe"],
            appearance=Appearance(
                base_color="#C86A7A",
                accent_color="#7FA8B8",
                radius_km=1.0e14,
                texture=_T.DIFFUSE,
                albedo=0.9,
                atmosphere_color="#E08A9A",
                atmosphere_strength=0.9,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="carina-nebula",
            name="Carina Nebula",
            designation="NGC 3372",
            kind=ObjectKind.NEBULA,
            classification="H II region, stellar nursery",
            tagline="Webb's Cosmic Cliffs: a wall of gas being eaten away by the stars it made.",
            overview=(
                "Four times larger and far brighter than Orion, but too far south for most of the "
                "northern hemisphere to see. It contains some of the most massive stars known, "
                "including Eta Carinae, which staged a false supernova in the 1840s and briefly "
                "became the second-brightest star in the sky without destroying itself. The "
                "'Cosmic Cliffs' that Webb photographed are the edge of a cavity being carved out "
                "of the cloud by radiation from the young stars inside it."
            ),
            physical=[
                prop("Distance", 8500, "light years"),
                prop("Apparent diameter", 120, "arcminutes"),
                prop("True diameter", 460, "light years"),
                prop("Apparent magnitude", 1.0),
                text_prop("Notable member", "Eta Carinae, 100+ solar masses, a supernova in waiting"),
            ],
            facts=[
                "Eta Carinae is expected to end as a supernova, and possibly a hypernova. Nobody knows when.",
                "The Cosmic Cliffs are about seven light years tall — the tallest peaks in that image dwarf the entire solar system.",
                "Webb sees through the dust in infrared, revealing hundreds of stars that are completely invisible to Hubble.",
            ],
            related_ids=["orion-nebula", "jwst", "tarantula-nebula"],
            appearance=Appearance(
                base_color="#B4653F",
                accent_color="#D9A441",
                radius_km=1.9e15,
                texture=_T.DIFFUSE,
                albedo=0.9,
                atmosphere_color="#E08A5A",
                atmosphere_strength=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="horsehead-nebula",
            name="Horsehead Nebula",
            designation="Barnard 33",
            kind=ObjectKind.NEBULA,
            classification="Dark nebula",
            tagline="A column of cold dust, visible only because something bright sits behind it.",
            overview=(
                "The Horsehead emits almost no light of its own. It is an opaque column of dust "
                "and molecular gas, and it is visible purely as a silhouette against the glowing "
                "hydrogen of IC 434 behind it. That makes it a useful lesson in how astronomy "
                "works: some of the most recognisable objects in the sky are recognisable because "
                "of what they block."
            ),
            physical=[
                prop("Distance", 1375, "light years"),
                prop("True height", 3.5, "light years"),
                prop("Apparent size", 8, "arcminutes"),
                text_prop("Composition", "Cold molecular hydrogen and dust, roughly 20–40 K"),
            ],
            facts=[
                "It is expected to disperse within about five million years — a geological instant.",
                "In infrared the 'head' becomes semi-transparent, because dust that blocks visible light lets longer wavelengths through.",
            ],
            related_ids=["orion-nebula", "hubble"],
            appearance=Appearance(
                base_color="#3A2C33",
                accent_color="#C05A6A",
                radius_km=1.6e13,
                texture=_T.DIFFUSE,
                albedo=0.15,
                atmosphere_color="#8A4A55",
                atmosphere_strength=0.6,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="lagoon-nebula",
            name="Lagoon Nebula",
            designation="Messier 8, NGC 6523",
            kind=ObjectKind.NEBULA,
            classification="H II region, stellar nursery",
            tagline="A star-forming cloud in Sagittarius, split by a dark lane of dust.",
            overview=(
                "One of only two star-forming nebulae faintly visible to the naked eye from "
                "mid-northern latitudes. At its centre is an hourglass-shaped structure where "
                "young stars are driving furious winds into the surrounding gas, and the dark "
                "'lagoon' that gives it its name is a dust lane crossing the glowing cloud."
            ),
            physical=[
                prop("Distance", 4100, "light years"),
                prop("True diameter", 110, "light years"),
                prop("Apparent magnitude", 6.0),
            ],
            facts=[
                "Contains Bok globules — small, dense dust clouds that are collapsing into individual stars.",
            ],
            related_ids=["orion-nebula", "hubble"],
            appearance=Appearance(
                base_color="#C4566B",
                accent_color="#7FA8B8",
                radius_km=5.2e14,
                texture=_T.DIFFUSE,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="tarantula-nebula",
            name="Tarantula Nebula",
            designation="30 Doradus, NGC 2070",
            kind=ObjectKind.NEBULA,
            classification="H II region, starburst",
            tagline="The most violent star-forming region known, in a different galaxy.",
            overview=(
                "The Tarantula is not in the Milky Way at all — it sits in the Large Magellanic "
                "Cloud, a satellite galaxy 160,000 light years away, and it is still one of the "
                "brightest objects in the southern sky. If it were as close as the Orion Nebula it "
                "would cast shadows. At its core is R136, a cluster containing several of the most "
                "massive stars ever found, some over 150 times the mass of the Sun."
            ),
            physical=[
                prop("Distance", 160_000, "light years"),
                prop("True diameter", 600, "light years"),
                prop("Mass", 450_000, "solar masses"),
                text_prop("Host galaxy", "Large Magellanic Cloud"),
            ],
            facts=[
                "SN 1987A, the closest observed supernova in four centuries, went off on its outskirts.",
                "R136a1 inside it is the most massive star known, at roughly 200 solar masses.",
            ],
            related_ids=["carina-nebula", "orion-nebula"],
            appearance=Appearance(
                base_color="#D06A55",
                accent_color="#8E7CA8",
                radius_km=2.8e15,
                texture=_T.DIFFUSE,
                albedo=0.9,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="ring-nebula",
            name="Ring Nebula",
            designation="Messier 57, NGC 6720",
            kind=ObjectKind.NEBULA,
            classification="Planetary nebula",
            tagline="A dying star's shed atmosphere, seen almost straight down its axis.",
            overview=(
                "A 'planetary nebula' has nothing to do with planets — the name is an eighteenth-"
                "century misreading of a small round telescope image. What it actually is: a "
                "sun-like star at the end of its life, having thrown off its outer layers, with "
                "the exposed white-dwarf core at the centre lighting them up. This is what the Sun "
                "will do in about five billion years."
            ),
            physical=[
                prop("Distance", 2570, "light years"),
                prop("True diameter", 1.3, "light years"),
                prop("Expansion velocity", 20.8, "km/s"),
                prop("Central star temperature", 120_000, "K"),
                prop("Age", 7000, "years"),
            ],
            facts=[
                "It is not a ring but a barrel, seen end-on. The 'hole' is the tube's axis.",
                "The central white dwarf is roughly Earth-sized and holds about 0.6 solar masses.",
                "The Sun will produce something very like this, and the Earth will be inside it.",
            ],
            related_ids=["southern-ring-nebula", "helix-nebula", "sol"],
            concept_slugs=["scale-of-the-universe"],
            appearance=Appearance(
                base_color="#5FC9C0",
                accent_color="#D9A441",
                radius_km=6.1e12,
                texture=_T.DIFFUSE,
                albedo=0.8,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="helix-nebula",
            name="Helix Nebula",
            designation="NGC 7293",
            kind=ObjectKind.NEBULA,
            classification="Planetary nebula",
            tagline="The nearest planetary nebula, and the closest look at how a star like the Sun ends.",
            overview=(
                "At 655 light years the Helix is the closest bright planetary nebula, which means "
                "it can be examined in detail nothing further away allows. Its inner edge is "
                "fringed with thousands of cometary knots — dense clumps of gas, each with a tail "
                "streaming away from the central star, and each roughly the size of the solar "
                "system."
            ),
            physical=[
                prop("Distance", 655, "light years"),
                prop("True diameter", 2.9, "light years"),
                prop("Apparent diameter", 25, "arcminutes", note="Nearly the width of the full Moon"),
                prop("Age", 10_600, "years"),
            ],
            facts=[
                "Each cometary knot at its inner edge is about twice the diameter of our solar system.",
                "It is sometimes called the Eye of God, which is a nickname and not a designation.",
            ],
            related_ids=["ring-nebula", "sol"],
            appearance=Appearance(
                base_color="#6FBFD0",
                accent_color="#C4566B",
                radius_km=1.4e13,
                texture=_T.DIFFUSE,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="southern-ring-nebula",
            name="Southern Ring Nebula",
            designation="NGC 3132",
            kind=ObjectKind.NEBULA,
            classification="Planetary nebula",
            tagline="One of Webb's first images, and a dying star that turned out to have a partner.",
            overview=(
                "Webb's infrared view resolved something Hubble could not: the star that made this "
                "nebula is not the bright one at the centre. It is a fainter companion, and the "
                "two have been orbiting each other while the dying one shed its layers — which is "
                "why the shells are stirred into an irregular pattern rather than expanding as "
                "neat spheres."
            ),
            physical=[
                prop("Distance", 2500, "light years"),
                prop("True diameter", 0.5, "light years"),
                text_prop("Central system", "A binary: a white dwarf and a brighter companion star"),
            ],
            facts=[
                "Webb's mid-infrared image showed the dimmer star to be the source of the nebula — the brighter one is just a companion.",
                "The orbital motion of the pair is what stirred the ejected shells into their uneven shape.",
            ],
            related_ids=["ring-nebula", "jwst"],
            appearance=Appearance(
                base_color="#7FA8B8",
                accent_color="#E4682E",
                radius_km=2.4e12,
                texture=_T.DIFFUSE,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
    ]


def _remnants() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="crab-nebula",
            name="Crab Nebula",
            designation="Messier 1, NGC 1952",
            kind=ObjectKind.SUPERNOVA_REMNANT,
            classification="Supernova remnant, pulsar wind nebula",
            tagline="A star that exploded in 1054, watched at the time, and still expanding.",
            overview=(
                "Chinese and Japanese astronomers recorded a 'guest star' in Taurus in July 1054, "
                "bright enough to be seen in daylight for three weeks. What they were watching was "
                "a massive star dying. The Crab Nebula is the debris, still flying outward at "
                "1,500 kilometres a second, and at its centre is what is left of the star: a "
                "neutron star the size of a city, spinning thirty times a second."
            ),
            physical=[
                prop("Distance", 6500, "light years"),
                prop("True diameter", 11, "light years"),
                prop("Expansion velocity", 1500, "km/s"),
                prop("Age", 972, "years", note="As of 2026; the light arrived in 1054"),
                prop("Pulsar rotation period", 0.0334, "s", note="30 rotations per second"),
                prop("Pulsar mass", 1.4, "solar masses"),
                prop("Pulsar diameter", 28, "km"),
            ],
            facts=[
                "The pulsar packs more than the Sun's mass into a sphere the size of a city — a teaspoon of it would weigh about a billion tonnes.",
                "It is slowing by 38 nanoseconds a day, and that lost rotational energy is what keeps the whole nebula glowing.",
                "It was the first astronomical object connected to a historical supernova record.",
            ],
            related_ids=["tarantula-nebula", "sol"],
            concept_slugs=["gravity"],
            appearance=Appearance(
                base_color="#C4816B",
                accent_color="#7FA8B8",
                radius_km=5.2e13,
                texture=_T.DIFFUSE,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
    ]


def _clusters() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="abell-2744",
            name="Abell 2744",
            designation="Pandora's Cluster",
            kind=ObjectKind.GALAXY_CLUSTER,
            classification="Galaxy cluster, gravitational lens",
            tagline="Four clusters colliding, and a lens that lets us see past them.",
            overview=(
                "Abell 2744 is a pile-up: at least four separate galaxy clusters merging over "
                "hundreds of millions of years. Its mass bends the light of far more distant "
                "galaxies behind it into arcs and multiple images, turning the cluster itself into "
                "a telescope. Hubble and Webb have both used it that way, seeing galaxies that "
                "would otherwise be far too faint to detect at all."
            ),
            physical=[
                prop("Distance", 3.98e9, "light years", note="Redshift z ≈ 0.308"),
                prop("Mass", 1.8e15, "solar masses"),
                prop("Member galaxies", 500, note="Approximate"),
                text_prop("Composition", "About 5% galaxies, 20% hot gas, 75% dark matter"),
            ],
            facts=[
                "Most of its ordinary matter is not in the galaxies at all but in gas between them, at tens of millions of kelvin.",
                "Its lensing has revealed galaxies from the first few hundred million years after the Big Bang.",
                "The collision has separated the hot gas from the dark matter, which is some of the most direct evidence that dark matter exists.",
            ],
            related_ids=["andromeda-galaxy", "hubble", "jwst"],
            concept_slugs=["gravity", "scale-of-the-universe"],
            appearance=Appearance(
                base_color="#8E7CA8",
                accent_color="#D9A441",
                radius_km=2.0e19,
                texture=_T.GALACTIC,
                albedo=0.7,
                emissive=True,
            ),
            sources=_DEEP,
        ),
    ]


def _galaxies() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="milky-way-galaxy",
            name="The Milky Way",
            kind=ObjectKind.GALAXY,
            classification="Barred spiral galaxy, SBbc",
            tagline="Our own galaxy, seen from the inside — which is why it is so hard to map.",
            overview=(
                "Every star visible to the naked eye is in the Milky Way, and so is the solar "
                "system, about 26,000 light years from the centre and going round once every 230 "
                "million years. Being inside it is the difficulty: mapping a galaxy from a point "
                "within its disc, through the dust of that disc, is like surveying a forest from "
                "one tree. It took infrared and radio surveys to establish that ours is a *barred* "
                "spiral at all."
            ),
            physical=[
                prop("Diameter", 100_000, "light years", note="Stellar disc; the halo is far larger"),
                prop("Disc thickness", 1000, "light years"),
                prop("Mass", 1.5e12, "solar masses", note="Including dark matter"),
                prop("Stars", 2e11, note="Estimate: 100–400 billion"),
                prop("Sun's distance from centre", 26_000, "light years"),
                prop("Sun's orbital period", 2.3e8, "years"),
                prop("Sun's orbital speed", 230, "km/s"),
            ],
            facts=[
                "The solar system has completed about 20 orbits of the galaxy since it formed.",
                "It is on a collision course with Andromeda; the merger begins in roughly 4.5 billion years.",
                "The supermassive black hole at its centre, Sagittarius A*, holds about 4.3 million solar masses.",
            ],
            related_ids=["andromeda-galaxy", "sol", "sagittarius-a-star"],
            concept_slugs=["scale-of-the-universe"],
            appearance=Appearance(
                base_color="#C8B48E",
                accent_color="#7FA8B8",
                radius_km=4.7e17,
                texture=_T.GALACTIC,
                albedo=0.9,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="andromeda-galaxy",
            name="Andromeda Galaxy",
            designation="Messier 31, NGC 224",
            kind=ObjectKind.GALAXY,
            classification="Barred spiral galaxy, SA(s)b",
            tagline="The most distant thing visible to the naked eye, and it is coming this way.",
            overview=(
                "Two and a half million light years away, and still a naked-eye object from a dark "
                "site — the light hitting your retina left before the genus Homo existed. "
                "Andromeda is the largest galaxy in the Local Group and is approaching the Milky "
                "Way at 110 kilometres a second. In about 4.5 billion years the two will merge, "
                "and although the galaxies will pass through each other, almost no stars will "
                "actually collide: the space between them is that empty."
            ),
            physical=[
                prop("Distance", 2.537e6, "light years"),
                prop("Diameter", 152_000, "light years"),
                prop("Mass", 1.5e12, "solar masses"),
                prop("Stars", 1e12, note="Roughly a trillion"),
                prop("Apparent magnitude", 3.44),
                prop("Approach velocity", 110, "km/s", note="Toward the Milky Way"),
            ],
            facts=[
                "It spans six times the width of the full Moon in the sky — most of it is simply too faint to see.",
                "When it merges with the Milky Way, the odds of any two stars colliding are effectively zero.",
                "Edwin Hubble used Cepheid variables here in 1925 to prove that galaxies exist outside our own.",
            ],
            related_ids=["milky-way-galaxy", "whirlpool-galaxy", "hubble"],
            concept_slugs=["scale-of-the-universe"],
            appearance=Appearance(
                base_color="#CBB89A",
                accent_color="#7FA8B8",
                radius_km=7.2e17,
                texture=_T.GALACTIC,
                albedo=0.9,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="whirlpool-galaxy",
            name="Whirlpool Galaxy",
            designation="Messier 51a, NGC 5194",
            kind=ObjectKind.GALAXY,
            classification="Grand-design spiral galaxy",
            tagline="The first spiral ever recognised as a spiral, caught mid-collision.",
            overview=(
                "Lord Rosse drew its spiral structure in 1845 with a 72-inch reflector, decades "
                "before anyone knew what a galaxy was. Its arms are so sharply defined because a "
                "smaller companion galaxy, NGC 5195, is passing through its disc — the "
                "gravitational disturbance is what compresses the gas into those clean lanes and "
                "triggers the star formation lighting them up."
            ),
            physical=[
                prop("Distance", 2.3e7, "light years"),
                prop("Diameter", 76_000, "light years"),
                prop("Mass", 1.6e11, "solar masses"),
                prop("Apparent magnitude", 8.4),
            ],
            facts=[
                "Its companion NGC 5195 has already passed through the disc once and is coming back.",
                "The tidy spiral arms are a *consequence* of that interaction, not despite it.",
            ],
            related_ids=["andromeda-galaxy", "pinwheel-galaxy", "hubble"],
            appearance=Appearance(
                base_color="#B8A98E",
                accent_color="#C4566B",
                radius_km=3.6e17,
                texture=_T.GALACTIC,
                albedo=0.88,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="sombrero-galaxy",
            name="Sombrero Galaxy",
            designation="Messier 104, NGC 4594",
            kind=ObjectKind.GALAXY,
            classification="Lenticular or spiral galaxy, seen edge-on",
            tagline="An edge-on disc bisected by a dust lane, over a bulge of ancient stars.",
            overview=(
                "The Sombrero is seen almost exactly edge-on, six degrees off its own equator, "
                "which is what produces the hat silhouette. The bright bulge is packed with old "
                "stars and an unusually rich population of nearly two thousand globular clusters — "
                "ten times what the Milky Way has. At its centre is one of the most massive black "
                "holes known in a nearby galaxy."
            ),
            physical=[
                prop("Distance", 3.1e7, "light years"),
                prop("Diameter", 49_000, "light years"),
                prop("Mass", 8e11, "solar masses"),
                prop("Central black hole mass", 1e9, "solar masses"),
                prop("Globular clusters", 1900, note="Against roughly 150 in the Milky Way"),
            ],
            facts=[
                "Its central black hole is around 250 times more massive than the Milky Way's.",
                "The dark band is not empty space but a ring of dust, and it is where the galaxy's remaining star formation happens.",
            ],
            related_ids=["andromeda-galaxy", "m87-galaxy"],
            appearance=Appearance(
                base_color="#C4B396",
                accent_color="#3A342B",
                radius_km=2.3e17,
                texture=_T.GALACTIC,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="pinwheel-galaxy",
            name="Pinwheel Galaxy",
            designation="Messier 101, NGC 5457",
            kind=ObjectKind.GALAXY,
            classification="Face-on spiral galaxy, SAB(rs)cd",
            tagline="A spiral seen perfectly face-on, and noticeably lopsided.",
            overview=(
                "M101 presents its disc almost exactly to us, which makes it one of the best "
                "objects anywhere for studying spiral structure. It is also visibly asymmetric — "
                "the nucleus sits off-centre and one side of the disc is stretched — the result of "
                "past encounters with its companion galaxies."
            ),
            physical=[
                prop("Distance", 2.1e7, "light years"),
                prop("Diameter", 170_000, "light years", note="Nearly twice the Milky Way"),
                prop("Mass", 1e11, "solar masses"),
                prop("Apparent magnitude", 7.86),
            ],
            facts=[
                "It is one of the largest spiral discs known in the nearby universe.",
                "Several supernovae have been observed in it, including SN 2011fe, one of the closest and best-studied Type Ia events.",
            ],
            related_ids=["whirlpool-galaxy", "andromeda-galaxy"],
            appearance=Appearance(
                base_color="#AEBCC4",
                accent_color="#C4566B",
                radius_km=8.0e17,
                texture=_T.GALACTIC,
                albedo=0.88,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="antennae-galaxies",
            name="Antennae Galaxies",
            designation="NGC 4038 and NGC 4039",
            kind=ObjectKind.GALAXY,
            classification="Interacting galaxy pair",
            tagline="Two galaxies in the act of merging, throwing out hundred-thousand-light-year tails.",
            overview=(
                "The nearest and youngest example of a galaxy collision. Two spirals began passing "
                "through each other a few hundred million years ago, and the tidal forces have "
                "flung two enormous streams of stars and gas out behind them — the 'antennae' the "
                "pair is named for. The compressed gas at the collision front is producing star "
                "clusters at a rate neither galaxy could manage alone. This is what the Milky Way "
                "and Andromeda will look like."
            ),
            physical=[
                prop("Distance", 4.5e7, "light years"),
                prop("Tail length", 500_000, "light years"),
                text_prop("Stage", "Collision began roughly 600 million years ago"),
            ],
            facts=[
                "Thousands of young star clusters have formed in the collision zone; most will disperse, but some will become globular clusters.",
                "It is the closest preview of the Milky Way–Andromeda merger.",
            ],
            related_ids=["milky-way-galaxy", "andromeda-galaxy"],
            appearance=Appearance(
                base_color="#C09A8A",
                accent_color="#7FA8B8",
                radius_km=2.1e18,
                texture=_T.GALACTIC,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
        CatalogObject(
            id="m87-galaxy",
            name="Messier 87",
            designation="NGC 4486, Virgo A",
            kind=ObjectKind.GALAXY,
            classification="Supergiant elliptical galaxy",
            tagline="Home of the first black hole ever photographed.",
            overview=(
                "A supergiant elliptical at the heart of the Virgo Cluster, containing several "
                "trillion stars and over twelve thousand globular clusters. A jet of plasma five "
                "thousand light years long streams out of its core at close to the speed of light. "
                "In 2019 the Event Horizon Telescope resolved the shadow of the black hole driving "
                "that jet — the first direct image of a black hole ever made."
            ),
            physical=[
                prop("Distance", 5.35e7, "light years"),
                prop("Diameter", 240_000, "light years"),
                prop("Mass", 2.4e12, "solar masses"),
                prop("Central black hole mass", 6.5e9, "solar masses"),
                prop("Jet length", 5000, "light years"),
                prop("Globular clusters", 12_000),
            ],
            facts=[
                "Its black hole's event horizon is larger than the orbit of Neptune.",
                "The 2019 Event Horizon Telescope image combined radio dishes across the planet into an Earth-sized instrument.",
                "The jet was first noticed in 1918, long before anyone had a mechanism to explain it.",
            ],
            related_ids=["sagittarius-a-star", "abell-2744"],
            concept_slugs=["gravity"],
            appearance=Appearance(
                base_color="#D8C49A",
                accent_color="#7FA8B8",
                radius_km=1.1e18,
                texture=_T.GALACTIC,
                albedo=0.85,
                emissive=True,
            ),
            sources=_DEEP,
        ),
    ]


def _black_holes() -> List[CatalogObject]:
    return [
        CatalogObject(
            id="sagittarius-a-star",
            name="Sagittarius A*",
            designation="Sgr A*",
            kind=ObjectKind.BLACK_HOLE,
            parent_id="milky-way-galaxy",
            classification="Supermassive black hole",
            tagline="Four million suns in a space smaller than Mercury's orbit, at the centre of our galaxy.",
            overview=(
                "For decades the evidence for Sagittarius A* was indirect but overwhelming: stars "
                "at the galactic centre were seen whipping around *something* invisible on orbits "
                "only a few light-hours across, one of them reaching 3% of the speed of light at "
                "closest approach. Tracking those orbits for thirty years won the 2020 Nobel Prize "
                "in Physics, and in 2022 the Event Horizon Telescope imaged its shadow directly."
            ),
            physical=[
                prop("Mass", 4.3e6, "solar masses"),
                prop("Schwarzschild radius", 1.27e7, "km", note="About 17 solar radii"),
                prop("Distance from Earth", 26_670, "light years"),
                prop("Event horizon angular size", 5.2e-5, "arcseconds"),
                text_prop("Nearest orbiting star", "S2, which passes within 17 light-hours at 7,650 km/s"),
            ],
            facts=[
                "It is remarkably quiet for its mass — it accretes very little, which is why the galactic centre is not blazing.",
                "Its apparent size from Earth is roughly that of a doughnut on the Moon.",
                "The 2020 Nobel Prize in Physics went to Genzel and Ghez for the stellar orbits that proved it exists.",
            ],
            related_ids=["milky-way-galaxy", "m87-galaxy"],
            concept_slugs=["gravity"],
            appearance=Appearance(
                base_color="#1A1712",
                accent_color="#E4682E",
                radius_km=1.27e7,
                texture=_T.ACCRETION,
                albedo=0.0,
                atmosphere_color="#FA8A4A",
                atmosphere_strength=1.0,
                emissive=True,
            ),
            sources=_DEEP,
        ),
    ]


def _exoplanets() -> List[CatalogObject]:
    """Confirmed planets around other stars.

    Parameters are from the NASA Exoplanet Archive, which is the reference
    catalogue the astronomical community actually uses. It is one source among
    several here rather than the only one: the archive gives orbital and bulk
    parameters, and the mission and observatory pages give the context.
    """
    return [
        CatalogObject(
            id="trappist-1e",
            name="TRAPPIST-1e",
            kind=ObjectKind.EXOPLANET,
            classification="Terrestrial exoplanet, habitable zone",
            tagline="An Earth-sized world in the habitable zone of a star 40 light years away.",
            overview=(
                "TRAPPIST-1 is a dim red dwarf with seven Earth-sized planets, three of them in "
                "the zone where liquid water could exist. TRAPPIST-1e is the most Earth-like of "
                "them by density and radius. The whole system is smaller than Mercury's orbit, so "
                "the planets are tidally locked — one face in permanent day, the other in "
                "permanent night — and from the surface of any one of them the others would appear "
                "larger than our Moon does."
            ),
            physical=[
                prop("Radius", 0.92, "Earth radii", earth_ratio=0.92),
                prop("Mass", 0.69, "Earth masses", earth_ratio=0.69),
                prop("Density", 5000, "kg/m³", note="Consistent with rock and iron"),
                prop("Equilibrium temperature", 250, "K"),
                prop("Surface gravity", 0.82, "m/s²", note="Relative to Earth: 0.82 g", earth_ratio=0.82),
            ],
            orbital=[
                prop("Orbital period", 6.10, "days"),
                prop("Semi-major axis", 0.029, "AU", note="Under a twentieth of Mercury's"),
                prop("Distance from Earth", 40.7, "light years"),
                text_prop("Host star", "TRAPPIST-1, an M8V red dwarf of 0.09 solar masses"),
            ],
            facts=[
                "All seven planets would fit comfortably inside Mercury's orbit.",
                "The star is so dim that the habitable zone sits closer to it than Mercury is to the Sun.",
                "Webb is measuring these atmospheres now — TRAPPIST-1e is among the highest-priority targets anywhere.",
            ],
            related_ids=["kepler-452b", "proxima-centauri-b", "jwst"],
            concept_slugs=["scale-of-the-universe"],
            appearance=Appearance(
                base_color="#A8734F",
                accent_color="#7FA8B8",
                radius_km=5860,
                texture=_T.ROCKY,
                albedo=0.3,
            ),
            sources=[EXOPLANET_ARCHIVE, NASA_SCIENCE],
        ),
        CatalogObject(
            id="kepler-452b",
            name="Kepler-452b",
            kind=ObjectKind.EXOPLANET,
            classification="Super-Earth, habitable zone",
            tagline="A 385-day year around a star very like the Sun, 1,800 light years away.",
            overview=(
                "What makes Kepler-452b notable is not the planet so much as the star. Most "
                "habitable-zone planets found so far orbit red dwarfs, which flare violently and "
                "tidally lock their planets. Kepler-452 is a G2 star — the same class as the Sun — "
                "and the planet's 385-day orbit puts it at a comparable distance. It is also 1.5 "
                "billion years older, which makes it a plausible view of Earth's future."
            ),
            physical=[
                prop("Radius", 1.63, "Earth radii", earth_ratio=1.63),
                prop("Mass", 5, "Earth masses", note="Estimated; not directly measured", earth_ratio=5),
                prop("Equilibrium temperature", 265, "K"),
            ],
            orbital=[
                prop("Orbital period", 384.8, "days"),
                prop("Semi-major axis", 1.046, "AU"),
                prop("Distance from Earth", 1800, "light years"),
                text_prop("Host star", "Kepler-452, a G2V star — the Sun's own spectral class"),
            ],
            facts=[
                "Its star is 1.5 billion years older than the Sun and 20% brighter.",
                "Its mass has never been measured directly; the figure is inferred from its radius.",
                "At 1,800 light years it is far beyond the reach of any current or planned mission.",
            ],
            related_ids=["trappist-1e", "proxima-centauri-b", "earth"],
            appearance=Appearance(
                base_color="#6E8A6B",
                accent_color="#7FA8B8",
                radius_km=10_385,
                texture=_T.OCEANIC,
                albedo=0.35,
                atmosphere_color="#8FB0C4",
                atmosphere_strength=0.5,
            ),
            sources=[EXOPLANET_ARCHIVE, NASA_SCIENCE],
        ),
        CatalogObject(
            id="proxima-centauri-b",
            name="Proxima Centauri b",
            kind=ObjectKind.EXOPLANET,
            classification="Terrestrial exoplanet, habitable zone",
            tagline="The closest exoplanet there is, and still 4.2 light years away.",
            overview=(
                "Proxima Centauri is the nearest star to the Sun, and it has an Earth-mass planet "
                "in its habitable zone. That is as close as an exoplanet can possibly be. Whether "
                "it could actually hold life is unsettled: Proxima is a flare star, and it emits "
                "X-ray bursts hundreds of times stronger than anything the Sun produces, "
                "repeatedly, at a planet orbiting twenty times closer than Earth does."
            ),
            physical=[
                prop("Minimum mass", 1.07, "Earth masses", note="True mass depends on orbital inclination", earth_ratio=1.07),
                prop("Equilibrium temperature", 234, "K"),
            ],
            orbital=[
                prop("Orbital period", 11.19, "days"),
                prop("Semi-major axis", 0.0485, "AU"),
                prop("Distance from Earth", 4.24, "light years", note="≈ 4.0×10¹³ km"),
                text_prop("Host star", "Proxima Centauri, an M5.5Ve red dwarf and flare star"),
            ],
            facts=[
                "At the speed of Voyager 1 the journey would take about 73,000 years.",
                "Proxima's flares are strong enough that any atmosphere may long since have been stripped away.",
                "It was found by radial velocity, so only a minimum mass is known — the true mass could be higher.",
            ],
            related_ids=["trappist-1e", "kepler-452b", "voyager-1"],
            concept_slugs=["scale-of-the-universe"],
            appearance=Appearance(
                base_color="#96604A",
                accent_color="#C0392B",
                radius_km=6800,
                texture=_T.ROCKY,
                albedo=0.25,
            ),
            sources=[EXOPLANET_ARCHIVE, NASA_SCIENCE],
        ),
    ]


#: Every id in this module, for validation and cross-reference checks.
DEEP_SKY_IDS = [
    "orion-nebula", "carina-nebula", "horsehead-nebula", "lagoon-nebula",
    "tarantula-nebula", "ring-nebula", "helix-nebula", "southern-ring-nebula",
    "crab-nebula",
    "abell-2744",
    "milky-way-galaxy", "andromeda-galaxy", "whirlpool-galaxy", "sombrero-galaxy",
    "pinwheel-galaxy", "antennae-galaxies", "m87-galaxy",
    "sagittarius-a-star",
    "trappist-1e", "kepler-452b", "proxima-centauri-b",
]
