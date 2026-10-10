import logging

import httpx

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


async def search_locations(query: str, language: str = "en", count: int = 8) -> list[dict]:
    if not query or len(query.strip()) < 2:
        return []

    params = {
        "name": query.strip(),
        "count": count,
        "language": language,
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(GEOCODE_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("Geocode search failed for '%s': %s", query, exc)
        return []

    results = []
    for item in data.get("results") or []:
        results.append(
            {
                "name": item.get("name"),
                "admin1": item.get("admin1"),
                "country": item.get("country"),
                "country_code": item.get("country_code"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "elevation": item.get("elevation"),
                "timezone": item.get("timezone"),
                "label": _format_label(item),
            }
        )
    return results


def _format_label(item: dict) -> str:
    parts = [item.get("name"), item.get("admin1"), item.get("country")]
    return ", ".join(p for p in parts if p)


NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


async def reverse_geocode(lat: float, lon: float) -> dict | None:
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 3,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": "AgriGuide/0.2"}) as client:
            response = await client.get(NOMINATIM_URL, params=params)
            response.raise_for_status()
            data = response.json()
        address = data.get("address") or {}
        cc = address.get("country_code")
        if cc:
            return {"country_code": cc.upper(), "country": address.get("country")}
    except Exception as exc:
        logger.warning("Reverse geocode failed: %s", exc)
    return None
