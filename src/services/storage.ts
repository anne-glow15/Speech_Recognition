import type { HistoryItem, Settings, TranscriptSegment } from "@/types";

const HISTORY_KEY = "voxnova.history";
const SETTINGS_KEY = "voxnova.settings";
const DB = "voxnova";
const STORE = "audio";

function seg(start: number, text: string, conf: number): TranscriptSegment {
  const parts = text.split(" ");
  const step = 0.4;
  return {
    id: `${start}-${text.length}`,
    start,
    end: start + parts.length * step,
    text,
    confidence: conf,
    is_final: true,
    words: parts.map((w, i) => ({ word: w, start: start + i * step, end: start + (i + 0.9) * step, conf: i === 3 ? 0.68 : conf })),
  };
}

export const SEED_HISTORY: HistoryItem[] = [
  {
    id: "seed-1", title: "Lecture 01", duration: 763, language: "English", confidence: 0.94,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(), audio_blob_key: "",
    segments: [seg(0, "today we will discuss the fundamentals of signal processing", 0.95), seg(5, "a signal is any function that carries information over time", 0.93)],
  },
  {
    id: "seed-2", title: "Meeting", duration: 2061, language: "English", confidence: 0.91,
    created_at: new Date(Date.now() - 86400000).toISOString(), audio_blob_key: "",
    segments: [seg(0, "let us review the sprint goals for this week", 0.92), seg(4, "the backend integration should be ready by friday", 0.9)],
  },
  {
    id: "seed-3", title: "Voice Note", duration: 134, language: "Tamil", confidence: 0.88,
    created_at: new Date().toISOString(), audio_blob_key: "",
    segments: [seg(0, "vanakkam indru meeting naalu manikku", 0.88)],
  },
];

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : SEED_HISTORY;
  } catch {
    return SEED_HISTORY;
  }
}

export function saveHistory(items: HistoryItem[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch { /* quota */ }
}

export function loadSettings(): Partial<Settings> {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>; } catch { return {}; }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAudio(key: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getAudio(key: string): Promise<Blob | null> {
  if (!key) return null;
  const db = await openDb();
  return new Promise((res) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => res((req.result as Blob | undefined) ?? null);
    req.onerror = () => res(null);
  });
}

export async function deleteAudio(key: string) {
  if (!key) return;
  const db = await openDb();
  db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
}
