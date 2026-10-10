import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REFERENCE_PATH = DATA_DIR / "market_reference.json"

INDIA_MANDI_URL = (
    "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
)


_reference_cache: dict | None = None


def _load_reference() -> dict:
    global _reference_cache
    if _reference_cache is not None:
        return _reference_cache
    with open(REFERENCE_PATH, encoding="utf-8") as f:
        _reference_cache = json.load(f)
    return _reference_cache


async def _fetch_india_mandi_live(limit: int = 15) -> list[dict]:
    api_key = os.getenv("DATA_GOV_IN_API_KEY", "").strip()
    if not api_key:
        return []

    params = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
        "offset": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(INDIA_MANDI_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("India mandi API error: %s", exc)
        return []

    records = data.get("records") or []
    live = []
    for row in records:
        live.append(
            {
                "item": row.get("commodity") or row.get("Commodity"),
                "market": row.get("market") or row.get("Market"),
                "state": row.get("state") or row.get("State"),
                "price": row.get("modal_price") or row.get("Modal_Price"),
                "unit": row.get("unit") or "₹/quintal",
                "date": row.get("arrival_date") or row.get("Arrival_Date"),
                "source": "data.gov.in-live",
            }
        )
    return live


async def get_market_rates(country_code: str = "IN", category: str = "all") -> dict:
    reference = _load_reference()
    country = reference.get("countries", {}).get(country_code.upper())
    if not country:
        country = reference.get("countries", {}).get("IN")

    live_crops = []
    if country_code.upper() == "IN":
        live_crops = await _fetch_india_mandi_live()

    crops = live_crops if live_crops else country.get("crops", [])
    fertilizers = country.get("fertilizers", [])
    pesticides = country.get("pesticides", [])

    payload = {
        "source": "live" if live_crops else "reference",
        "country_code": country_code.upper(),
        "country_name": country.get("name"),
        "currency": country.get("currency"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "reference_updated": country.get("updated_at"),
        "note": country.get("note"),
        "crops": crops,
        "fertilizers": fertilizers,
        "pesticides": pesticides,
    }

    if category == "crops":
        return {k: payload[k] for k in ("source", "country_code", "currency", "updated_at", "crops", "note")}
    if category == "fertilizers":
        return {
            k: payload[k]
            for k in ("source", "country_code", "currency", "updated_at", "fertilizers", "note")
        }
    if category == "pesticides":
        return {
            k: payload[k]
            for k in ("source", "country_code", "currency", "updated_at", "pesticides", "note")
        }
    return payload


def format_market_context(rates: dict) -> str:
    if not rates:
        return ""

    currency = rates.get("currency", "")
    lines = [
        f"Market rates for {rates.get('country_name')} (currency: {currency}, source: {rates.get('source')}):",
        "IMPORTANT: Use the prices and units EXACTLY as shown below. Do not convert or recalculate.",
    ]

    lines.append("--- CROPS ---")
    for crop in (rates.get("crops") or [])[:6]:
        price = crop.get("price")
        unit = crop.get("unit", "")
        item = crop.get("item")
        market = crop.get("market") or crop.get("region") or ""
        trend = crop.get("trend", "")
        entry = f"- {item}: {price} {unit}"
        if market:
            entry += f" ({market})"
        if trend:
            entry += f" [{trend}]"
        lines.append(entry)

    lines.append("--- FERTILIZERS ---")
    for fert in (rates.get("fertilizers") or [])[:4]:
        lines.append(f"- {fert.get('item')}: {fert.get('price')} {fert.get('unit')}")

    lines.append("--- PESTICIDES ---")
    for pest in (rates.get("pesticides") or [])[:4]:
        lines.append(f"- {pest.get('item')}: {pest.get('price')} {pest.get('unit')}")

    if rates.get("note"):
        lines.append(f"Note: {rates['note']}")

    return "\n".join(lines)
