/**
 * dashboard.js — Renders live weather + crop health data into the dashboard sections.
 *
 * Called from app.js after fetching data from /api/crop-health.
 * Handles: header weather widget, hero panel, crop health gauge, metric tiles,
 *          7-day forecast strip, alert bar, and agent status speech bubble.
 */

const WEATHER_ICONS = {
  clear: "☀️",
  mainly_clear: "🌤️",
  partly_cloudy: "⛅",
  overcast: "☁️",
  fog: "🌫️",
  light_drizzle: "🌦️",
  drizzle: "🌦️",
  heavy_drizzle: "🌧️",
  light_rain: "🌦️",
  rain: "🌧️",
  heavy_rain: "🌧️",
  freezing_rain: "🧊",
  light_snow: "🌨️",
  snow: "❄️",
  heavy_snow: "❄️",
  snow_grains: "❄️",
  rain_showers: "🌦️",
  heavy_rain_showers: "🌧️",
  snow_showers: "🌨️",
  heavy_snow_showers: "❄️",
  thunderstorm: "⛈️",
  thunderstorm_hail: "⛈️",
  unknown: "🌡️",
};

function weatherIcon(condition) {
  return WEATHER_ICONS[condition] || "🌡️";
}

function tempIcon(temp) {
  if (temp == null) return "🌡️";
  if (temp >= 38) return "🔥";
  if (temp >= 32) return "🌡️";
  if (temp >= 20) return "☀️";
  if (temp >= 10) return "🌤️";
  return "❄️";
}

function shortDay(dateStr) {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short" });
  } catch {
    return dateStr.slice(-2);
  }
}

function formatCondition(condition) {
  if (!condition) return "--";
  return condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(isoStr) {
  if (!isoStr) return "";
  try {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderOverview(weather, health) {
  const cur = weather?.current || {};
  const hasWeather = cur.temperature_c != null;
  const hasHealth = health?.score != null;

  setText("overview-health", hasHealth ? `${health.score}%` : "--");
  setText("overview-health-note", hasHealth ? health.status : "Waiting for live data");
  setText("overview-moisture", health?.soil_moisture_pct != null ? `${health.soil_moisture_pct}%` : "--");
  setText("overview-temp", hasWeather ? `${Math.round(cur.temperature_c)}°C` : "--");
  setText("overview-weather-note", hasWeather ? formatCondition(cur.condition) : "Set a location");

  const irrigation = health?.irrigation || weather?.irrigation_advice;
  const alerts = health?.alerts || weather?.alerts || [];
  let action = "Ready";
  let note = "Ask Vayal";
  if (alerts.length) {
    action = alerts[0].level === "severe" ? "Urgent review" : "Review alert";
    note = alerts[0].title || alerts[0].message || "Weather risk detected";
  } else if (irrigation?.action) {
    const labels = { skip: "Skip irrigation", delay: "Delay irrigation", irrigate: "Irrigate", check: "Check soil" };
    action = labels[irrigation.action] || "Review conditions";
    note = irrigation.reason || "Weather-aware recommendation";
  }
  setText("overview-action", action);
  setText("overview-action-note", note);
}

/* ---------- Shown in: header weather widget ---------- */
function renderHeaderWeather(weather) {
  const el = document.getElementById("header-weather");
  if (!el) return;
  const cur = weather?.current || {};
  const icon = el.querySelector('[data-field="icon"]');
  const temp = el.querySelector('[data-field="temp"]');
  const desc = el.querySelector('[data-field="desc"]');
  if (icon) icon.textContent = weatherIcon(cur.condition);
  if (temp) temp.textContent = cur.temperature_c != null ? `${Math.round(cur.temperature_c)}°C` : "--°C";
  if (desc) desc.textContent = formatCondition(cur.condition);
}

/* ---------- Shown in: hero panel — crop health ---------- */
function renderHeroCropHealth(health) {
  const el = document.getElementById("hero-crop-health");
  if (!el) return;
  const value = el.querySelector('[data-field="value"]');
  const status = el.querySelector('[data-field="status"]');
  const updated = el.querySelector('[data-field="updated"]');
  if (!health) {
    if (value) value.textContent = "--";
    if (status) status.textContent = "Waiting for data";
    if (updated) updated.textContent = "";
    return;
  }
  const score = health.score ?? 0;
  const statusEmoji = score >= 80 ? "🟢" : score >= 60 ? "🟡" : score >= 40 ? "🟠" : "🔴";
  if (value) {
    value.textContent = `${score}%`;
    animateCountUp(value, score, "%");
  }
  if (status) status.textContent = `${statusEmoji} ${health.status}`;
  if (updated) updated.textContent = `Updated ${timeAgo(health.computed_at)}`;
}

/* ---------- Shown in: hero panel — weather strip ---------- */
function renderHeroWeatherStrip(weather) {
  const el = document.getElementById("hero-weather-strip");
  if (!el) return;
  const cur = weather?.current || {};
  const tempEl = el.querySelector('[data-field="temp"]');
  const humidEl = el.querySelector('[data-field="humidity"]');
  const windEl = el.querySelector('[data-field="wind"]');
  if (tempEl) tempEl.textContent = cur.temperature_c != null ? `${Math.round(cur.temperature_c)}°C` : "--";
  if (humidEl) humidEl.textContent = cur.humidity_pct != null ? `${cur.humidity_pct}%` : "--%";
  if (windEl) windEl.textContent = cur.wind_speed_kmh != null ? `${Math.round(cur.wind_speed_kmh)}` : "--";
}

/* ---------- Shown in: crop health gauge card ---------- */
function renderCropHealthCard(health) {
  // Gauge
  const gauge = document.getElementById("crop-health-gauge");
  if (gauge) {
    const score = health?.score ?? 0;
    gauge.style.setProperty("--score", score);
    const scoreEl = gauge.querySelector('[data-field="score"]');
    if (scoreEl) scoreEl.textContent = health ? `${score}%` : "--";
  }

  // Metric tiles
  const grid = document.getElementById("crop-metrics");
  if (!grid) return;
  if (!health) {
    grid.querySelectorAll('[data-field="value"]').forEach((el) => (el.textContent = "--"));
    grid.querySelectorAll('[data-field="sub"]').forEach((el) => (el.textContent = "Waiting for data"));
    return;
  }

  const metrics = [
    {
      key: "soil-moisture",
      value: health.soil_moisture_pct != null ? `${health.soil_moisture_pct}%` : "--",
      sub: health.soil_moisture_pct >= 60 ? "Adequate" : health.soil_moisture_pct >= 40 ? "Monitor" : "Needs water",
    },
    {
      key: "nutrients",
      value: health.nutrients != null ? `${health.nutrients}/10` : "--",
      sub: health.nutrients >= 7 ? "Good levels" : health.nutrients >= 4 ? "Moderate" : "May need fertilizer",
    },
    {
      key: "pest-activity",
      value: health.pest_activity || "--",
      sub: health.pest_activity === "High" ? "Scout fields" : health.pest_activity === "Moderate" ? "Monitor traps" : "No concern",
    },
    {
      key: "disease-risk",
      value: health.disease_risk != null ? String(health.disease_risk).padStart(2, "0") : "--",
      sub: health.disease_risk >= 7 ? "High risk" : health.disease_risk >= 4 ? "Moderate" : "Low risk",
    },
  ];

  metrics.forEach((m) => {
    const tile = grid.querySelector(`[data-metric="${m.key}"]`);
    if (!tile) return;
    const val = tile.querySelector('[data-field="value"]');
    const sub = tile.querySelector('[data-field="sub"]');
    if (val) val.textContent = m.value;
    if (sub) sub.textContent = m.sub;
  });
}

/* ---------- Shown in: 7-day forecast strip ---------- */
function renderForecastStrip(forecast) {
  const strip = document.getElementById("forecast-strip");
  const impact = document.getElementById("forecast-impact");
  if (!strip) return;

  strip.innerHTML = "";

  if (!forecast || !forecast.length) {
    strip.innerHTML = '<div class="forecast-day"><span class="day-label">Set location</span><span class="day-cond">Forecast unavailable</span></div>';
    if (impact) impact.textContent = "Select your farm location to see spray, irrigation, and heat-risk guidance.";
    return;
  }

  forecast.slice(0, 7).forEach((day) => {
    const div = document.createElement("div");
    const cls = day.advice_class || "";
    div.className = `forecast-day ${cls}`;
    div.innerHTML = `
      <span class="day-label">${shortDay(day.date)}</span>
      <span class="day-temp">${tempIcon(day.temp_max_c)} ${day.temp_max_c != null ? Math.round(day.temp_max_c) : "--"}°</span>
      <span class="day-cond">${day.advice_label || formatCondition(day.condition)}</span>
    `;
    strip.appendChild(div);
  });

  // Impact note
  if (impact) {
    const rain3 = forecast.slice(0, 3).reduce((s, d) => s + (d.rain_mm || 0), 0);
    const hasThunder = forecast.slice(0, 5).some((d) => (d.condition || "").includes("thunder"));
    const hotDay = forecast.find((d) => (d.temp_max_c || 0) >= 38);

    const parts = [];
    if (rain3 > 5) parts.push(`Expected ${rain3.toFixed(0)}mm rain in next 3 days — adjust irrigation accordingly.`);
    if (hasThunder) parts.push("Thunderstorms forecast — avoid spraying and secure equipment.");
    if (hotDay) parts.push(`Heat stress possible on ${shortDay(hotDay.date)} — irrigate early morning.`);
    if (!parts.length) parts.push("Conditions look stable for farm operations this week.");
    impact.textContent = parts.join(" ");
  }
}

/* ---------- Shown in: alert bar ---------- */
function renderAlertBar(alerts) {
  const bar = document.getElementById("alert-bar");
  if (!bar) return;

  if (!alerts || !alerts.length) {
    bar.classList.add("hidden");
    return;
  }

  // Show the first/severity alert
  const alert = alerts[0];
  bar.classList.remove("hidden");

  const levelColors = {
    severe: "var(--danger)",
    warning: "var(--warning)",
    info: "var(--info)",
  };

  const levelEl = bar.querySelector('[data-field="level"]');
  const msgEl = bar.querySelector('[data-field="msg"]');
  const timeEl = bar.querySelector('[data-field="time"]');
  const detailsEl = bar.querySelector('[data-field="details"]');

  bar.style.borderLeftColor = levelColors[alert.level] || levelColors.info;
  if (levelEl) levelEl.textContent = (alert.level || "info").toUpperCase();
  if (msgEl) msgEl.textContent = alert.title || alert.message;
  if (timeEl) timeEl.textContent = alert.message || "";
  if (detailsEl) {
    detailsEl.textContent = alerts.length > 1
      ? alerts.map((a) => `${a.title}: ${a.message}`).join("\n\n")
      : alert.message || "";
  }
}

/* ---------- Shown in: agent status card speech bubble ---------- */
function renderAgentSpeech(weather, health) {
  const el = document.getElementById("agent-speech");
  if (!el) return;

  const irrigation = health?.irrigation || weather?.irrigation_advice;
  const alerts = health?.alerts || weather?.alerts || [];

  if (irrigation?.reason) {
    el.textContent = `Irrigation: ${irrigation.reason}`;
  } else if (alerts.length > 0) {
    el.textContent = `Alert: ${alerts[0].title} — ${alerts[0].message}`;
  } else if (weather?.current) {
    const cur = weather.current;
    el.textContent = `${cur.temperature_c ?? "--"}°C, ${formatCondition(cur.condition)} — ${cur.humidity_pct ?? "--"}% humidity`;
  } else {
    el.textContent = "Set your farm location to activate live recommendations.";
  }
}

/* ---------- Main render function ---------- */
export function renderDashboard(weather, cropHealthData) {
  const health = cropHealthData?.health;
  const forecast = cropHealthData?.forecast;

  renderOverview(weather, health);
  renderHeaderWeather(weather);
  renderHeroCropHealth(health);
  renderHeroWeatherStrip(weather);
  renderCropHealthCard(health);
  renderForecastStrip(forecast || weather?.forecast);
  renderAlertBar(health?.alerts || weather?.alerts);
  renderAgentSpeech(weather, health);
}

/* ---------- Fetch crop health from backend ---------- */
export async function fetchCropHealth(location) {
  if (!location?.latitude || !location?.longitude) return null;
  const params = new URLSearchParams({
    lat: location.latitude,
    lon: location.longitude,
  });
  if (location.elevation != null) params.set("elevation", location.elevation);
  if (location.label) params.set("label", location.label);

  try {
    const res = await fetch(`/api/crop-health?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ---------- Count-up animation helper ---------- */
function animateCountUp(element, target, suffix = "") {
  let current = 0;
  const duration = 600;
  const steps = 20;
  const increment = target / steps;
  const interval = duration / steps;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = Math.round(current) + suffix;
  }, interval);
}
