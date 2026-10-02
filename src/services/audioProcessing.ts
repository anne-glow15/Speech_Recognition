import { downsampleToPcm16 } from "@/utils/format";

export interface DecodedPcm {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
}

export async function decodeAudioToPcm(file: File, targetRate: number): Promise<DecodedPcm> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
    const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, length, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return {
      samples: normalizeSpeech(rendered.getChannelData(0)),
      sampleRate: targetRate,
      duration: decoded.duration,
    };
  } finally {
    if (decoder.state !== "closed") await decoder.close();
  }
}

function normalizeSpeech(input: Float32Array): Float32Array {
  let sum = 0;
  let peak = 0;
  for (const value of input) {
    sum += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const rms = Math.sqrt(sum / Math.max(1, input.length));
  const gain = Math.min(4, rms > 0.008 ? 0.18 / rms : 1);
  const limiter = Math.max(1, peak * gain / 0.98);
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) output[i] = (input[i] ?? 0) * gain / limiter;
  return output;
}

export function pcm16(samples: Float32Array, sourceRate: number, targetRate: number): Int16Array {
  return downsampleToPcm16(samples, sourceRate, targetRate);
}
