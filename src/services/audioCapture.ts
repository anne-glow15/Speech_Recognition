export interface MicrophoneCaptureOptions {
  deviceId: string;
  onAudio: (samples: Float32Array, sampleRate: number) => void;
}

export interface MicrophoneCaptureResult {
  sampleRate: number;
  analyser: AnalyserNode;
  stream: MediaStream;
}

type AudioProcessor = AudioWorkletNode | ScriptProcessorNode;

/** Owns microphone permissions, the Web Audio graph, and reliable PCM delivery. */
export class MicrophoneCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioProcessor | null = null;
  private mutedOutput: GainNode | null = null;
  private flushResolver: (() => void) | null = null;

  async start(options: MicrophoneCaptureOptions): Promise<MicrophoneCaptureResult> {
    if (this.context) throw new Error("Microphone capture is already running");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone capture requires a secure browser context.");
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === "audioinput");
    if (!inputs.length) throw new Error("No microphone input device is available.");

    const selected = inputs.some((device) => device.deviceId === options.deviceId);
    const constraints: MediaStreamConstraints = {
      audio: {
        ...(options.deviceId !== "default" && selected
          ? { deviceId: { exact: options.deviceId } }
          : {}),
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: false },
        noiseSuppression: { ideal: false },
        autoGainControl: { ideal: false },
      },
      video: false,
    };

    let permissionSettled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (permissionSettled) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Microphone permission was answered too late. Try again.");
      }
      return stream;
    });

    let stream: MediaStream;
    try {
      stream = await Promise.race([
        request,
        new Promise<MediaStream>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Microphone permission request timed out. Check browser and Windows microphone permissions.")),
            15000,
          );
        }),
      ]);
    } finally {
      permissionSettled = true;
      if (timer) clearTimeout(timer);
    }

    try {
      const context = new AudioContext();
      this.context = context;
      this.stream = stream;
      if (context.state === "suspended") await context.resume();

      const source = context.createMediaStreamSource(stream);
      const highpass = context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 70;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -30;
      compressor.knee.value = 20;
      compressor.ratio.value = 2;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;

      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      source.connect(highpass);
      highpass.connect(compressor);
      compressor.connect(analyser);
      this.source = source;

      const onAudio = (samples: Float32Array) => options.onAudio(samples, context.sampleRate);
      try {
        await context.audioWorklet.addModule("/audio-capture-processor.js");
        const worklet = new AudioWorkletNode(context, "voxnova-capture", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
        });
        worklet.port.onmessage = (event: MessageEvent) => {
          if (event.data?.type === "audio") onAudio(event.data.samples as Float32Array);
          if (event.data?.type === "flushed") this.flushResolver?.();
        };
        compressor.connect(worklet);
        this.processor = worklet;
      } catch {
        const script = context.createScriptProcessor(4096, 1, 1);
        script.onaudioprocess = (event) => onAudio(new Float32Array(event.inputBuffer.getChannelData(0)));
        compressor.connect(script);
        this.processor = script;
      }

      const muted = context.createGain();
      muted.gain.value = 0;
      // Keep the analyser branch live even though it must never play back mic audio.
      analyser.connect(muted);
      this.processor.connect(muted);
      muted.connect(context.destination);
      this.mutedOutput = muted;

      return { sampleRate: context.sampleRate, analyser, stream };
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      if (this.context && this.context.state !== "closed") await this.context.close();
      this.context = null;
      this.stream = null;
      throw error instanceof Error ? error : new Error("Could not initialize microphone audio processing.");
    }
  }

  async stop(): Promise<void> {
    const processor = this.processor;
    if (processor instanceof AudioWorkletNode) {
      await new Promise<void>((resolve) => {
        this.flushResolver = resolve;
        processor.port.postMessage({ type: "flush" });
        setTimeout(resolve, 250);
      });
    }

    processor?.disconnect();
    this.mutedOutput?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") await this.context.close();

    this.flushResolver = null;
    this.processor = null;
    this.mutedOutput = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}
