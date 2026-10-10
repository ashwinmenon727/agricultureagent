import { getFields, populateFieldSelect, onFieldsUpdated } from "./farm.js";

/**
 * soil.js — Soil health analysis with NPK tracking, pH display,
 * fertilizer recommendations, and test history.
 *
 * Data stored in localStorage for offline-first usage.
 */

const STORAGE_KEY = "agriguide_soil";

function fieldLabel(id) {
  if (!id) return "";
  const field = getFields().find((item) => item.id === id);
  return field ? `${field.name}${field.crop ? ` — ${field.crop}` : ""}` : id;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

/* ---------- Ideal ranges for common Indian crops ---------- */
const IDEAL_RANGES = {
  loamy:  { ph: [6.0, 7.5], n: [280, 450], p: [20, 40], k: [150, 280], oc: [0.5, 1.5] },
  clay:   { ph: [6.5, 7.5], n: [250, 400], p: [15, 35], k: [120, 250], oc: [0.4, 1.2] },
  sandy:  { ph: [5.5, 7.0], n: [200, 350], p: [10, 30], k: [100, 200], oc: [0.3, 1.0] },
  silty:  { ph: [6.0, 7.0], n: [260, 420], p: [18, 38], k: [140, 260], oc: [0.5, 1.3] },
  peaty:  { ph: [4.5, 6.0], n: [300, 500], p: [20, 50], k: [100, 200], oc: [2.0, 6.0] },
  chalky: { ph: [7.0, 8.5], n: [250, 400], p: [15, 30], k: [130, 250], oc: [0.4, 1.0] },
};

/* ---------- Fertilizer recommendations ---------- */
const FERTILIZER_DB = {
  n_low:  { name: "Urea (46% N)", dose: "2 bags/ha", price: "₹266/50kg bag", timing: "Split: 1/3 basal + 2/3 at tillering" },
  n_high: { name: "Reduce nitrogen", dose: "Skip next urea dose", price: "Savings", timing: "Monitor for lodging" },
  p_low:  { name: "DAP (18:46:0)", dose: "2 bags/ha", price: "₹1,350/50kg bag", timing: "Apply at sowing (basal)" },
  p_high: { name: "Reduce DAP", dose: "Half dose or skip", price: "Savings", timing: "Re-test in 6 months" },
  k_low:  { name: "MOP (0:0:60)", dose: "2 bags/ha", price: "₹1,700/50kg bag", timing: "Apply at sowing + top-dress at flowering" },
  k_high: { name: "Reduce MOP", dose: "Half dose", price: "Savings", timing: "Monitor leaf burn" },
  oc_low: { name: "FYM / Compost", dose: "5-10 tonnes/ha", price: "₹500-1000/tonne", timing: "Apply before last plowing" },
  acidic: { name: "Agricultural Lime", dose: "2-4 tonnes/ha", price: "₹2000-4000/tonne", timing: "Apply 2-3 months before sowing" },
  alkaline: { name: "Gypsum (CaSO₄)", dose: "2-3 tonnes/ha", price: "₹1500-2500/tonne", timing: "Apply with organic matter" },
};

function loadTests() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTests(tests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Analyze soil data ---------- */
function analyzeSoil(data) {
  const ranges = IDEAL_RANGES[data.soil_type] || IDEAL_RANGES.loamy;
  const issues = [];
  const recs = [];

  // pH analysis
  const ph = parseFloat(data.ph);
  if (!isNaN(ph)) {
    if (ph < ranges.ph[0]) {
      issues.push({ type: "warning", msg: `pH is ${ph} (acidic). Ideal: ${ranges.ph[0]}-${ranges.ph[1]}` });
      recs.push(FERTILIZER_DB.acidic);
    } else if (ph > ranges.ph[1]) {
      issues.push({ type: "warning", msg: `pH is ${ph} (alkaline). Ideal: ${ranges.ph[0]}-${ranges.ph[1]}` });
      recs.push(FERTILIZER_DB.alkaline);
    }
  }

  // N analysis
  const n = parseFloat(data.n);
  if (!isNaN(n)) {
    if (n < ranges.n[0]) {
      issues.push({ type: "low", msg: `Nitrogen is ${n} kg/ha (low). Ideal: ${ranges.n[0]}-${ranges.n[1]}` });
      recs.push(FERTILIZER_DB.n_low);
    } else if (n > ranges.n[1]) {
      issues.push({ type: "high", msg: `Nitrogen is ${n} kg/ha (high). Consider reducing.` });
      recs.push(FERTILIZER_DB.n_high);
    }
  }

  // P analysis
  const p = parseFloat(data.p);
  if (!isNaN(p)) {
    if (p < ranges.p[0]) {
      issues.push({ type: "low", msg: `Phosphorus is ${p} kg/ha (low). Ideal: ${ranges.p[0]}-${ranges.p[1]}` });
      recs.push(FERTILIZER_DB.p_low);
    } else if (p > ranges.p[1]) {
      issues.push({ type: "high", msg: `Phosphorus is ${p} kg/ha (high). Reduce DAP.` });
      recs.push(FERTILIZER_DB.p_high);
    }
  }

  // K analysis
  const k = parseFloat(data.k);
  if (!isNaN(k)) {
    if (k < ranges.k[0]) {
      issues.push({ type: "low", msg: `Potassium is ${k} kg/ha (low). Ideal: ${ranges.k[0]}-${ranges.k[1]}` });
      recs.push(FERTILIZER_DB.k_low);
    } else if (k > ranges.k[1]) {
      issues.push({ type: "high", msg: `Potassium is ${k} kg/ha (high). Reduce MOP.` });
      recs.push(FERTILIZER_DB.k_high);
    }
  }

  // OC analysis
  const oc = parseFloat(data.oc);
  if (!isNaN(oc)) {
    if (oc < ranges.oc[0]) {
      issues.push({ type: "low", msg: `Organic Carbon is ${oc}% (low). Ideal: ${ranges.oc[0]}-${ranges.oc[1]}` });
      recs.push(FERTILIZER_DB.oc_low);
    }
  }

  return { issues, recs, ranges };
}

/* ---------- Render NPK bars ---------- */
function renderNPKBars(container, data) {
  const ranges = IDEAL_RANGES[data.soil_type] || IDEAL_RANGES.loamy;
  const nutrients = [
    { key: "n", label: "Nitrogen (N)", value: data.n, ideal: ranges.n, color: "#5D8A63" },
    { key: "p", label: "Phosphorus (P)", value: data.p, ideal: ranges.p, color: "#B8953E" },
    { key: "k", label: "Potassium (K)", value: data.k, ideal: ranges.k, color: "#5B8BA8" },
  ];

  container.innerHTML = "";
  nutrients.forEach((n) => {
    const val = parseFloat(n.value) || 0;
    const max = n.ideal[1] * 1.5;
    const pct = Math.min(100, (val / max) * 100);
    const inRange = val >= n.ideal[0] && val <= n.ideal[1];
    const div = document.createElement("div");
    div.className = "npk-bar-row";
    div.innerHTML = `
      <div class="npk-label">
        <span>${n.label}</span>
        <span class="${inRange ? "npk-ok" : "npk-warn"}">${val || "--"} kg/ha</span>
      </div>
      <div class="npk-track">
        <div class="npk-fill" style="width: ${pct}%; background: ${n.color}"></div>
        <div class="npk-range" style="left: ${(n.ideal[0] / max) * 100}%; width: ${((n.ideal[1] - n.ideal[0]) / max) * 100}%"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ---------- Render pH display ---------- */
function renderPhDisplay(ph) {
  const marker = document.querySelector(".ph-marker");
  const value = document.getElementById("ph-value");
  const advice = document.getElementById("ph-advice");

  const val = parseFloat(ph);
  if (isNaN(val)) {
    if (marker) marker.style.left = "50%";
    if (value) value.textContent = "--";
    if (advice) advice.textContent = "Add test data to see pH analysis.";
    return;
  }

  // Map pH 4-10 to 0-100%
  const pct = ((val - 4) / 6) * 100;
  if (marker) marker.style.left = `${Math.max(0, Math.min(100, pct))}%`;
  if (value) value.textContent = val.toFixed(1);

  if (val < 5.5) {
    if (advice) advice.textContent = "Strongly acidic — apply agricultural lime (2-4 t/ha) 2-3 months before sowing.";
  } else if (val < 6.0) {
    if (advice) advice.textContent = "Moderately acidic — light lime application may help. Best for tea, potato.";
  } else if (val <= 7.5) {
    if (advice) advice.textContent = "Optimal range for most crops. No amendment needed.";
  } else if (val <= 8.5) {
    if (advice) advice.textContent = "Alkaline — apply gypsum (2-3 t/ha) with organic matter to lower pH.";
  } else {
    if (advice) advice.textContent = "Strongly alkaline — heavy gypsum + organic matter needed. Consult local agronomist.";
  }
}

/* ---------- Render recommendations ---------- */
function renderRecommendations(container, analysis) {
  container.innerHTML = "";
  if (!analysis.recs.length) {
    container.innerHTML = '<p class="soil-good">All nutrient levels are within ideal range. No amendments needed.</p>';
    return;
  }

  analysis.recs.forEach((rec) => {
    const div = document.createElement("div");
    div.className = "soil-rec-item";
    div.innerHTML = `
      <div class="rec-header">
        <strong>${rec.name}</strong>
        <span class="rec-dose">${rec.dose}</span>
      </div>
      <div class="rec-details">
        <span>Price: ${rec.price}</span>
        <span>Timing: ${rec.timing}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ---------- Render test history ---------- */
function renderHistory(container) {
  const tests = loadTests();
  container.innerHTML = "";

  if (!tests.length) {
    container.innerHTML = '<p class="soil-empty">No previous tests recorded.</p>';
    return;
  }

  tests.sort((a, b) => (b.date || "").localeCompare(a.date || "")).forEach((test) => {
    const div = document.createElement("div");
    div.className = "soil-history-item";
    div.innerHTML = `
      <div class="history-date">${test.date || "--"}</div>
      <div class="history-data">
        <span>pH ${test.ph || "--"}</span>
        <span>N ${test.n || "--"}</span>
        <span>P ${test.p || "--"}</span>
        <span>K ${test.k || "--"}</span>
        <span class="history-field">${escapeHtml(test.field_label || fieldLabel(test.field))}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ---------- Render all ---------- */
function renderAll() {
  const tests = loadTests();
  const latest = tests[tests.length - 1];

  if (latest) {
    const npkBars = document.getElementById("npk-bars");
    if (npkBars) renderNPKBars(npkBars, latest);
    renderPhDisplay(latest.ph);

    const recsContainer = document.getElementById("soil-recs");
    if (recsContainer) {
      const analysis = analyzeSoil(latest);
      renderRecommendations(recsContainer, analysis);
    }
  }

  const historyContainer = document.getElementById("soil-history-list");
  if (historyContainer) renderHistory(historyContainer);
}

/* ---------- Init ---------- */
export function initSoil() {
  const addBtn = document.getElementById("btn-soil-add");
  const form = document.getElementById("soil-form");
  const saveBtn = document.getElementById("btn-soil-save");
  const cancelBtn = document.getElementById("btn-soil-cancel");
  const dateInput = document.getElementById("soil-date");

  if (!form) return;

  populateFieldSelect(document.getElementById("soil-field"));
  onFieldsUpdated(() => populateFieldSelect(document.getElementById("soil-field")));

  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  addBtn?.addEventListener("click", () => {
    form.classList.toggle("hidden");
  });

  cancelBtn?.addEventListener("click", () => {
    form.classList.add("hidden");
  });

  saveBtn?.addEventListener("click", () => {
    const measurementIds = ["soil-ph", "soil-n", "soil-p", "soil-k", "soil-oc", "soil-ec"];
    if (!measurementIds.some((id) => String(document.getElementById(id)?.value || "").trim())) {
      alert("Enter at least one soil measurement before saving.");
      return;
    }

    const data = {
      id: generateId(),
      date: document.getElementById("soil-date")?.value || "",
      field: document.getElementById("soil-field")?.value || "",
      field_label: fieldLabel(document.getElementById("soil-field")?.value || ""),
      soil_type: document.getElementById("soil-type")?.value || "loamy",
      ph: document.getElementById("soil-ph")?.value || "",
      n: document.getElementById("soil-n")?.value || "",
      p: document.getElementById("soil-p")?.value || "",
      k: document.getElementById("soil-k")?.value || "",
      oc: document.getElementById("soil-oc")?.value || "",
      ec: document.getElementById("soil-ec")?.value || "",
    };

    const tests = loadTests();
    tests.push(data);
    saveTests(tests);

    form.classList.add("hidden");
    ["soil-ph", "soil-n", "soil-p", "soil-k", "soil-oc", "soil-ec"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    renderAll();
  });

  renderAll();
}
