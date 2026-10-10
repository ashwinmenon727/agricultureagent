"""Derive crop health metrics from live weather data.

Since we don't have actual soil sensors, we estimate crop health from:
- Temperature stress (too hot or too cold)
- Humidity levels (drought or waterlogging risk)
- Recent rainfall patterns
- Wind exposure
- Forecast trends
"""

from datetime import datetime, timezone


def compute_crop_health(weather: dict) -> dict:
    """Compute crop health score and sub-metrics from weather data.

    Returns a dict with:
      - score: 0-100 overall health percentage
      - status: "Excellent" | "Good" | "Fair" | "Poor"
      - soil_moisture: estimated percentage
      - nutrients: score out of 10
      - pest_activity: "Low" | "Moderate" | "High"
      - disease_risk: 1-10 scale
      - irrigation: action + reason
      - alerts: list of active alerts
    """
    current = weather.get("current") or {}
    forecast = weather.get("forecast") or []
    irrigation = weather.get("irrigation_advice") or {}
    alerts = weather.get("alerts") or []

    temp = current.get("temperature_c")
    humidity = current.get("humidity_pct")
    wind = current.get("wind_speed_kmh")
    rain_now = current.get("rain_mm") or current.get("precipitation_mm") or 0

    # --- Soil moisture estimate (based on humidity + recent rain + irrigation) ---
    soil_moisture = _estimate_soil_moisture(humidity, rain_now, forecast, irrigation)

    # --- Temperature stress score (0-100, 100 = ideal) ---
    temp_score = _temp_stress_score(temp)

    # --- Humidity score ---
    humidity_score = _humidity_score(humidity)

    # --- Rain adequacy ---
    rain_score = _rain_adequacy(forecast)

    # --- Wind stress ---
    wind_score = _wind_stress(wind)

    # --- Nutrients estimate (from temp + humidity trends) ---
    nutrients = _estimate_nutrients(temp_score, humidity_score, rain_score)

    # --- Pest activity (from humidity + temperature) ---
    pest_activity = _estimate_pest_risk(humidity, temp, forecast)

    # --- Disease risk (from humidity + rain + temp) ---
    disease_risk = _estimate_disease_risk(humidity, temp, forecast)

    # --- Overall score (weighted average) ---
    raw_score = (
        temp_score * 0.25
        + humidity_score * 0.20
        + rain_score * 0.25
        + wind_score * 0.10
        + (nutrients * 10) * 0.10  # 0-10 scale → 0-100, then apply 10% weight
        + (100 - disease_risk * 10) * 0.10
    )
    score = max(0, min(100, round(raw_score)))

    if score >= 80:
        status = "Excellent"
    elif score >= 60:
        status = "Good"
    elif score >= 40:
        status = "Fair"
    else:
        status = "Poor"

    return {
        "score": score,
        "status": status,
        "soil_moisture_pct": soil_moisture,
        "nutrients": nutrients,
        "pest_activity": pest_activity,
        "disease_risk": disease_risk,
        "irrigation": irrigation,
        "alerts": alerts,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


def _estimate_soil_moisture(humidity, rain_now, forecast, irrigation) -> int:
    """Estimate soil moisture 0-100% from weather cues."""
    base = 45  # neutral baseline
    if humidity is not None:
        base = max(20, min(80, humidity))
    if rain_now and rain_now > 0:
        base = min(95, base + int(rain_now * 3))
    # Check next-day rain
    if forecast:
        tomorrow_rain = (forecast[0] if len(forecast) > 0 else {}).get("rain_mm") or 0
        if tomorrow_rain > 5:
            base = min(90, base + 5)
    action = irrigation.get("action", "")
    if action == "irrigate":
        base = max(20, base - 10)  # needs water
    elif action == "skip":
        base = min(90, base + 10)  # rain coming
    return max(10, min(95, base))


def _temp_stress_score(temp) -> int:
    """100 = ideal (22-30°C), drops at extremes."""
    if temp is None:
        return 70
    if 22 <= temp <= 30:
        return 100
    elif 18 <= temp <= 35:
        return 75
    elif 10 <= temp <= 40:
        return 50
    else:
        return 25


def _humidity_score(humidity) -> int:
    """100 = ideal (50-70%), drops at extremes."""
    if humidity is None:
        return 70
    if 50 <= humidity <= 70:
        return 100
    elif 40 <= humidity <= 80:
        return 75
    elif 30 <= humidity <= 90:
        return 50
    else:
        return 30


def _rain_adequacy(forecast) -> int:
    """Score based on upcoming rain — moderate rain is good, too much or too little is bad."""
    if not forecast:
        return 60
    next_3_rain = sum((d.get("rain_mm") or 0) for d in forecast[:3])
    if 5 <= next_3_rain <= 30:
        return 100  # ideal
    elif next_3_rain < 5:
        return 50  # dry
    elif next_3_rain <= 60:
        return 70  # wet but ok
    else:
        return 30  # flood risk


def _wind_stress(wind) -> int:
    """100 = calm, drops with high wind."""
    if wind is None:
        return 80
    if wind <= 15:
        return 100
    elif wind <= 30:
        return 75
    elif wind <= 45:
        return 50
    else:
        return 25


def _estimate_nutrients(temp_score, humidity_score, rain_score) -> int:
    """Estimate nutrient availability 0-10 from environmental conditions."""
    avg = (temp_score + humidity_score + rain_score) / 3
    return max(1, min(10, round(avg / 10)))


def _estimate_pest_risk(humidity, temp, forecast) -> str:
    """Pest activity rises with warm, humid conditions."""
    if humidity is None or temp is None:
        return "Low"
    # Warm + humid = high pest risk
    if humidity >= 75 and temp >= 28:
        return "High"
    if humidity >= 60 and temp >= 25:
        return "Moderate"
    return "Low"


def _estimate_disease_risk(humidity, temp, forecast) -> int:
    """Disease risk 1-10 from humidity + prolonged rain."""
    if humidity is None or temp is None:
        return 3
    risk = 3
    if humidity >= 80:
        risk += 3
    if humidity >= 70:
        risk += 1
    # Check sustained rain
    if forecast:
        rainy_days = sum(1 for d in forecast[:5] if (d.get("rain_mm") or 0) > 2)
        if rainy_days >= 3:
            risk += 2
    return max(1, min(10, risk))


def compute_forecast_agricultural_advice(forecast: list[dict], current: dict) -> list[dict]:
    """Add farming-relevant labels to each forecast day."""
    advice_map = []
    for day in forecast:
        rain = day.get("rain_mm") or 0
        prob = day.get("rain_probability_pct") or 0
        temp_max = day.get("temp_max_c") or 0
        condition = day.get("condition", "")

        label = ""
        css_class = ""

        if "thunder" in condition:
            label = "No spray"
            css_class = "warn"
        elif rain >= 20 or prob >= 80:
            label = "Delay spray"
            css_class = "warn"
        elif rain >= 5 or prob >= 50:
            label = f"{rain:.0f}mm rain"
            css_class = ""
        elif temp_max >= 35:
            label = "Irrigate"
            css_class = ""
        elif condition in ("clear", "mainly_clear"):
            label = "Spray AM"
            css_class = "best"
        else:
            label = "Good day"
            css_class = ""

        advice_map.append({
            **day,
            "advice_label": label,
            "advice_class": css_class,
        })
    return advice_map
