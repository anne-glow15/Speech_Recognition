import type { TranscriptSegment } from "@/types";

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

export function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}

export function formatShort(sec: number): string {
  const s = Math.max(0, sec || 0);
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad((s % 3600) / 60)}:${pad(s % 60)}` : `${pad(s / 60)}:${pad(s % 60)}`;
}

export function formatSrtTime(sec: number): string {
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(sec / 3600)}:${pad((sec % 3600) / 60)}:${pad(sec % 60)},${String(ms).padStart(3, "0")}`;
}

export function countWords(segments: TranscriptSegment[]): number {
  return segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
}

export function wordsPerMinute(words: number, seconds: number): number {
  return seconds < 1 ? 0 : Math.round(words / (seconds / 60));
}

export function avgConfidence(segments: TranscriptSegment[]): number {
  const words = segments.flatMap((s) => s.words);
  if (words.length) return words.reduce((a, w) => a + w.conf, 0) / words.length;
  if (!segments.length) return 0;
  return segments.reduce((a, s) => a + s.confidence, 0) / segments.length;
}

/** Downsample Float32 audio to target rate and convert to 16-bit PCM (little-endian). */
export function downsampleToPcm16(input: Float32Array, inRate: number, outRate: number): Int16Array {
  if (inRate === outRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const v = Math.max(-1, Math.min(1, input[i] ?? 0));
      out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return out;
  }

  const ratio = inRate / outRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += input[i] ?? 0;
      count++;
    }
    const sample = count > 0 ? accum / count : (input[offsetBuffer] ?? 0);
    const clamped = Math.max(-1, Math.min(1, sample));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
