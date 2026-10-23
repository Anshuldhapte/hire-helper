"use client";
// The browser's own voice features: reading text aloud (Listen) and typing by voice (mic).
// Not every phone has them, so the screen checks first and hides what isn't available.
import { useSyncExternalStore } from "react";

// ---- Reading aloud ----
let voiceCache: SpeechSynthesisVoice[] = [];
const NO_VOICES: SpeechSynthesisVoice[] = [];

function subscribeVoices(onChange: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  const update = () => {
    voiceCache = window.speechSynthesis.getVoices();
    onChange();
  };
  update();
  window.speechSynthesis.addEventListener("voiceschanged", update);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
}

// The phone's installed voices (the list can arrive a moment after the page loads).
export const useVoices = () => useSyncExternalStore(subscribeVoices, () => voiceCache, () => NO_VOICES);

// e.g. findVoice(voices, "mr") for Marathi (mr-IN), "hi" for Hindi (hi-IN).
export const findVoice = (voices: SpeechSynthesisVoice[], lang: string) =>
  voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;

// The best voice for a page language. Marathi falls back to a Hindi voice (same script,
// close enough to follow) because many phones have Hindi but not Marathi.
export function voiceFor(voices: SpeechSynthesisVoice[], lang: "mr" | "hi" | "en") {
  if (lang === "en") return voices.find((v) => v.lang === "en-IN") ?? findVoice(voices, "en");
  return findVoice(voices, lang) ?? (lang === "mr" ? findVoice(voices, "hi") : null);
}

export function speak(text: string, voice: SpeechSynthesisVoice) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  window.speechSynthesis.cancel(); // stop anything already playing
  window.speechSynthesis.speak(utterance);
}

// ---- Typing by voice ----
type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
export type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionConstructor = new () => Recognition;

export function getRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};
// true when this browser can turn speech into text.
export const useMicSupported = () => useSyncExternalStore(noSubscribe, () => getRecognition() !== null, () => false);
