import { detectCountryCode, getStoredLocation } from "./location.js";
import { isLowDataMode } from "./i18n.js";
import { isOnline, matchLocalFaq } from "./offline.js";
import { getFarmContext } from "./farm.js";

const history = [];
const MAX_HISTORY = 24; // keep last 24 turns in memory

export async function sendMessage(message, language, mode) {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) throw new Error("Message is empty");

  const preferOffline = isLowDataMode() || !isOnline();
  const loc = getStoredLocation();

  if (preferOffline) {
    const local = matchLocalFaq(cleanMessage, language);
    if (local) return { reply: local, source: "offline_faq" };
  }

  const body = {
    message: cleanMessage,
    language,
    mode,
    history: history.slice(-8),
    prefer_offline: preferOffline,
    latitude: loc?.latitude ?? null,
    longitude: loc?.longitude ?? null,
    elevation: loc?.elevation ?? null,
    location_label: loc?.label ?? "",
    country_code: detectCountryCode(loc),
    farm_context: getFarmContext(),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Chat API ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }

    const data = await res.json();
    if (!data?.reply) throw new Error("Chat API returned no reply");

    // Only record AI-backed replies in history; fallback/offline replies
    // do not provide useful context for future turns.
    if (data.source === "ai") {
      history.push({ role: "user", content: cleanMessage });
      history.push({ role: "assistant", content: data.reply });
      // Trim in-place so the array never grows beyond MAX_HISTORY pairs
      while (history.length > MAX_HISTORY * 2) history.splice(0, 2);
    }

    return data;
  } catch (err) {
    const local = matchLocalFaq(cleanMessage, language);
    if (local) return { reply: local, source: "offline_faq" };
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearHistory() {
  history.length = 0;
}
