from datetime import datetime, timezone
import logging

import httpx

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_CODES = {
    0: "clear",
    1: "mainly_clear",
    2: "partly_cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "light_drizzle",
    53: "drizzle",
    55: "heavy_drizzle",
    61: "light_rain",
    63: "rain",
    65: "heavy_rain",
    66: "freezing_rain",
    67: "freezing_rain",
    71: "light_snow",
    73: "snow",
    75: "heavy_snow",
    77: "snow_grains",
    80: "rain_showers",
    81: "rain_showers",
    82: "heavy_rain_showers",
    85: "snow_showers",
    86: "heavy_snow_showers",
    95: "thunderstorm",
    96: "thunderstorm_hail",
    99: "thunderstorm_hail",
}


async def get_live_weather(
    latitude: float,
    longitude: float,
    elevation: float | None = None,
    location_label: str = "",
) -> dict:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "rain",
                "weather_code",
                "wind_speed_10m",
                "wind_gusts_10m",
            ]
        ),
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "rain_sum",
            ]
        ),
        "forecast_days": 7,
        "timezone": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(FORECAST_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        logger.warning("Weather API timeout for lat=%s lon=%s", latitude, longitude)
        return {"source": "open-meteo", "error": "timeout", "current": {}, "forecast": [], "alerts": [], "irrigation_advice": {}}
    except httpx.HTTPStatusError as exc:
        logger.warning("Weather API HTTP %s for lat=%s lon=%s", exc.response.status_code, latitude, longitude)
        return {"source": "open-meteo", "error": f"http_{exc.response.status_code}", "current": {}, "forecast": [], "alerts": [], "irrigation_advice": {}}
    except Exception as exc:
        logger.warning("Weather API error for lat=%s lon=%s: %s", latitude, longitude, exc)
        return {"source": "open-meteo", "error": str(exc), "current": {}, "forecast": [], "alerts": [], "irrigation_advice": {}}

    current = data.get("current") or {}
    daily = data.get("daily") or {}
    forecast_days = []

    dates = daily.get("time") or []
    for i, day in enumerate(dates):
        forecast_days.append(
            {
                "date": day,
                "weather_code": _at(daily.get("weather_code"), i),
                "condition": WEATHER_CODES.get(_at(daily.get("weather_code"), i), "unknown"),
                "temp_max_c": _at(daily.get("temperature_2m_max"), i),
                "temp_min_c": _at(daily.get("temperature_2m_min"), i),
                "rain_mm": _at(daily.get("rain_sum"), i) or 0,
                "precip_mm": _at(daily.get("precipitation_sum"), i) or 0,
                "rain_probability_pct": _at(daily.get("precipitation_probability_max"), i) or 0,
            }
        )

    alerts = _build_farmer_alerts(
        current=current,
        forecast_days=forecast_days,
        elevation=elevation,
    )

    irrigation = _irrigation_advice(current, forecast_days)

    return {
        "source": "open-meteo",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "location": location_label,
        "latitude": latitude,
        "longitude": longitude,
        "elevation_m": elevation,
        "current": {
            "temperature_c": current.get("temperature_2m"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "precipitation_mm": current.get("precipitation") or 0,
            "rain_mm": current.get("rain") or 0,
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "wind_gusts_kmh": current.get("wind_gusts_10m"),
            "weather_code": current.get("weather_code"),
            "condition": WEATHER_CODES.get(current.get("weather_code"), "unknown"),
        },
        "forecast": forecast_days,
        "alerts": alerts,
        "irrigation_advice": irrigation,
    }


def _at(values, index):
    if not values or index >= len(values):
        return None
    return values[index]


def _build_farmer_alerts(
    current: dict,
    forecast_days: list[dict],
    elevation: float | None,
) -> list[dict]:
    alerts = []
    elev = elevation or 0
    is_hilly = elev >= 400

    next_3_days_rain = sum(d.get("precip_mm") or 0 for d in forecast_days[:3])
    max_daily_rain = max((d.get("precip_mm") or 0 for d in forecast_days[:3]), default=0)
    wind = current.get("wind_speed_10m") or 0
    gusts = current.get("wind_gusts_10m") or 0

    if max_daily_rain >= 50:
        alerts.append(
            {
                "level": "warning",
                "type": "heavy_rain",
                "title": "Heavy rain expected",
                "message": "Heavy rain in the next few days. Delay irrigation and ensure field drainage.",
            }
        )

    if next_3_days_rain >= 80:
        alerts.append(
            {
                "level": "severe",
                "type": "flood_risk",
                "title": "Flood risk",
                "message": "Very high rainfall totals forecast. Move equipment, protect stored grain, avoid low fields.",
            }
        )

    if is_hilly and (max_daily_rain >= 60 or next_3_days_rain >= 100):
        alerts.append(
            {
                "level": "severe",
                "type": "landslide_risk",
                "title": "Landslide / mudslide risk",
                "message": "Hilly terrain + heavy rain: avoid steep slopes, watch for soil cracks, clear drainage channels.",
            }
        )

    if gusts >= 60 or wind >= 45:
        alerts.append(
            {
                "level": "warning",
                "type": "storm_wind",
                "title": "Strong wind alert",
                "message": "Secure nursery covers, trellis, and stacked produce. Delay spraying in high wind.",
            }
        )

    storm_days = [d for d in forecast_days[:5] if (d.get("weather_code") or 0) >= 95]
    if storm_days:
        alerts.append(
            {
                "level": "warning",
                "type": "thunderstorm",
                "title": "Thunderstorm forecast",
                "message": "Thunderstorms expected. Avoid open fields, unplug pumps, do not spray chemicals.",
            }
        )

    heat_days = [d for d in forecast_days[:5] if (d.get("temp_max_c") or 0) >= 38]
    if heat_days:
        alerts.append(
            {
                "level": "info",
                "type": "heat_stress",
                "title": "Heat stress risk",
                "message": "High temperatures forecast. Irrigate early morning/evening; avoid nitrogen top-dress in peak heat.",
            }
        )

    return alerts


def _irrigation_advice(current: dict, forecast_days: list[dict]) -> dict:
    today = forecast_days[0] if forecast_days else {}
    rain_today = today.get("precip_mm") or 0
    rain_prob = today.get("rain_probability_pct") or 0
    rain_next_2 = sum((d.get("precip_mm") or 0) for d in forecast_days[1:3])

    if rain_today >= 10 or rain_prob >= 70:
        action = "skip"
        reason = "Rain expected today — skip irrigation and recheck soil moisture tomorrow."
    elif rain_next_2 >= 25:
        action = "delay"
        reason = "Rain likely in next 2 days — delay irrigation unless crops show wilting."
    elif (current.get("temperature_2m") or 0) >= 35 and rain_today < 2:
        action = "irrigate"
        reason = "Hot and dry today — irrigate early morning or evening if soil is dry 5–7 cm deep."
    else:
        action = "check"
        reason = "Check soil moisture 5–7 cm deep before irrigating."

    return {"action": action, "reason": reason}


def format_weather_context(weather: dict) -> str:
    if not weather:
        return ""

    current = weather.get("current") or {}
    lines = [
        f"Live weather ({weather.get('location') or 'user location'}):",
        f"- Now: {current.get('temperature_c')}°C, humidity {current.get('humidity_pct')}%, "
        f"condition {current.get('condition')}, wind {current.get('wind_speed_kmh')} km/h",
    ]

    forecast = weather.get("forecast") or []
    if forecast:
        next_days = forecast[:3]
        rain_bits = [
            f"{d['date']}: {d.get('precip_mm', 0)}mm rain ({d.get('rain_probability_pct', 0)}% chance)"
            for d in next_days
        ]
        lines.append("- 3-day rain forecast: " + "; ".join(rain_bits))

    alerts = weather.get("alerts") or []
    if alerts:
        lines.append("- Active alerts: " + "; ".join(a["title"] for a in alerts))

    irrigation = weather.get("irrigation_advice") or {}
    if irrigation.get("reason"):
        lines.append(f"- Irrigation: {irrigation['action']} — {irrigation['reason']}")

    return "\n".join(lines)
