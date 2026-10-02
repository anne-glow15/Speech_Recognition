import { create } from "zustand";
import type { ConnectionStatus, HistoryItem, RecorderStatus, Settings, TranscriptSegment, Word } from "@/types";
import { uid } from "@/utils/format";

export interface Toast { id: string; message: string; tone: "info" | "success" | "error" }

interface State {
  settings: Settings;
  language: string;
  model: string;
  deviceId: string;
  source: "record" | "upload";
  connection: ConnectionStatus;
  status: RecorderStatus;
  error: string | null;
  segments: TranscriptSegment[];
  partial: string;
  elapsed: number;
  speechFrames: number;
  totalFrames: number;
  uploadProgress: number | null;
  audioUrl: string | null;
  audioBlob: Blob | null;
  seek: { t: number; n: number } | null;
  history: HistoryItem[];
  toasts: Toast[];
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  analyser: AnalyserNode | null;

  set: (p: Partial<State>) => void;
  updateSettings: (p: Partial<Settings>) => void;
  addFinal: (text: string, words: Word[]) => void;
  editSegment: (id: string, text: string) => void;
  clearTranscript: () => void;
  setAudio: (blob: Blob | null) => void;
  seekTo: (t: number) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  wsUrl: "ws://127.0.0.1:2700",
  sampleRate: 16000,
  showPartials: true,
  autoPunctuation: true,
  confThreshold: 0.8,
  theme: "dark",
};

export const useStore = create<State>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  language: "English",
  model: "Vosk Higher Accuracy (en-us lgraph)",
  deviceId: "default",
  source: "record",
  connection: "disconnected",
  status: "idle",
  error: null,
  segments: [],
  partial: "",
  elapsed: 0,
  speechFrames: 0,
  totalFrames: 0,
  uploadProgress: null,
  audioUrl: null,
  audioBlob: null,
  seek: null,
  history: [],
  toasts: [],
  settingsOpen: false,
  shortcutsOpen: false,
  analyser: null,

  set: (p) => set(p),
  updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),
  addFinal: (text, words) => {
    const { autoPunctuation } = get().settings;
    let t = text.trim();
    if (autoPunctuation && t) t = t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".");
    const start = words[0]?.start ?? get().elapsed;
    const end = words[words.length - 1]?.end ?? start;
    const confidence = words.length ? words.reduce((a, w) => a + w.conf, 0) / words.length : 0.9;
    set({ segments: [...get().segments, { id: uid(), start, end, text: t, words, confidence, is_final: true }], partial: "" });
  },
  editSegment: (id, text) =>
    set({ segments: get().segments.map((s) => (s.id === id && s.text !== text ? { ...s, text, words: [] } : s)) }),
  clearTranscript: () => set({ segments: [], partial: "", elapsed: 0, speechFrames: 0, totalFrames: 0 }),
  setAudio: (blob) => {
    const old = get().audioUrl;
    if (old) URL.revokeObjectURL(old);
    set({ audioBlob: blob, audioUrl: blob ? URL.createObjectURL(blob) : null });
  },
  seekTo: (t) => set({ seek: { t, n: Date.now() } }),
  toast: (message, tone = "info") => {
    const id = uid();
    set({ toasts: [...get().toasts, { id, message, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== id) }), 2800);
  },
}));
