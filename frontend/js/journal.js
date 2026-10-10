import { getFields, populateFieldSelect, onFieldsUpdated } from "./farm.js";

/**
 * journal.js — Farm journal with activity logging, photo attachments,
 * expense tracking, and CSV export.
 *
 * All data stored in localStorage for offline-first usage.
 */

const STORAGE_KEY = "agriguide_journal";

const ACTIVITY_ICONS = {
  observation: "👁️",
  planting: "🌱",
  fertilizer: "🧪",
  spraying: "💊",
  irrigation: "💧",
  harvest: "🌾",
  expense: "💰",
  other: "📝",
};

const ACTIVITY_COLORS = {
  observation: "var(--info)",
  planting: "var(--success)",
  fertilizer: "var(--secondary)",
  spraying: "var(--warning)",
  irrigation: "var(--info)",
  harvest: "var(--success)",
  expense: "var(--danger)",
  other: "var(--text-muted)",
};

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

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatCost(cost) {
  if (!cost && cost !== 0) return "";
  return `₹${Number(cost).toLocaleString()}`;
}

/* ---------- Render entry list ---------- */
function renderEntries(container) {
  const entries = loadEntries();
  container.innerHTML = "";

  if (!entries.length) {
    container.innerHTML = '<p class="journal-empty">No entries yet. Click "+ New Entry" to start logging farm activities.</p>';
    return;
  }

  // Sort newest first
  entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  entries.forEach((entry) => {
    const div = document.createElement("article");
    div.className = "journal-entry";
    div.dataset.id = entry.id;

    const icon = ACTIVITY_ICONS[entry.type] || "📝";
    const color = ACTIVITY_COLORS[entry.type] || "var(--text-muted)";
    const fieldName = entry.field_label || fieldLabel(entry.field);
    const costHtml = entry.cost ? `<span class="entry-cost">${formatCost(entry.cost)}</span>` : "";
    const photosHtml = entry.photos?.length
      ? `<div class="entry-photos">${entry.photos.map((p) => `<img src="${p}" alt="Photo" class="entry-thumb" />`).join("")}</div>`
      : "";

    div.innerHTML = `
      <div class="entry-icon" style="background: ${color}20; color: ${color}">${icon}</div>
      <div class="entry-body">
        <div class="entry-header">
          <span class="entry-type">${escapeHtml((entry.type || "other").charAt(0).toUpperCase() + (entry.type || "other").slice(1))}</span>
          <span class="entry-date">${formatDate(entry.date)}</span>
          ${fieldName ? `<span class="entry-field">${escapeHtml(fieldName)}</span>` : ""}
        </div>
        <p class="entry-desc">${escapeHtml(entry.description || "")}</p>
        ${costHtml}
        ${photosHtml}
      </div>
      <button class="entry-delete" title="Delete entry" data-delete="${entry.id}">×</button>
    `;
    container.appendChild(div);
  });

  // Wire delete buttons
  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      deleteEntry(id);
      renderEntries(container);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function deleteEntry(id) {
  const entries = loadEntries().filter((e) => e.id !== id);
  saveEntries(entries);
}

/* ---------- Save new entry ---------- */
function saveEntry(form) {
  const date = document.getElementById("journal-date").value;
  const type = document.getElementById("journal-type").value;
  const field = document.getElementById("journal-field").value;
  const description = document.getElementById("journal-desc").value.trim();
  const cost = document.getElementById("journal-cost").value;
  const photoInput = document.getElementById("journal-photos");

  if (!date || !description) return null;

  const entry = {
    id: generateId(),
    date,
    type,
    field,
    field_label: fieldLabel(field),
    description,
    cost: cost ? Number(cost) : null,
    photos: [],
    created_at: new Date().toISOString(),
  };

  // Handle photos (read as data URLs for offline storage)
  if (photoInput.files?.length) {
    const reads = Array.from(photoInput.files).slice(0, 4).map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(reads).then((photos) => {
      entry.photos = photos.filter(Boolean);
      const entries = loadEntries();
      entries.push(entry);
      saveEntries(entries);
      return entry;
    });
  }

  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  return Promise.resolve(entry);
}

/* ---------- CSV Export ---------- */
function exportCSV() {
  const entries = loadEntries();
  if (!entries.length) return;

  entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const headers = ["Date", "Activity", "Field", "Description", "Cost (₹)", "Photos"];
  const rows = entries.map((e) => [
    e.date || "",
    e.type || "",
    e.field_label || fieldLabel(e.field),
    (e.description || "").replace(/"/g, '""'),
    e.cost || "",
    (e.photos || []).length,
  ]);

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agriguide-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Init journal section ---------- */
export function initJournal() {
  const entriesContainer = document.getElementById("journal-entries");
  const form = document.getElementById("journal-form");
  const addBtn = document.getElementById("btn-journal-add");
  const saveBtn = document.getElementById("btn-journal-save");
  const cancelBtn = document.getElementById("btn-journal-cancel");
  const exportBtn = document.getElementById("btn-journal-export");
  const dateInput = document.getElementById("journal-date");

  if (!entriesContainer) return;

  populateFieldSelect(document.getElementById("journal-field"));
  onFieldsUpdated(() => populateFieldSelect(document.getElementById("journal-field")));

  // Set default date to today
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  // Render existing entries
  renderEntries(entriesContainer);

  // Toggle form
  addBtn?.addEventListener("click", () => {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) {
      document.getElementById("journal-desc")?.focus();
    }
  });

  cancelBtn?.addEventListener("click", () => {
    form.classList.add("hidden");
    resetForm();
  });

  // Save entry
  saveBtn?.addEventListener("click", async () => {
    const entry = await saveEntry(form);
    if (entry) {
      form.classList.add("hidden");
      resetForm();
      renderEntries(entriesContainer);
    }
  });

  // Export CSV
  exportBtn?.addEventListener("click", exportCSV);
}

function resetForm() {
  const dateInput = document.getElementById("journal-date");
  const descInput = document.getElementById("journal-desc");
  const costInput = document.getElementById("journal-cost");
  const photoInput = document.getElementById("journal-photos");
  const typeSelect = document.getElementById("journal-type");
  const fieldSelect = document.getElementById("journal-field");

  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  if (descInput) descInput.value = "";
  if (costInput) costInput.value = "";
  if (photoInput) photoInput.value = "";
  if (typeSelect) typeSelect.value = "observation";
  if (fieldSelect) fieldSelect.value = "";
}
