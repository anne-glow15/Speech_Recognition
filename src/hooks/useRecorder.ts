import { useCallback, useEffect, useRef } from "react";
import { asrClient } from "@/services/asrClient";
import { MicrophoneCapture } from "@/services/audioCapture";
import { decodeAudioToPcm, pcm16 } from "@/services/audioProcessing";
import { useStore } from "@/store/useStore";

const SPEECH_RMS = 0.015;
const ASR_RATE = 16000;

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

function stopMediaRecorder(recorder: MediaRecorder | null, chunks: Blob[]): Promise<Blob> {
  return new Promise((resolve) => {
    if (!recorder || recorder.state === "inactive") {
      resolve(new Blob(chunks));
      return;
    }
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.stop();
  });
}

/** Coordinates microphone/file capture, PCM conversion, and Vosk streaming. */
export function useRecorder() {
  const captureRef = useRef<MicrophoneCapture | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const releaseUiResources = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current = null;
    useStore.getState().set({ analyser: null });
  }, []);

  const releaseCapture = useCallback(async () => {
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) await capture.stop();
    releaseUiResources();
  }, [releaseUiResources]);

  useEffect(() => () => {
    void releaseCapture();
  }, [releaseCapture]);

  const start = useCallback(async () => {
    const state = useStore.getState();
    if (state.status === "recording" || state.status === "processing" || state.status === "requesting_permission") return;
    state.set({ status: "requesting_permission", error: null, partial: "" });

    try {
      if (!(await asrClient.waitUntilConnected())) throw new Error("Vosk server is not connected.");
      const capture = new MicrophoneCapture();
      captureRef.current = capture;
      asrClient.startStream();

      const result = await capture.start({
        deviceId: state.deviceId,
        onAudio: (samples, sampleRate) => {
          if (pausedRef.current) return;
          const current = useStore.getState();
          const level = rms(samples);
          current.set({
            totalFrames: current.totalFrames + 1,
            speechFrames: current.speechFrames + (level > SPEECH_RMS ? 1 : 0),
          });
          asrClient.sendAudio(pcm16(samples, sampleRate, ASR_RATE));
        },
      });

      chunksRef.current = [];
      if (typeof MediaRecorder === "undefined") throw new Error("This browser does not support microphone recording.");
      const mediaRecorder = new MediaRecorder(result.stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      mediaRecorder.start(1000);
      recorderRef.current = mediaRecorder;
      pausedRef.current = false;

      useStore.getState().set({
        status: "recording",
        analyser: result.analyser,
        elapsed: 0,
        speechFrames: 0,
        totalFrames: 0,
      });
      const startedAt = Date.now();
      let pausedMs = 0;
      let pauseStarted = 0;
      timerRef.current = setInterval(() => {
        if (pausedRef.current) {
          if (!pauseStarted) pauseStarted = Date.now();
          return;
        }
        if (pauseStarted) {
          pausedMs += Date.now() - pauseStarted;
          pauseStarted = 0;
        }
        useStore.getState().set({ elapsed: (Date.now() - startedAt - pausedMs) / 1000 });
      }, 250);
    } catch (error) {
      await releaseCapture();
      const name = error instanceof DOMException ? error.name : "";
      const message =
        name === "NotAllowedError" ? "Microphone permission denied. Allow microphone access for this site."
        : name === "NotFoundError" ? "No microphone input device was found."
        : name === "NotReadableError" ? "The microphone is in use by another application."
        : error instanceof Error && error.message ? error.message
        : "Could not start microphone capture.";
      useStore.getState().set({ status: "error", error: message });
      useStore.getState().toast(message, "error");
    }
  }, [releaseCapture]);

  const togglePause = useCallback(() => {
    const state = useStore.getState();
    if (state.status === "recording") {
      pausedRef.current = true;
      recorderRef.current?.pause();
      state.set({ status: "paused" });
    } else if (state.status === "paused") {
      pausedRef.current = false;
      recorderRef.current?.resume();
      state.set({ status: "recording" });
    }
  }, []);

  const stop = useCallback(async () => {
    const state = useStore.getState();
    if (state.status !== "recording" && state.status !== "paused") return;
    state.set({ status: "processing" });
    try {
      const blob = await stopMediaRecorder(recorderRef.current, chunksRef.current);
      await releaseCapture();
      await asrClient.stopStream();
      useStore.getState().setAudio(blob);
      useStore.getState().set({ status: "idle" });
    } catch (error) {
      await releaseCapture();
      const message = error instanceof Error ? error.message : "Could not finish microphone processing.";
      useStore.getState().set({ status: "error", error: message });
      useStore.getState().toast(message, "error");
    }
  }, [releaseCapture]);

  const transcribeFile = useCallback(async (file: File) => {
    const state = useStore.getState();
    state.clearTranscript();
    state.setAudio(file);
    state.set({ status: "processing", uploadProgress: 0, error: null });
    try {
      if (!(await asrClient.waitUntilConnected())) throw new Error("Vosk server is not connected.");
      const decoded = await decodeAudioToPcm(file, ASR_RATE);
      asrClient.startStream();
      const chunkSize = ASR_RATE * 2;
      for (let offset = 0; offset < decoded.samples.length; offset += chunkSize) {
        const slice = decoded.samples.subarray(offset, Math.min(offset + chunkSize, decoded.samples.length));
        const current = useStore.getState();
        current.set({
          uploadProgress: Math.round((offset / decoded.samples.length) * 100),
          elapsed: offset / decoded.sampleRate,
          totalFrames: current.totalFrames + 1,
          speechFrames: current.speechFrames + (rms(slice) > SPEECH_RMS ? 1 : 0),
        });
        asrClient.sendAudio(pcm16(slice, decoded.sampleRate, ASR_RATE));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await asrClient.stopStream();
      useStore.getState().set({ elapsed: decoded.duration, uploadProgress: null, status: "idle" });
      useStore.getState().toast("Transcription complete", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not process this audio file.";
      useStore.getState().set({ status: "error", uploadProgress: null, error: message });
      useStore.getState().toast(message, "error");
    }
  }, []);

  return { start, togglePause, stop, transcribeFile };
}
