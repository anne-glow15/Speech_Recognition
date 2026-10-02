export type RecorderStatus = "idle" | "requesting_permission" | "recording" | "paused" | "processing" | "error";
export type ConnectionStatus = "connected" | "connecting" | "disconnected";
export type AsrStatus = "Ready" | "Listening" | "Processing" | "Error";

export interface Word {
  word: string;
  start: number;
  end: number;
  conf: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  words: Word[];
  is_final: boolean;
}

export interface HistoryItem {
  id: string;
  title: string;
  duration: number;
  language: string;
  confidence: number;
  created_at: string;
  segments: TranscriptSegment[];
  audio_blob_key: string;
}

export interface Settings {
  wsUrl: string;
  sampleRate: number;
  showPartials: boolean;
  autoPunctuation: boolean;
  confThreshold: number;
  theme: "dark" | "light";
}

export interface VoskResult {
  text?: string;
  partial?: string;
  result?: Word[];
  error?: string;
}
