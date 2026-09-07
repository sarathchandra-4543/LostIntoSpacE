#!/usr/bin/env python3
"""Download real equirectangular planetary maps for the 3D views.

The simulator drew every world from a procedurally generated surface. That was
honest and it worked offline, but it did not look like the place: a generated
Mars is *a* rusty cratered world rather than *the* one, and the difference is
obvious the moment you have seen a photograph.

This fetches the actual mission-derived global mosaics — Viking for Mars,
MESSENGER for Mercury, Magellan for Venus, Cassini and Voyager for the giants,
LRO for the Moon, Blue Marble for Earth — and writes them into the web app's
public directory so they are served locally and the app still runs offline once
they are in place.

Every source is public domain (NASA/USGS) or a permissively licensed derivative
hosted on Wikimedia Commons. The licence and author for each file are resolved
from the Commons API at download time and written into `CREDITS.json` beside the
images, so attribution travels with the asset rather than living in someone's
memory.

    python scripts/data/fetch_planet_maps.py

Re-running skips files that already exist. Pass --force to refetch.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "web" / "public" / "textures" / "bodies"

API = "https://commons.wikimedia.org/w/api.php"
UA = "LostIntoSpacE/0.2 (educational space simulator; planetary map fetch)"

#: Body id -> Commons file title, each verified by hand against its description
#: page. Bodies absent from this table have no clean cylindrical global mosaic
#: on Commons and fall back to the generated surface, which is deliberate: a
#: fuzzy search kept returning geologic-unit maps, polar projections, annotated
#: figures and — once — Jupiter's map for Saturn.
#:
#: Chosen for being *global mosaics in simple cylindrical projection*, which is
#: what a sphere's UV mapping expects. A pretty full-disc photograph is the
#: wrong thing here: it covers one hemisphere and wraps into a smear.
FILES: dict[str, str] = {
    "mercury": "File:Mercury map by MESSENGER global mosaic enhancedcolor over completebasemap.png",
    "venus": "File:Cylindrical Map of Venus.jpg",
    "earth": "",  # fetched directly from NASA SVS; see DIRECT
    "mars": "File:Mars Viking MDIM21 ClrMosaic 1km.jpg",
    "jupiter": "File:Jupiter Cylindrical Map - Dec 2000 PIA07782.jpg",
    "enceladus": "File:Enceladus Color Map.jpg",
    "pluto": "File:Pluto color mapmosaic.jpg",
}

#: Maps served directly by NASA rather than via Commons.
#:
#: Earth is here because Commons's search kept returning a *cube map* — six
#: faces in a cross layout — which passed every title check and then wrapped
#: onto the sphere as a gridded, wedge-cut mess. NASA's Scientific
#: Visualization Studio publishes the Blue Marble as a true equirectangular
#: plate, so it is fetched by URL and not searched for at all.
DIRECT: dict[str, dict[str, str]] = {
    "earth": {
        "url": "https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png",
        "source": "https://svs.gsfc.nasa.gov/2915",
        "title": "Blue Marble: Next Generation",
        "licence": "Public domain",
        "artist": "NASA Goddard Space Flight Center Scientific Visualization Studio",
    },
}

#: What to search for when the declared title does not exist. Each phrase names
#: the mission whose global mosaic is the standard map for that body.
SEARCHES: dict[str, str] = {
    "mercury": "Mercury MESSENGER global mosaic map",
    "venus": "Venus Magellan cylindrical map",
    "earth": "Blue Marble equirectangular map",
    "luna": "Moon LROC WAC global mosaic colour map",
    "mars": "Mars Viking colour mosaic cylindrical map MDIM",
    "jupiter": "Jupiter cylindrical map Cassini",
    "saturn": "Saturn cylindrical map",
    "uranus": "Uranus cylindrical map",
    "neptune": "Neptune cylindrical map Voyager",
    "io": "Io USGS Voyager Galileo colour mosaic map",
    "europa": "Europa USGS global mosaic map",
    "ganymede": "Ganymede USGS colour mosaic map",
    "callisto": "Callisto USGS global mosaic map",
    "titan": "Titan Cassini surface mosaic map",
    "enceladus": "Enceladus global mosaic map",
    "triton": "Triton Voyager colour mosaic map",
    "pluto": "Pluto New Horizons global mosaic map",
    "ceres": "Ceres Dawn colour mosaic map",
}

#: PNG file signature, for naming a download after what it contains.
PNG_MAGIC = bytes([0x89, 0x50, 0x4E, 0x47])

#: JPEG start-of-image marker.
JPEG_MAGIC = bytes([0xFF, 0xD8])

#: Widths Commons will actually render. Asking for anything else returns 400.
TARGET_WIDTH = 1024


#: Seconds between Commons API calls. Their unauthenticated limit is strict and
#: answers 429 rather than queueing, so politeness here is not optional.
THROTTLE = 1.6
_last_call = 0.0


def request(url: str, tries: int = 4) -> bytes | None:
    """One GET, throttled, with backoff on the rate limits Commons applies."""
    global _last_call
    for attempt in range(tries):
        wait = THROTTLE - (time.time() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503) and attempt < tries - 1:
                time.sleep(6 * (attempt + 1))
                continue
            print(f"    HTTP {exc.code}", file=sys.stderr)
            return None
        except Exception as exc:  # noqa: BLE001 - report and continue
            if attempt < tries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"    {type(exc).__name__}: {exc}", file=sys.stderr)
            return None
    return None


def search(query: str) -> list[str]:
    """Candidate file titles on Commons, best match first."""
    url = API + "?" + urllib.parse.urlencode(
        {
            "action": "query",
            "list": "search",
            "srsearch": f"filetype:bitmap {query}",
            "srnamespace": "6",
            "srlimit": "8",
            "format": "json",
        }
    )
    body = request(url)
    if not body:
        return []
    try:
        return [hit["title"] for hit in json.loads(body)["query"]["search"]]
    except (KeyError, ValueError):
        return []


#: Words that mean the file is not a plain photographic global mosaic.
#:
#: Each of these was an actual bad result from an earlier run. A *geologic* map
#: is coloured by rock unit rather than by appearance; an *annotated* one has
#: labels drawn across it; *polar* maps are a different projection entirely; and
#: a grid overlay ends up wrapped round the planet as painted-on lines.
REJECT = (
    "geologic",
    "geological",
    "annotated",
    "polar",
    "grid",
    "topograph",
    "elevation",
    "gravity",
    "magnetic",
    "labeled",
    "labelled",
    "diagram",
    "globe",
    "animation",
    ".gif",
    "hemisphere",
    "true color",
    "artificial objects",
)

#: Words that mean the file probably *is* a cylindrical global mosaic.
ACCEPT = ("map", "mosaic", "cylindrical", "equirectangular", "basemap")

#: Other bodies whose names must not appear in a candidate's title.
#:
#: This is the check that matters most. An earlier run resolved Saturn to
#: "Jupiter Cylindrical Map" — the search ranked it top for a Saturn query, it
#: passed every other filter, and it would have shipped Jupiter's clouds
#: labelled as Saturn. A picture of the wrong planet is worse than no picture,
#: and the catalogue's whole claim is that nothing here is invented.
ALL_BODIES = (
    "mercury", "venus", "earth", "moon", "luna", "mars", "jupiter", "saturn",
    "uranus", "neptune", "io", "europa", "ganymede", "callisto", "titan",
    "enceladus", "triton", "pluto", "ceres",
)

#: What a body may legitimately be called in a file title.
ALIASES: dict[str, tuple[str, ...]] = {
    "luna": ("moon", "lunar", "lroc"),
    "earth": ("earth", "blue marble"),
}


def looks_like_a_map(title: str, body: str) -> bool:
    """Is this file a photographic global mosaic *of this body*?"""
    lowered = title.lower()

    if any(bad in lowered for bad in REJECT):
        return False
    if not any(good in lowered for good in ACCEPT):
        return False

    # It must name the body it claims to be.
    names = ALIASES.get(body, (body,))
    if not any(name in lowered for name in names):
        return False

    # And it must not name a *different* body. "Jupiter's moon Io" legitimately
    # names two, so a body's own parent is allowed alongside it.
    parents = {"io": "jupiter", "europa": "jupiter", "ganymede": "jupiter",
               "callisto": "jupiter", "titan": "saturn", "enceladus": "saturn",
               "triton": "neptune", "luna": "earth"}
    allowed = set(names) | {body, parents.get(body, "")}
    for other in ALL_BODIES:
        if other in allowed:
            continue
        if other in lowered:
            return False

    return True


def resolve(title: str) -> dict | None:
    """Thumbnail URL, licence and author for one Commons file."""
    query = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": str(TARGET_WIDTH),
            "format": "json",
        }
    )
    body = request(f"{API}?{query}")
    if not body:
        return None

    try:
        pages = json.loads(body)["query"]["pages"]
    except (KeyError, ValueError):
        return None

    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        url = info.get("thumburl") or info.get("url")
        if not url:
            continue
        meta = info.get("extmetadata") or {}

        def field(name: str) -> str:
            raw = (meta.get(name) or {}).get("value", "")
            # extmetadata returns HTML fragments; strip tags for a plain credit.
            text = urllib.parse.unquote(str(raw))
            out, depth = [], 0
            for ch in text:
                if ch == "<":
                    depth += 1
                elif ch == ">":
                    depth = max(0, depth - 1)
                elif depth == 0:
                    out.append(ch)
            return " ".join("".join(out).split())

        return {
            "title": title,
            "url": url,
            "descriptionurl": info.get("descriptionurl", ""),
            "licence": field("LicenseShortName") or "see description page",
            "artist": field("Artist") or "NASA/USGS",
            "credit": field("Credit"),
        }
    return None


def image_size(data: bytes) -> tuple[int, int] | None:
    """Pixel dimensions of a PNG or JPEG, without decoding it."""
    if data[:4] == PNG_MAGIC:
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:2] == JPEG_MAGIC:
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                height = int.from_bytes(data[i + 5 : i + 7], "big")
                width = int.from_bytes(data[i + 7 : i + 9], "big")
                return width, height
            length = int.from_bytes(data[i + 2 : i + 4], "big")
            i += 2 + length
    return None


def is_equirectangular(data: bytes) -> bool:
    """Is this a 2:1 plate, as a global cylindrical mosaic must be?

    The check that was missing, and it is the one that matters most. A title
    can say "Earth map" while the file is a *cube map* — six square faces in a
    cross — or a USGS figure sheet with several panels and a legend. Both pass
    every word filter and both wrap onto a sphere as garbage, which is exactly
    what shipped: a gridded Earth with a wedge cut out of it.

    Simple cylindrical covers 360 degrees of longitude by 180 of latitude, so
    the plate is twice as wide as it is tall. Anything else is not one.
    """
    size = image_size(data)
    if not size:
        return False
    width, height = size
    if height == 0:
        return False
    return 1.85 <= width / height <= 2.15


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="refetch existing files")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    credits_path = OUT / "CREDITS.json"
    credits: dict[str, dict] = {}
    if credits_path.exists():
        try:
            credits = json.loads(credits_path.read_text(encoding="utf-8"))
        except ValueError:
            credits = {}

    ok, missed = 0, []
    for body, title in FILES.items():
        existing = [OUT / f"{body}.jpg", OUT / f"{body}.png"]
        target = existing[0]
        if any(path.exists() for path in existing) and not args.force:
            print(f"  {body:10s} already present")
            ok += 1
            continue

        print(f"  {body:10s} resolving…")

        direct = DIRECT.get(body)
        meta = (
            {
                "title": direct["title"],
                "url": direct["url"],
                "descriptionurl": direct["source"],
                "licence": direct["licence"],
                "artist": direct["artist"],
                "credit": direct["artist"],
            }
            if direct
            else (resolve(title) if looks_like_a_map(title, body) else None)
        )

        # The declared title is a first guess. When it does not exist, search.
        if not meta:
            for candidate in search(SEARCHES.get(body, body + " global map")):
                if not looks_like_a_map(candidate, body):
                    continue
                meta = resolve(candidate)
                if meta:
                    print(f"  {body:10s} found {candidate}")
                    break

        if not meta:
            print(f"  {body:10s} NOT FOUND on Commons")
            missed.append(body)
            continue

        data = request(meta["url"])
        # A tiny payload means an error page rather than an image.
        if not data or len(data) < 20_000:
            print(f"  {body:10s} download failed")
            missed.append(body)
            continue

        if not is_equirectangular(data):
            size = image_size(data)
            shape = f"{size[0]}x{size[1]}" if size else "unreadable"
            print(f"  {body:10s} REJECTED — {shape} is not a 2:1 plate")
            missed.append(body)
            continue

        # Name the file after what it actually contains.
        suffix = ".png" if data[:4] == PNG_MAGIC else ".jpg"
        target = OUT / f"{body}{suffix}"
        for stale in (OUT / f"{body}.jpg", OUT / f"{body}.png"):
            if stale != target and stale.exists():
                stale.unlink()
        target.write_bytes(data)
        credits[body] = {
            "file": target.name,
            "source": meta["descriptionurl"],
            "commons_title": meta["title"],
            "licence": meta["licence"],
            "artist": meta["artist"],
            "credit": meta["credit"],
        }
        print(f"  {body:10s} {len(data) // 1024} kB  ({meta['licence']})")
        ok += 1
        time.sleep(0.4)

    credits_path.write_text(json.dumps(credits, indent=1, sort_keys=True), encoding="utf-8")

    print(f"\n{ok} maps available, {len(missed)} unavailable", file=sys.stderr)
    if missed:
        print(
            "Bodies without a map fall back to the generated surface, which is "
            "the correct behaviour — a missing map must never become a wrong "
            "picture: " + ", ".join(missed),
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
