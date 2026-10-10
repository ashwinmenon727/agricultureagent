import { detectCountryCode } from "./location.js";
import { fetchCropHealth } from "./dashboard.js";

let weatherCache = null;
let marketCache = null;
let cropHealthCache = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeClass(value, allowed, fallback = "") {
  const candidate = String(value ?? "").toLowerCase();
  return allowed.includes(candidate) ? candidate : fallback;
}

export async function fetchLiveWeather(location) {
  if (!location?.latitude || !location?.longitude) return null;

  const params = new URLSearchParams({
    lat: location.latitude,
    lon: location.longitude,
    label: location.label || "",
  });
  if (location.elevation != null) params.set("elevation", location.elevation);

  const res = await fetch(`/api/weather/live?${params}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  weatherCache = await res.json();
  return weatherCache;
}

export async function fetchMarketRates(location) {
  const country = detectCountryCode(location);
  const res = await fetch(`/api/market/rates?country=${country}`);
  if (!res.ok) throw new Error("Market fetch failed");
  marketCache = await res.json();
  return marketCache;
}

export async function fetchCropHealthData(location) {
  cropHealthCache = await fetchCropHealth(location);
  return cropHealthCache;
}

export function getCachedWeather() {
  return weatherCache;
}

export function getCachedMarket() {
  return marketCache;
}

export function getCachedCropHealth() {
  return cropHealthCache;
}

export function renderLivePanel(container, weather, market, t) {
  if (!container) return;
  container.innerHTML = "";

  if (!weather && !market) {
    container.innerHTML = `<p class="live-hint">${t("locationRequired")}</p>`;
    return;
  }

  if (weather) {
    const cur = weather.current || {};
    const alerts = weather.alerts || [];
    const forecast = (weather.forecast || []).slice(0, 5);

    const weatherBlock = document.createElement("section");
    weatherBlock.className = "live-card";
    weatherBlock.innerHTML = `
      <div class="live-card-head">
        <h3>🌦️ ${t("liveWeather")}</h3>
        <span class="badge live">${t("liveData")}</span>
      </div>
      <p class="loc-label">${escapeHtml(weather.location || "")}</p>
      <div class="weather-now">
        <strong>${cur.temperature_c ?? "—"}°C</strong>
        <span>${escapeHtml(cur.condition || "")}</span>
        <span>💧 ${cur.humidity_pct ?? "—"}%</span>
        <span>🌬️ ${cur.wind_speed_kmh ?? "—"} km/h</span>
      </div>
      <h4>${t("rainForecast")}</h4>
      <div class="rain-grid">
        ${forecast
          .map(
            (d) =>
              `<div class="rain-day"><span>${d.date?.slice(5)}</span><strong>${d.precip_mm ?? 0}mm</strong><small>${d.rain_probability_pct ?? 0}%</small></div>`
          )
          .join("")}
      </div>
      <h4>${t("alerts")}</h4>
      <div class="alerts-list">
        ${
          alerts.length
            ? alerts
                .map(
                  (a) =>
                    `<div class="alert-item ${safeClass(a.level, ["info", "warning", "danger", "success"], "info")}"><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.message)}</p></div>`
                )
                .join("")
            : `<p class="muted">${t("noAlerts")}</p>`
        }
      </div>
      ${
        weather.irrigation_advice
          ? `<p class="irrigation-tip"><strong>${t("irrigationTip")}:</strong> ${escapeHtml(weather.irrigation_advice.reason)}</p>`
          : ""
      }
    `;
    container.appendChild(weatherBlock);
  }

  if (market) {
    const sourceLabel = market.source === "live" ? t("liveData") : t("referenceData");
    const block = document.createElement("section");
    block.className = "live-card";
    block.innerHTML = `
      <div class="live-card-head">
        <h3>📈 ${t("marketRates")} — ${escapeHtml(market.country_name || "")}</h3>
        <span class="badge ${market.source === "live" ? "live" : "ref"}">${sourceLabel}</span>
      </div>
      <h4>${t("crops")}</h4>
      <ul class="rate-list">${renderRates(market.crops)}</ul>
      <h4>${t("fertilizers")}</h4>
      <ul class="rate-list">${renderRates(market.fertilizers)}</ul>
      <h4>${t("pesticides")}</h4>
      <ul class="rate-list">${renderRates(market.pesticides)}</ul>
      ${market.note ? `<p class="muted small">${escapeHtml(market.note)}</p>` : ""}
    `;
    container.appendChild(block);
  }
}

function renderRates(items) {
  if (!items?.length) return "<li>—</li>";
  return items
    .slice(0, 6)
    .map(
      (r) =>
        `<li><span>${escapeHtml(r.item)}</span><strong>${escapeHtml(r.price)} ${escapeHtml(r.unit || "")}</strong></li>`
    )
    .join("");
}

export async function refreshLiveData(location, container, t, renderDashboardFn) {
  if (!location) {
    renderLivePanel(container, null, null, t);
    if (renderDashboardFn) renderDashboardFn(null, null);
    return;
  }

  const [weatherResult, marketResult, healthResult] = await Promise.allSettled([
    fetchLiveWeather(location),
    fetchMarketRates(location),
    fetchCropHealthData(location),
  ]);

  if (weatherResult.status === "rejected") console.warn("Weather refresh failed", weatherResult.reason);
  if (marketResult.status === "rejected") console.warn("Market refresh failed", marketResult.reason);
  if (healthResult.status === "rejected") console.warn("Crop health refresh failed", healthResult.reason);

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : weatherCache;
  const market = marketResult.status === "fulfilled" ? marketResult.value : marketCache;
  const cropHealthData = healthResult.status === "fulfilled" ? healthResult.value : cropHealthCache;

  renderLivePanel(container, weather, market, t);
  if (renderDashboardFn) renderDashboardFn(weather, cropHealthData);
}
