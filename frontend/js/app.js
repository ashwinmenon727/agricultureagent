import {
  LANGUAGES,
  applyTranslations,
  getMode,
  getStoredLanguage,
  isLowDataMode,
  loadLocale,
  setLowDataMode,
  setMode,
  setStoredLanguage,
  t,
} from "./i18n.js";

import { sendMessage } from "./chat.js";
import { renderDashboard } from "./dashboard.js";
import { refreshLiveData } from "./live.js";
import { initJournal } from "./journal.js";
import { initCalendar } from "./calendar.js";
import { initSoil } from "./soil.js";
import { initFinance } from "./finance.js";
import { initFields } from "./farm.js";
import {
  getGeolocation,
  getStoredLocation,
  searchPlaces,
  setStoredLocation,
} from "./location.js";
import { prefetchFaqs, registerServiceWorker, isOnline } from "./offline.js";
import {
  isVoiceSupported,
  speak,
  startListening,
  stopListening,
} from "./voice.js";

const langScreen = document.getElementById("lang-screen");
const appScreen = document.getElementById("app-screen");
const langGrid = document.getElementById("lang-grid");
const langContinue = document.getElementById("lang-continue");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("message-input");
const sendBtn = document.getElementById("btn-send");
const voiceBtn = document.getElementById("btn-voice-in");
const modeToggle = document.getElementById("mode-toggle");
const lowDataToggle = document.getElementById("low-data-toggle");
const voiceOutToggle = document.getElementById("voice-out-toggle");
const offlineBanner = document.getElementById("offline-banner");
const settingsBtn = document.getElementById("btn-settings");
const refreshBtn = document.getElementById("btn-refresh");
const settingsDialog = document.getElementById("settings-dialog");
const settingsLang = document.getElementById("settings-lang");
const darkToggle = document.getElementById("toggle-dark");
const livePanel = document.getElementById("live-panel");
const locationSearch = document.getElementById("location-search");
const locationResults = document.getElementById("location-results");
const activeLocationEl = document.getElementById("active-location");
const gpsBtn = document.getElementById("btn-gps");
const sidebar = document.querySelector(".sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");

let selectedLang = getStoredLanguage();
let busy = false;
let currentLocation = getStoredLocation();
let searchTimer = null;
let msgCounter = 0;
let liveRefreshTimer = null;

/* ---------- Enhanced appendMessage with animations ---------- */
function appendMessage(text, role, meta = "") {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  // Add staggered animation delay based on message count
  div.style.animationDelay = `${msgCounter * 80}ms`;
  chatEl.appendChild(div);
  msgCounter++;

  if (meta) {
    const m = document.createElement("div");
    m.className = "msg meta";
    m.textContent = meta;
    chatEl.appendChild(m);
  }
  chatEl.scrollTop = chatEl.scrollHeight;
}

/* ---------- Typing indicator ---------- */
function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.id = "typing-indicator";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    indicator.appendChild(dot);
  }
  chatEl.appendChild(indicator);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

/* ---------- Shimmer loading helpers ---------- */
function showShimmer(container, count = 1) {
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "shimmer-card";
    card.innerHTML = `
      <div class="shimmer-line short"></div>
      <div class="shimmer-line tall"></div>
      <div class="shimmer-line"></div>
      <div class="shimmer-line" style="width:70%"></div>
    `;
    container.appendChild(card);
  }
}

function removeShimmer(container) {
  container.querySelectorAll(".shimmer-card").forEach(el => el.remove());
}

/* ---------- Scroll reveal ---------- */
function observeScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".card, .rec-card, .chart-card, .hero-panel, .assistant-panel").forEach((el) => {
    el.classList.add("reveal-on-scroll");
    observer.observe(el);
  });
}

/* ---------- Animate numbers counting up ---------- */
function animateCountUp(element, target, suffix = "") {
  let current = 0;
  const duration = 800;
  const step = Math.max(1, Math.floor(target / 30));
  const interval = duration / (target / step);

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = current + suffix;
  }, interval);
}

/* ---------- Chart animation ---------- */
function animateCharts() {
  document.querySelectorAll(".bar-chart").forEach((chart) => {
    chart.classList.add("chart-animate");
  });
  document.querySelectorAll(".line-chart").forEach((chart) => {
    chart.classList.add("chart-animate");
  });
}

/* ---------- Render language options ---------- */
function renderLanguageGrid(container, onPick) {
  container.innerHTML = "";
  LANGUAGES.forEach((lang) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-option" + (selectedLang === lang.code ? " selected" : "");
    btn.innerHTML = `<strong>${lang.native}</strong><br><small>${lang.label}</small>`;
    btn.addEventListener("click", () => onPick(lang.code, btn));
    container.appendChild(btn);
  });
}

/* ---------- Offline banner ---------- */
function updateOfflineBanner() {
  const show = !isOnline() || isLowDataMode();
  offlineBanner.classList.toggle("hidden", !show);
}

function updateActiveLocationLabel() {
  const label = currentLocation?.label || "";
  if (activeLocationEl) {
    activeLocationEl.textContent = label ? `Location: ${label}` : "Location not set";
  }
  const agentLocation = document.getElementById("agent-location-label");
  if (agentLocation) {
    agentLocation.textContent = label ? `Using live context for ${label}` : "Live context activates with location";
  }
}

async function applyLocation(loc) {
  currentLocation = loc;
  setStoredLocation(loc);
  updateActiveLocationLabel();
  locationResults.classList.add("hidden");
  locationResults.innerHTML = "";
  await refreshLiveData(currentLocation, livePanel, t, renderDashboard);
}

async function refreshAllLive() {
  if (refreshBtn) {
    refreshBtn.classList.add("spin");
    refreshBtn.disabled = true;
  }
  try {
    await refreshLiveData(currentLocation, livePanel, t, renderDashboard);
  } finally {
    setTimeout(() => {
      refreshBtn?.classList.remove("spin");
      if (refreshBtn) refreshBtn.disabled = false;
    }, 300);
  }
}

/* ---------- Location search ---------- */
function initLocationSearch() {
  locationSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = locationSearch.value.trim();
    if (q.length < 2) {
      locationResults.classList.add("hidden");
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await searchPlaces(q, selectedLang);
        locationResults.innerHTML = "";
        if (!results.length) {
          locationResults.classList.add("hidden");
          return;
        }
        results.forEach((r) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "loc-result";
          btn.textContent = r.label;
          btn.addEventListener("click", () =>
            applyLocation({
              latitude: r.latitude,
              longitude: r.longitude,
              elevation: r.elevation,
              label: r.label,
              country_code: r.country_code,
            })
          );
          locationResults.appendChild(btn);
        });
        locationResults.classList.remove("hidden");
      } catch (err) {
        console.warn(err);
      }
    }, 350);
  });

  gpsBtn.addEventListener("click", async () => {
    try {
      const loc = await getGeolocation();
      await applyLocation(loc);
    } catch {
      appendMessage("GPS unavailable. Search your village name above.", "meta");
    }
  });

  refreshBtn.addEventListener("click", refreshAllLive);
}

/* ---------- Boot app ---------- */
async function bootApp(language) {
  selectedLang = language;
  setStoredLanguage(language);
  await loadLocale(language);
  applyTranslations(document);

  langScreen.classList.remove("active");
  appScreen.classList.add("active");

  // Page entrance animation
  appScreen.classList.add("page-enter");

  modeToggle.checked = getMode() === "expert";
  lowDataToggle.checked = isLowDataMode();

  chatEl.innerHTML = "";
  msgCounter = 0;
  appendMessage(t("welcomeTitle"), "bot");
  appendMessage(t("welcomeBody"), "bot");

  currentLocation = getStoredLocation();
  updateActiveLocationLabel();
  await prefetchFaqs(language);
  await refreshAllLive();
  updateOfflineBanner();
  populateSettingsLang();

  // Init scroll reveal and chart animations after a small delay
  setTimeout(() => {
    observeScrollReveal();
    animateCharts();
  }, 300);

  // Auto-refresh weather every 30 minutes. Keep exactly one timer even if
  // the user changes language and bootApp runs again.
  if (liveRefreshTimer) clearInterval(liveRefreshTimer);
  liveRefreshTimer = setInterval(() => {
    if (currentLocation && navigator.onLine) refreshAllLive();
  }, 30 * 60 * 1000);
}

/* ---------- Settings language ---------- */
function populateSettingsLang() {
  settingsLang.innerHTML = "";
  LANGUAGES.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = `${lang.native} (${lang.label})`;
    opt.selected = lang.code === selectedLang;
    settingsLang.appendChild(opt);
  });
}

/* ---------- Send message ---------- */
async function handleSend(text) {
  const message = (text || inputEl.value).trim();
  if (!message || busy) return;

  busy = true;
  inputEl.value = "";
  inputEl.style.height = "auto";
  appendMessage(message, "user");
  showTypingIndicator();

  const mode = modeToggle.checked ? "expert" : "simple";

  try {
    const data = await sendMessage(message, selectedLang, mode);
    hideTypingIndicator();
    appendMessage(data.reply, "bot", data.source);
    if (voiceOutToggle.checked) {
      speak(data.reply, selectedLang);
    }
  } catch (_) {
    hideTypingIndicator();
    appendMessage(t("errorNetwork"), "bot");
  } finally {
    busy = false;
  }
}

/* ---------- Language screen ---------- */
function initLanguageScreen() {
  renderLanguageGrid(langGrid, async (code, btn) => {
    selectedLang = code;
    langGrid.querySelectorAll(".lang-option").forEach((el) => el.classList.remove("selected"));
    btn.classList.add("selected");
    langContinue.disabled = false;
    await loadLocale(code);
    applyTranslations(langScreen);
  });

  langContinue.addEventListener("click", () => {
    if (selectedLang) bootApp(selectedLang);
  });
}

/* ---------- Composer / chat input ---------- */
function initComposer() {
  sendBtn.addEventListener("click", () => handleSend());
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 160)}px`;
  });

  modeToggle.addEventListener("change", () => {
    setMode(modeToggle.checked ? "expert" : "simple");
  });

  lowDataToggle.addEventListener("change", () => {
    setLowDataMode(lowDataToggle.checked);
    updateOfflineBanner();
  });

  document.querySelectorAll(".topic-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      inputEl.value = chip.dataset.prompt || "";
      handleSend();
    });
  });

  if (!isVoiceSupported()) {
    voiceBtn.disabled = true;
  } else {
    voiceBtn.addEventListener("click", () => {
      startListening(
        selectedLang,
        (spoken) => {
          inputEl.value = spoken;
          handleSend(spoken);
        },
        () => stopListening()
      );
    });
  }
}

/* ---------- Settings ---------- */
function initSettings() {
  settingsBtn.addEventListener("click", () => settingsDialog.showModal());
  settingsLang.addEventListener("change", async () => {
    await bootApp(settingsLang.value);
  });
}

/* ---------- Ripple effect ---------- */
function createRipple(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
  target.querySelector(".ripple")?.remove();
  target.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

/* ---------- Dashboard interactions ---------- */
function initDashboardInteractions() {
  document.querySelectorAll(".ripple-target").forEach((el) => {
    el.addEventListener("click", createRipple);
  });

  document.querySelectorAll(".prompt-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      inputEl.value = btn.dataset.prompt || "";
      inputEl.focus();
      document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const alertBar = document.querySelector(".alert-bar");
  const alertToggle = document.querySelector(".alert-toggle");
  alertToggle?.addEventListener("click", () => {
    const expanded = alertBar?.classList.toggle("expanded") || false;
    alertToggle.setAttribute("aria-expanded", String(expanded));
  });

  const mobileMenu = document.querySelector(".mobile-menu");
  mobileMenu?.addEventListener("click", () => {
    sidebar?.classList.toggle("mobile-open");
    sidebarBackdrop?.classList.toggle("visible");
  });

  sidebarBackdrop?.addEventListener("click", () => {
    sidebar?.classList.remove("mobile-open");
    sidebarBackdrop?.classList.remove("visible");
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      const targetId = item.dataset.target;
      const target = targetId ? document.getElementById(targetId) : null;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      sidebar?.classList.remove("mobile-open");
      sidebarBackdrop?.classList.remove("visible");
    });
  });

  // Keep the sidebar selection in sync while scrolling through long pages.
  const navTargets = [...document.querySelectorAll(".nav-item[data-target]")]
    .map((item) => ({ item, target: document.getElementById(item.dataset.target) }))
    .filter((entry) => entry.target);
  if ("IntersectionObserver" in window && navTargets.length) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const match = navTargets.find((entry) => entry.target === visible.target);
      if (!match) return;
      document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
      match.item.classList.add("active");
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.4] });
    navTargets.forEach(({ target }) => navObserver.observe(target));
  }

  // Notification panel
  const notifBtn = document.getElementById("btn-notifications");
  const notifPanel = document.getElementById("notifications-panel");
  const notifClear = document.getElementById("notif-clear");
  if (notifBtn) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifPanel?.classList.toggle("hidden");
    });

    notifClear?.addEventListener("click", () => {
      const list = document.getElementById("notif-list");
      if (list) list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:var(--space-6);">No notifications</p>';
      const badge = notifBtn.querySelector(".badge");
      if (badge) badge.style.display = "none";
    });

    document.addEventListener("click", (e) => {
      if (notifPanel && !notifPanel.contains(e.target) && e.target !== notifBtn) {
        notifPanel.classList.add("hidden");
      }
    });
  }
}

/* ---------- Dark mode ---------- */
function initTheme() {
  const saved = localStorage.getItem("agri-theme");
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
    if (darkToggle) darkToggle.checked = true;
  }
  darkToggle?.addEventListener("change", () => {
    const isDark = darkToggle.checked;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "");
    localStorage.setItem("agri-theme", isDark ? "dark" : "light");
  });
}

/* ---------- Init ---------- */
async function init() {
  registerServiceWorker();
  initTheme();
  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);

  initLanguageScreen();
  initLocationSearch();
  initComposer();
  initSettings();
  initDashboardInteractions();
  initFields();
  initJournal();
  initCalendar();
  initSoil();
  initFinance();

  if (selectedLang) {
    await bootApp(selectedLang);
  } else {
    await loadLocale("en");
    applyTranslations(langScreen);
  }
}

init();