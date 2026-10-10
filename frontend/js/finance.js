import { getFields, populateFieldSelect, onFieldsUpdated } from "./farm.js";

/**
 * finance.js — Farm financial tracking: input costs, yields, profit/loss,
 * cost-per-quintal analysis, and seasonal comparison.
 *
 * Data stored in localStorage for offline-first usage.
 */

const STORAGE_KEY = "agriguide_finance";

const LEGACY_FIELD_NAMES = {
  "north-a": "North A — Rice",
  "east-b": "East B — Wheat",
  "west-c": "West C — Cotton",
  "south-d": "South D — Maize",
};

function fieldLabel(id) {
  if (!id) return "";
  const field = getFields().find((item) => item.id === id);
  return field ? `${field.name}${field.crop ? ` — ${field.crop}` : ""}` : (LEGACY_FIELD_NAMES[id] || id);
}

const COST_CATEGORIES = [
  { key: "seeds", label: "Seeds", color: "#5D8A63" },
  { key: "fertilizer", label: "Fertilizer", color: "#5B8BA8" },
  { key: "pesticides", label: "Pesticides", color: "#B8953E" },
  { key: "labor", label: "Labor", color: "#88B27D" },
  { key: "irrigation", label: "Irrigation", color: "#7BA3C9" },
  { key: "other_cost", label: "Other", color: "#A1A7A0" },
];

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN")}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

/* ---------- Calculate totals ---------- */
function calculateTotals(records) {
  let totalCost = 0;
  let totalRevenue = 0;
  let totalYield = 0;
  const costByCategory = {};

  COST_CATEGORIES.forEach((c) => (costByCategory[c.key] = 0));

  records.forEach((r) => {
    const cost =
      (Number(r.seeds) || 0) +
      (Number(r.fertilizer) || 0) +
      (Number(r.pesticides) || 0) +
      (Number(r.labor) || 0) +
      (Number(r.irrigation) || 0) +
      (Number(r.other_cost) || 0);
    totalCost += cost;

    costByCategory.seeds += Number(r.seeds) || 0;
    costByCategory.fertilizer += Number(r.fertilizer) || 0;
    costByCategory.pesticides += Number(r.pesticides) || 0;
    costByCategory.labor += Number(r.labor) || 0;
    costByCategory.irrigation += Number(r.irrigation) || 0;
    costByCategory.other_cost += Number(r.other_cost) || 0;

    const yieldQ = Number(r.yield) || 0;
    const price = Number(r.price) || 0;
    totalYield += yieldQ;
    totalRevenue += yieldQ * price;
  });

  return { totalCost, totalRevenue, totalYield, costByCategory };
}

/* ---------- Render summary cards ---------- */
function renderSummary(records) {
  const totals = calculateTotals(records);
  const profit = totals.totalRevenue - totals.totalCost;
  const costPerQ = totals.totalYield > 0 ? Math.round(totals.totalCost / totals.totalYield) : 0;

  const costEl = document.getElementById("fin-total-cost");
  const revEl = document.getElementById("fin-total-revenue");
  const profitEl = document.getElementById("fin-profit");
  const cpqEl = document.getElementById("fin-cost-per-q");
  const profitCard = document.getElementById("fin-profit-card");

  if (costEl) costEl.textContent = formatCurrency(totals.totalCost);
  if (revEl) revEl.textContent = formatCurrency(totals.totalRevenue);
  if (profitEl) profitEl.textContent = formatCurrency(profit);
  if (cpqEl) cpqEl.textContent = formatCurrency(costPerQ);

  if (profitCard) {
    profitCard.className = `fin-card ${profit >= 0 ? "positive" : "negative"}`;
  }
}

/* ---------- Render cost breakdown ---------- */
function renderCostChart(container, records) {
  const totals = calculateTotals(records);
  container.innerHTML = "";

  if (totals.totalCost === 0) {
    container.innerHTML = '<p class="soil-empty">Add financial records to see cost analysis.</p>';
    return;
  }

  COST_CATEGORIES.forEach((cat) => {
    const val = totals.costByCategory[cat.key] || 0;
    const pct = totals.totalCost > 0 ? (val / totals.totalCost) * 100 : 0;
    if (val === 0) return;

    const div = document.createElement("div");
    div.className = "fin-cost-row";
    div.innerHTML = `
      <div class="fin-cost-label">
        <span class="fin-dot" style="background: ${cat.color}"></span>
        <span>${cat.label}</span>
      </div>
      <div class="fin-cost-bar-track">
        <div class="fin-cost-bar-fill" style="width: ${pct}%; background: ${cat.color}"></div>
      </div>
      <div class="fin-cost-values">
        <span>${formatCurrency(val)}</span>
        <span>${pct.toFixed(0)}%</span>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ---------- Render records list ---------- */
function renderRecords(container, records) {
  container.innerHTML = "";

  if (!records.length) {
    container.innerHTML = '<p class="soil-empty">No financial records yet.</p>';
    return;
  }

  records.sort((a, b) => `${b.year}-${b.season}`.localeCompare(`${a.year}-${a.season}`)).forEach((rec) => {
    const cost =
      (Number(rec.seeds) || 0) +
      (Number(rec.fertilizer) || 0) +
      (Number(rec.pesticides) || 0) +
      (Number(rec.labor) || 0) +
      (Number(rec.irrigation) || 0) +
      (Number(rec.other_cost) || 0);
    const revenue = (Number(rec.yield) || 0) * (Number(rec.price) || 0);
    const profit = revenue - cost;

    const div = document.createElement("div");
    div.className = "fin-record";
    div.innerHTML = `
      <div class="fin-record-header">
        <strong>${escapeHtml(rec.crop ? rec.crop.charAt(0).toUpperCase() + rec.crop.slice(1) : "")}</strong>
        <span class="fin-record-meta">${escapeHtml(rec.season)} ${escapeHtml(rec.year)} • ${escapeHtml(rec.field_label || fieldLabel(rec.field))}</span>
      </div>
      <div class="fin-record-numbers">
        <div class="fin-num">
          <span class="fin-num-label">Cost</span>
          <span class="fin-num-value">${formatCurrency(cost)}</span>
        </div>
        <div class="fin-num">
          <span class="fin-num-label">Revenue</span>
          <span class="fin-num-value">${formatCurrency(revenue)}</span>
        </div>
        <div class="fin-num ${profit >= 0 ? "profit-pos" : "profit-neg"}">
          <span class="fin-num-label">Profit</span>
          <span class="fin-num-value">${formatCurrency(profit)}</span>
        </div>
        <div class="fin-num">
          <span class="fin-num-label">Yield</span>
          <span class="fin-num-value">${rec.yield || 0} q</span>
        </div>
      </div>
      <button class="entry-delete" data-delete-fin="${rec.id}" title="Delete">×</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll("[data-delete-fin]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteFin;
      const updated = loadRecords().filter((r) => r.id !== id);
      saveRecords(updated);
      renderAll();
    });
  });
}

/* ---------- Render all ---------- */
function renderAll() {
  const records = loadRecords();
  renderSummary(records);
  const costChart = document.getElementById("fin-cost-chart");
  if (costChart) renderCostChart(costChart, records);
  const recordsList = document.getElementById("fin-records");
  if (recordsList) renderRecords(recordsList, records);
}

/* ---------- Init ---------- */
export function initFinance() {
  const addBtn = document.getElementById("btn-fin-add");
  const form = document.getElementById("fin-form");
  const saveBtn = document.getElementById("btn-fin-save");
  const cancelBtn = document.getElementById("btn-fin-cancel");
  const yearInput = document.getElementById("fin-year");

  if (!form) return;

  populateFieldSelect(document.getElementById("fin-field"));
  onFieldsUpdated(() => populateFieldSelect(document.getElementById("fin-field")));

  if (yearInput) yearInput.value = new Date().getFullYear();

  addBtn?.addEventListener("click", () => {
    form.classList.toggle("hidden");
  });

  cancelBtn?.addEventListener("click", () => {
    form.classList.add("hidden");
  });

  saveBtn?.addEventListener("click", () => {
    const crop = document.getElementById("fin-crop")?.value || "";
    const hasFinancialValue = [
      "fin-seeds", "fin-fertilizer", "fin-pesticides", "fin-labor",
      "fin-irrigation", "fin-other-cost", "fin-yield", "fin-price",
    ].some((id) => Number(document.getElementById(id)?.value || 0) > 0);
    if (!crop || !hasFinancialValue) {
      alert("Choose a crop and enter at least one cost, yield, or price value.");
      return;
    }

    const record = {
      id: generateId(),
      season: document.getElementById("fin-season")?.value || "kharif",
      year: document.getElementById("fin-year")?.value || new Date().getFullYear(),
      field: document.getElementById("fin-field")?.value || "",
      field_label: fieldLabel(document.getElementById("fin-field")?.value || ""),
      crop,
      area: document.getElementById("fin-area")?.value || "",
      seeds: document.getElementById("fin-seeds")?.value || 0,
      fertilizer: document.getElementById("fin-fertilizer")?.value || 0,
      pesticides: document.getElementById("fin-pesticides")?.value || 0,
      labor: document.getElementById("fin-labor")?.value || 0,
      irrigation: document.getElementById("fin-irrigation")?.value || 0,
      other_cost: document.getElementById("fin-other-cost")?.value || 0,
      yield: document.getElementById("fin-yield")?.value || 0,
      price: document.getElementById("fin-price")?.value || 0,
    };

    const records = loadRecords();
    records.push(record);
    saveRecords(records);

    form.classList.add("hidden");
    ["fin-area", "fin-seeds", "fin-fertilizer", "fin-pesticides", "fin-labor",
      "fin-irrigation", "fin-other-cost", "fin-yield", "fin-price"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
    renderAll();
  });

  renderAll();
}
