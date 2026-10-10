/**
 * farm.js — persistent field profiles and active-field context.
 *
 * Field data is stored locally in the browser. It is only sent to the chat
 * endpoint as contextual data when the user sends a message.
 */

const FIELDS_KEY = "agriguide_fields_v1";
const ACTIVE_FIELD_KEY = "agriguide_active_field_v1";
const EVENT_NAME = "agriguide:fields-updated";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function getFields() {
  const fields = safeParse(localStorage.getItem(FIELDS_KEY), []);
  return Array.isArray(fields) ? fields : [];
}

function saveFields(fields) {
  localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getActiveFieldId() {
  return localStorage.getItem(ACTIVE_FIELD_KEY) || "";
}

export function getActiveField() {
  const id = getActiveFieldId();
  return getFields().find((field) => field.id === id) || null;
}

export function setActiveField(id) {
  const exists = getFields().some((field) => field.id === id);
  if (!exists) return;
  localStorage.setItem(ACTIVE_FIELD_KEY, id);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getFarmContext() {
  const fields = getFields();
  const active = getActiveField();
  if (!fields.length) return null;

  return {
    active_field: active,
    fields: fields.map(({ id, name, crop, area, unit, soil_type, sowing_date, irrigation }) => ({
      id,
      name,
      crop,
      area,
      unit,
      soil_type,
      sowing_date,
      irrigation,
    })),
  };
}

export function populateFieldSelect(select, { includeGeneral = true } = {}) {
  if (!select) return;
  const previous = select.value;
  select.innerHTML = "";

  if (includeGeneral) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "General farm / not field-specific";
    select.appendChild(opt);
  }

  getFields().forEach((field) => {
    const opt = document.createElement("option");
    opt.value = field.id;
    opt.textContent = `${field.name}${field.crop ? ` — ${field.crop}` : ""}`;
    select.appendChild(opt);
  });

  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function generateId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value, maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

function renderFields(container) {
  const fields = getFields();
  const activeId = getActiveFieldId();
  container.innerHTML = "";

  if (!fields.length) {
    container.innerHTML = `
      <div class="fields-empty">
        <div class="fields-empty-icon">+</div>
        <div>
          <strong>No fields added yet</strong>
          <p>Add your first field so the AI can use crop, area, soil, and planting context.</p>
        </div>
      </div>`;
    updateActiveFieldUi();
    return;
  }

  fields.forEach((field) => {
    const card = document.createElement("article");
    const isActive = field.id === activeId;
    card.className = `field-profile-card${isActive ? " active" : ""}`;
    card.innerHTML = `
      <div class="field-card-top">
        <div>
          <span class="field-status-pill">${isActive ? "Active context" : "Field"}</span>
          <h3>${escapeHtml(field.name)}</h3>
          <p>${escapeHtml(field.crop || "Crop not specified")}</p>
        </div>
        <button class="field-delete" type="button" data-field-delete="${field.id}" aria-label="Delete ${escapeHtml(field.name)}">×</button>
      </div>
      <div class="field-meta-grid">
        <span><small>Area</small><strong>${field.area ? `${escapeHtml(field.area)} ${escapeHtml(field.unit || "acre")}` : "—"}</strong></span>
        <span><small>Soil</small><strong>${field.soil_type ? titleCase(field.soil_type) : "—"}</strong></span>
        <span><small>Planted</small><strong>${field.sowing_date ? formatDate(field.sowing_date) : "—"}</strong></span>
        <span><small>Irrigation</small><strong>${field.irrigation ? titleCase(field.irrigation) : "—"}</strong></span>
      </div>
      <button class="btn ${isActive ? "ghost" : "primary"} field-activate" type="button" data-field-active="${field.id}" ${isActive ? "disabled" : ""}>
        ${isActive ? "Using in AI context" : "Use as active field"}
      </button>`;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-field-active]").forEach((btn) => {
    btn.addEventListener("click", () => setActiveField(btn.dataset.fieldActive));
  });

  container.querySelectorAll("[data-field-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.fieldDelete;
      const updated = getFields().filter((field) => field.id !== id);
      saveFields(updated);
      if (getActiveFieldId() === id) {
        if (updated.length) localStorage.setItem(ACTIVE_FIELD_KEY, updated[0].id);
        else localStorage.removeItem(ACTIVE_FIELD_KEY);
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
      }
    });
  });

  updateActiveFieldUi();
}

function updateActiveFieldUi() {
  const active = getActiveField();
  const nameEl = document.getElementById("active-field-name");
  const topbarEl = document.getElementById("topbar-field-label");
  const contextEl = document.getElementById("active-field-context");

  if (!active) {
    if (nameEl) nameEl.textContent = "No active field selected";
    if (topbarEl) topbarEl.textContent = "All fields";
    if (contextEl) {
      contextEl.className = "context-card-empty";
      contextEl.textContent = "Add a field and mark it active. AgriGuide will use that profile when answering.";
    }
    return;
  }

  if (nameEl) nameEl.textContent = `${active.name}${active.crop ? ` • ${active.crop}` : ""}`;
  if (topbarEl) topbarEl.textContent = active.name;
  if (contextEl) {
    contextEl.className = "active-field-summary";
    contextEl.innerHTML = `
      <strong>${escapeHtml(active.name)}</strong>
      <span>${escapeHtml(active.crop || "Crop not specified")}</span>
      <dl>
        <div><dt>Area</dt><dd>${active.area ? `${escapeHtml(active.area)} ${escapeHtml(active.unit || "acre")}` : "—"}</dd></div>
        <div><dt>Soil</dt><dd>${active.soil_type ? titleCase(active.soil_type) : "—"}</dd></div>
        <div><dt>Planted</dt><dd>${active.sowing_date ? formatDate(active.sowing_date) : "—"}</dd></div>
        <div><dt>Irrigation</dt><dd>${active.irrigation ? titleCase(active.irrigation) : "—"}</dd></div>
      </dl>`;
  }
}

function resetForm() {
  ["field-name", "field-crop", "field-area", "field-sowing-date"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const unit = document.getElementById("field-unit");
  const soil = document.getElementById("field-soil");
  const irrigation = document.getElementById("field-irrigation");
  if (unit) unit.value = "acre";
  if (soil) soil.value = "";
  if (irrigation) irrigation.value = "";
}

function titleCase(text) {
  return String(text || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr) {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function initFields() {
  const container = document.getElementById("fields-list");
  const form = document.getElementById("field-form");
  const addBtn = document.getElementById("btn-field-add");
  const saveBtn = document.getElementById("btn-field-save");
  const cancelBtn = document.getElementById("btn-field-cancel");

  if (!container || !form) return;

  // If old versions did not store an active field, select the first one.
  const fields = getFields();
  if (fields.length && !getActiveField()) {
    localStorage.setItem(ACTIVE_FIELD_KEY, fields[0].id);
  }

  const rerender = () => renderFields(container);
  window.addEventListener(EVENT_NAME, rerender);

  addBtn?.addEventListener("click", () => {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) document.getElementById("field-name")?.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    form.classList.add("hidden");
    resetForm();
  });

  saveBtn?.addEventListener("click", () => {
    const name = cleanText(document.getElementById("field-name")?.value);
    const crop = cleanText(document.getElementById("field-crop")?.value);
    if (!name || !crop) {
      document.getElementById(!name ? "field-name" : "field-crop")?.focus();
      return;
    }

    const field = {
      id: generateId(),
      name,
      crop,
      area: cleanText(document.getElementById("field-area")?.value, 20),
      unit: cleanText(document.getElementById("field-unit")?.value, 20) || "acre",
      soil_type: cleanText(document.getElementById("field-soil")?.value, 40),
      sowing_date: cleanText(document.getElementById("field-sowing-date")?.value, 20),
      irrigation: cleanText(document.getElementById("field-irrigation")?.value, 40),
      created_at: new Date().toISOString(),
    };

    const next = [...getFields(), field];
    saveFields(next);
    if (!getActiveFieldId()) localStorage.setItem(ACTIVE_FIELD_KEY, field.id);
    form.classList.add("hidden");
    resetForm();
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  });

  rerender();
}

export function onFieldsUpdated(callback) {
  window.addEventListener(EVENT_NAME, callback);
}
