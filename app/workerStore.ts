"use client";
// Workers who filled the /work questionnaire on this phone. There's no database yet, so they
// are kept in this browser only (localStorage) and added to the sample pool on this phone.
import { useSyncExternalStore } from "react";
import { SAMPLE_WORKERS, WorkerProfileSchema, type WorkerProfile } from "@/lib/workers";

const KEY = "kaam-pakka-workers";
const CHANGED = "kaam-pakka-workers-changed";
const NONE: WorkerProfile[] = [];

let cachedRaw: string | null = null;
let cached: WorkerProfile[] = NONE;

function read(): WorkerProfile[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return NONE; // storage blocked (private mode etc.)
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const list: unknown = JSON.parse(raw ?? "[]");
    // Keep only entries that still match the profile rules.
    cached = Array.isArray(list)
      ? list.flatMap((item) => {
          const p = WorkerProfileSchema.safeParse(item);
          return p.success ? [p.data] : [];
        })
      : NONE;
  } catch {
    cached = NONE;
  }
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export const useLocalWorkers = () => useSyncExternalStore(subscribe, read, () => NONE);

// Saves (or replaces, by phone number) one worker on this phone. Returns false if blocked.
export function saveLocalWorker(profile: WorkerProfile) {
  try {
    const others = read().filter((w) => w.phone !== profile.phone);
    window.localStorage.setItem(KEY, JSON.stringify([profile, ...others]));
    window.dispatchEvent(new Event(CHANGED));
    return true;
  } catch {
    return false;
  }
}

// Everyone the employer page can match: people from this phone first, then the samples.
export function workerPool(local: WorkerProfile[]) {
  const phones = new Set(local.map((w) => w.phone));
  return [...local, ...SAMPLE_WORKERS.filter((w) => !phones.has(w.phone))];
}
