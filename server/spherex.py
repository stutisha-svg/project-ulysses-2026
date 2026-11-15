"""SPHEREx cutout fetcher.

The browser never calls IRSA. Vite proxies /api to this process.
No API key: the archive queries used here are public.
"""

from __future__ import annotations

import base64
import io
import math
import time
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from fastapi import FastAPI, HTTPException, Query
from PIL import Image

# Hot stars: detectors D1–D2, about 0.75–1.6 μm.
# Cold icy objects: detectors D4–D6, about 2.4–5.0 μm.
# Blink stays inside one group. These names are the archive's own bandpasses.
BAND_GROUPS = {
    "hot": ("SPHEREx-D1", "SPHEREx-D2"),
    "cold": ("SPHEREx-D4", "SPHEREx-D5", "SPHEREx-D6"),
}

# Midpoint of each detector's wavelength range, in μm.
# A frame's center wavelength replaces this when the spectral WCS can be read.
BAND_MID_UM = {
    "SPHEREx-D1": 0.93,
    "SPHEREx-D2": 1.38,
    "SPHEREx-D4": 3.12,
    "SPHEREx-D5": 4.12,
    "SPHEREx-D6": 4.71,
}

# Downloads stop here. The visit list itself is not capped.
MAX_FRAMES = 6
# Exposures closer than this are one visit, not two epochs.
VISIT_GAP_DAYS = 1.0
TAP_URL = "https://irsa.ipac.caltech.edu/TAP/sync"
CACHE = Path(__file__).resolve().parent / "cache"

app = FastAPI(title="Ulysses SPHEREx")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/visits")
def visits(
    ra: float = Query(..., ge=0, le=360),
    dec: float = Query(..., ge=-90, le=90),
    size: float = Query(0.05, gt=0, le=0.2),
) -> dict:
    rows = query_archive(ra, dec, size, all_bandpasses())
    grouped = {name: cluster_visits(rows, bands) for name, bands in BAND_GROUPS.items()}
    return {
        "ra": ra,
        "dec": dec,
        "sizeDeg": size,
        "groups": {
            name: [public_visit(visit) for visit in visits_for_group]
            for name, visits_for_group in grouped.items()
        },
    }


@app.get("/api/frames")
def frames(
    ra: float = Query(..., ge=0, le=360),
    dec: float = Query(..., ge=-90, le=90),
    size: float = Query(0.05, gt=0, le=0.2),
    group: str = Query("hot"),
) -> dict:
    bands = BAND_GROUPS.get(group)
    if bands is None:
        raise HTTPException(status_code=400, detail="group must be hot or cold")
    rows = query_archive(ra, dec, size, bands)
    chosen = pick_frames(cluster_visits(rows, bands))
    loaded = [load_frame(row) for row in chosen]
    return {
        "ra": ra,
        "dec": dec,
        "sizeDeg": size,
        "group": group,
        "frames": loaded,
    }


def all_bandpasses() -> tuple[str, ...]:
    return tuple(band for bands in BAND_GROUPS.values() for band in bands)


def query_archive(ra: float, dec: float, size: float, bandpasses: tuple[str, ...]) -> list[dict]:
    names = ", ".join(f"'{name}'" for name in bandpasses)
    # Numbers are validated by the route. Band names come from BAND_GROUPS, not the caller.
    query = f"""
        SELECT
            'https://irsa.ipac.caltech.edu/' || a.uri
                || '?center={ra:.6f},{dec:.6f}d&size={size:.4f}' AS uri,
            p.time_bounds_lower AS observed,
            p.energy_bandpassname AS bandpass
        FROM spherex.artifact a
        JOIN spherex.plane p ON a.planeid = p.planeid
        WHERE 1 = CONTAINS(POINT('ICRS', {ra:.6f}, {dec:.6f}), p.poly)
          AND p.energy_bandpassname IN ({names})
        ORDER BY p.time_bounds_lower
    """
    try:
        from astroquery.ipac.irsa import Irsa

        table = Irsa.query_tap(query)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"IRSA TAP failed: {error}") from error

    found = []
    for row in table:
        found.append(
            {
                "uri": str(row["uri"]),
                "observed": stringify(row["observed"]),
                "mjd": to_mjd(row["observed"]),
                "bandpass": str(row["bandpass"]),
            }
        )
    return found


def cluster_visits(rows: list[dict], bandpasses: tuple[str, ...]) -> list[dict]:
    wanted = [row for row in rows if row["bandpass"] in bandpasses and row["mjd"] is not None]
    wanted.sort(key=lambda row: row["mjd"])
    visits: list[dict] = []
    for row in wanted:
        if not visits or row["mjd"] - visits[-1]["mjd"] > VISIT_GAP_DAYS:
            visits.append({"mjd": row["mjd"], "observed": row["observed"], "rows": [row]})
        else:
            visits[-1]["rows"].append(row)
    for visit in visits:
        visit["row"] = choose_row(visit["rows"], bandpasses)
    return visits


def choose_row(rows: list[dict], bandpasses: tuple[str, ...]) -> dict:
    order = {name: index for index, name in enumerate(bandpasses)}
    return sorted(rows, key=lambda row: order.get(row["bandpass"], 99))[len(rows) // 2]


def pick_frames(visits: list[dict]) -> list[dict]:
    if len(visits) <= MAX_FRAMES:
        return [visit["row"] for visit in visits]
    indexes = np.linspace(0, len(visits) - 1, MAX_FRAMES)
    unique = sorted({int(round(index)) for index in indexes})
    return [visits[index]["row"] for index in unique]


def public_visit(visit: dict) -> dict:
    row = visit["row"]
    return {
        "observed": visit["observed"],
        "bandpass": row["bandpass"],
        "wavelengthUm": wavelength_um(None, row["bandpass"]),
    }


def load_frame(row: dict) -> dict:
    path = cached_fits(row)
    with fits.open(path) as hdul:
        image = np.array(hdul["IMAGE"].data, dtype=np.float32)
        variance = array_or_none(hdul, "VARIANCE")
        flags = array_or_none(hdul, "FLAGS")
        header = hdul["IMAGE"].header
        wavelength = wavelength_um(header, row["bandpass"])
        north = north_angle_deg(header)
    height, width = image.shape
    return {
        "observed": row["observed"],
        "bandpass": row["bandpass"],
        "wavelengthUm": wavelength,
        "width": int(width),
        "height": int(height),
        # Row 0 is the first FITS row. The array is not rotated to put north up.
        "northAngleDeg": north,
        "previewPng": preview_png(image),
        "image": encode_float32(image),
        "variance": encode_float32(variance) if variance is not None else None,
        # FLAGS are returned as stored. A set bit is not always a defect.
        "flags": encode_int32(flags) if flags is not None else None,
    }


def cached_fits(row: dict) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    # Round the aim so a tiny pan reuses the file. Band and size stay in the URL.
    name = cache_name(row["uri"])
    path = CACHE / name
    if path.exists():
        return path
    request = Request(row["uri"], headers={"User-Agent": "Ulysses-SPHEREx/0.1"})
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            with urlopen(request, timeout=90) as response:
                path.write_bytes(response.read())
            return path
        except Exception as error:
            last_error = error
            # IRSA cutouts sometimes answer 503 for a moment. Try the same URL once more.
            if attempt == 0 and getattr(error, "code", None) == 503:
                time.sleep(2)
                continue
            break
    raise HTTPException(status_code=502, detail=f"Cutout download failed: {last_error}") from last_error


def cache_name(uri: str) -> str:
    safe = "".join(character if character.isalnum() else "_" for character in uri)
    return safe[-180:] + ".fits"


def array_or_none(hdul, extname: str) -> np.ndarray | None:
    if extname not in hdul:
        return None
    return np.array(hdul[extname].data)


def wavelength_um(header, bandpass: str) -> float:
    if header is not None:
        try:
            spectral = WCS(header, key="W")
            center = spectral.pixel_to_world(*[axis // 2 for axis in header_shape(header)])
            value = float(np.atleast_1d(center)[-1])
            if math.isfinite(value) and value > 0:
                # Spectral WCS is in meters. The UI speaks in micrometers.
                return value * 1e6 if value < 1e-3 else value
        except Exception:
            pass
    return BAND_MID_UM[bandpass]


def header_shape(header) -> tuple[int, int]:
    return int(header.get("NAXIS1", 1)), int(header.get("NAXIS2", 1))


def north_angle_deg(header) -> float | None:
    """Clockwise degrees from the top of the stored array to celestial north.

    The cutout stays in spacecraft orientation. This angle is only a mark.
    """
    try:
        celestial = WCS(header).celestial
        width, height = header_shape(header)
        center = ((width - 1) / 2, (height - 1) / 2)
        from astropy import units as u

        sky = celestial.pixel_to_world(*center)
        north = celestial.world_to_pixel(sky.directional_offset_by(0 * u.deg, 1 * u.arcsec))
        dx = float(north[0] - center[0])
        dy = float(north[1] - center[1])
        # FITS y grows with row number. A screen draws row 0 at the top, so flip y.
        return math.degrees(math.atan2(dx, -dy))
    except Exception:
        return None


def preview_png(image: np.ndarray) -> str:
    finite = image[np.isfinite(image)]
    if finite.size == 0:
        gray = np.zeros(image.shape, dtype=np.uint8)
    else:
        lo, hi = np.percentile(finite, [1, 99.5])
        span = max(float(hi - lo), 1e-8)
        scaled = np.arcsinh((image - lo) / span)
        scaled = np.nan_to_num(scaled, nan=0.0)
        peak = max(float(np.percentile(scaled, 99.5)), 1e-8)
        gray = np.clip(scaled / peak * 255, 0, 255).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(gray, mode="L").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def encode_float32(values: np.ndarray) -> str:
    array = np.nan_to_num(values.astype(np.float32), nan=0.0)
    return base64.b64encode(np.ascontiguousarray(array).tobytes()).decode("ascii")


def encode_int32(values: np.ndarray) -> str:
    array = values.astype(np.int32, copy=False)
    return base64.b64encode(np.ascontiguousarray(array).tobytes()).decode("ascii")


def to_mjd(value) -> float | None:
    from astropy.time import Time

    if value is None:
        return None
    try:
        number = float(value)
        if math.isfinite(number):
            return number
    except (TypeError, ValueError):
        pass
    try:
        return float(Time(str(value), scale="utc").mjd)
    except Exception:
        return None


def stringify(value) -> str:
    if value is None:
        return ""
    return str(value)
