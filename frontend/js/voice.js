import { speechLang } from "./i18n.js";

let recognition = null;
let listening = false;

function getRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
  }
  return recognition;
}

export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechOutSupported() {
  return "speechSynthesis" in window;
}

export function startListening(languageCode, onResult, onError) {
  const rec = getRecognition();
  if (!rec) {
    onError(new Error("Speech recognition not supported in this browser"));
    return;
  }
  if (listening) return;

  rec.lang = speechLang(languageCode);
  listening = true;

  rec.onresult = (event) => {
    const text = event.results[0][0].transcript;
    onResult(text);
  };
  rec.onerror = (event) => onError(new Error(event.error));
  rec.onend = () => {
    listening = false;
  };

  rec.start();
}

export function stopListening() {
  if (recognition && listening) {
    recognition.stop();
    listening = false;
  }
}

export function speak(text, languageCode) {
  if (!isSpeechOutSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = speechLang(languageCode);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (isSpeechOutSupported()) {
    window.speechSynthesis.cancel();
  }
}
