export const LANGUAGES = [
  { code: "en", label: "English", native: "English", speech: "en-US" },
  { code: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "bn", label: "Bengali", native: "বাংলা", speech: "bn-IN" },
  { code: "ta", label: "Tamil", native: "தமிழ்", speech: "ta-IN" },
  { code: "te", label: "Telugu", native: "తెలుగు", speech: "te-IN" },
  { code: "mr", label: "Marathi", native: "मराठी", speech: "mr-IN" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", speech: "gu-IN" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", speech: "kn-IN" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", speech: "ml-IN" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", speech: "pa-IN" },
  { code: "ur", label: "Urdu", native: "اردو", speech: "ur-PK" },
  { code: "ne", label: "Nepali", native: "नेपाली", speech: "ne-NP" },
  { code: "si", label: "Sinhala", native: "සිංහල", speech: "si-LK" },
  { code: "my", label: "Burmese", native: "မြန်မာ", speech: "my-MM" },
  { code: "th", label: "Thai", native: "ไทย", speech: "th-TH" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt", speech: "vi-VN" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia", speech: "id-ID" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu", speech: "ms-MY" },
  { code: "tl", label: "Filipino", native: "Filipino", speech: "fil-PH" },
  { code: "zh", label: "Chinese", native: "中文", speech: "zh-CN" },
  { code: "ja", label: "Japanese", native: "日本語", speech: "ja-JP" },
  { code: "ko", label: "Korean", native: "한국어", speech: "ko-KR" },
  { code: "km", label: "Khmer", native: "ខ្មែរ", speech: "km-KH" },
  { code: "lo", label: "Lao", native: "ລາວ", speech: "lo-LA" },
  { code: "ar", label: "Arabic", native: "العربية", speech: "ar-SA" },
  { code: "fa", label: "Persian", native: "فارسی", speech: "fa-IR" },
  { code: "tr", label: "Turkish", native: "Türkçe", speech: "tr-TR" },
  { code: "kk", label: "Kazakh", native: "Қазақша", speech: "kk-KZ" },
  { code: "uz", label: "Uzbek", native: "Oʻzbek", speech: "uz-UZ" },
  { code: "mn", label: "Mongolian", native: "Монгол", speech: "mn-MN" },
  { code: "ru", label: "Russian", native: "Русский", speech: "ru-RU" },
];

const STORAGE_KEY = "agriguide_lang";
const MODE_KEY = "agriguide_mode";
const LOW_DATA_KEY = "agriguide_low_data";

let strings = {};

export function getStoredLanguage() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setStoredLanguage(code) {
  localStorage.setItem(STORAGE_KEY, code);
}

export function getMode() {
  return localStorage.getItem(MODE_KEY) || "simple";
}

export function setMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function isLowDataMode() {
  return localStorage.getItem(LOW_DATA_KEY) === "1";
}

export function setLowDataMode(on) {
  localStorage.setItem(LOW_DATA_KEY, on ? "1" : "0");
}

export async function loadLocale(code) {
  const fallback = "en";
  try {
    const res = await fetch(`/locales/${code}.json`);
    if (res.ok) {
      strings = await res.json();
      return;
    }
  } catch (_) {
    /* offline or locale not found — try English fallback */
  }
  try {
    const res = await fetch(`/locales/${fallback}.json`);
    if (res.ok) {
      strings = await res.json();
    }
  } catch (_) {
    /* fully offline — strings stays as empty object; t() returns keys */
  }
}

function getNested(key) {
  return key.split(".").reduce((obj, part) => obj?.[part], strings);
}

export function t(key) {
  return getNested(key) || key;
}

export function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = getStoredLanguage() || "en";
}

export function speechLang(code) {
  return LANGUAGES.find((l) => l.code === code)?.speech || "en-US";
}
