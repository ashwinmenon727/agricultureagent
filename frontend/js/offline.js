const FAQ_CACHE = "agriguide-faqs-v1";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js?v=4");
    if (reg) reg.update();
  } catch (err) {
    console.warn("SW registration failed", err);
  }
}

export async function prefetchFaqs(language) {
  try {
    const res = await fetch(`/api/faqs/${language}`);
    if (!res.ok) return;
    const data = await res.json();
    localStorage.setItem(`${FAQ_CACHE}:${language}`, JSON.stringify(data));
  } catch (_) {
    /* offline */
  }
}

export function getCachedFaqs(language) {
  const raw = localStorage.getItem(`${FAQ_CACHE}:${language}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function matchLocalFaq(message, language) {
  const faqs = getCachedFaqs(language) || getCachedFaqs("en");
  if (!faqs) return null;

  const query = message.toLowerCase();
  let best = null;
  let score = 0;

  for (const faq of faqs) {
    const keywords = faq.keywords || [];
    const s = keywords.reduce((acc, kw) => acc + (query.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (s > score) {
      score = s;
      best = faq.answer;
    }
  }

  return score >= 1 ? best : null;
}

export function isOnline() {
  return navigator.onLine;
}
