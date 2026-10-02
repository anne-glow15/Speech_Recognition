import type { ConnectionStatus, VoskResult, Word } from "@/types";

type Cb<T> = (v: T) => void;

/**
 * Pure Vosk WebSocket client.
 * Connects to the local Python Vosk server, streams 16-bit PCM audio,
 * and delivers real-time partial and final transcription results.
 */
export class AsrClient {
  private ws: WebSocket | null = null;
  private url = "ws://127.0.0.1:2700";
  private sampleRate = 16000;
  private intentional = false;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Uint8Array(0);
  private eofResolve: (() => void) | null = null;
  private connectionWaiters: Array<(connected: boolean) => void> = [];

  private partialCbs: Cb<string>[] = [];
  private finalCbs: Cb<{ text: string; words: Word[] }>[] = [];
  private errorCbs: Cb<string>[] = [];
  private statusCbs: Cb<ConnectionStatus>[] = [];

  configure(opts: { url: string; sampleRate: number }) {
    // Firefox may resolve localhost to ::1 while the Python server is bound
    // to IPv4. Normalize only the built-in local endpoint; custom hosts stay
    // untouched.
    const url = opts.url.replace(/^ws:\/\/localhost(?=[:/])/, "ws://127.0.0.1");
    const changed = url !== this.url;
    this.url = url;
    this.sampleRate = opts.sampleRate;
    if (changed) {
      this.disconnect();
      this.connect();
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onPartial(cb: Cb<string>) {
    this.partialCbs.push(cb);
    return () => {
      this.partialCbs = this.partialCbs.filter((c) => c !== cb);
    };
  }

  onFinal(cb: Cb<{ text: string; words: Word[] }>) {
    this.finalCbs.push(cb);
    return () => {
      this.finalCbs = this.finalCbs.filter((c) => c !== cb);
    };
  }

  onError(cb: Cb<string>) {
    this.errorCbs.push(cb);
    return () => {
      this.errorCbs = this.errorCbs.filter((c) => c !== cb);
    };
  }

  onStatus(cb: Cb<ConnectionStatus>) {
    this.statusCbs.push(cb);
    return () => {
      this.statusCbs = this.statusCbs.filter((c) => c !== cb);
    };
  }

  private emitStatus(s: ConnectionStatus) {
    this.statusCbs.forEach((c) => c(s));
  }

  connect() {
    if (typeof window === "undefined") return;
    this.intentional = false;
    this.emitStatus("connecting");
    try {
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        this.retry = 0;
        this.connectionWaiters.splice(0).forEach((resolve) => resolve(true));
        this.emitStatus("connected");
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
      ws.onerror = () => {
        /* onclose handles reconnect */
      };
      ws.onclose = () => {
        this.ws = null;
        this.emitStatus("disconnected");
        this.eofResolve?.();
        this.eofResolve = null;
        this.connectionWaiters.splice(0).forEach((resolve) => resolve(false));
        if (!this.intentional) this.scheduleReconnect();
      };
      this.ws = ws;
    } catch {
      this.emitStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(15000, 1000 * 2 ** Math.min(this.retry++, 4));
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this.intentional = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
    this.connectionWaiters.splice(0).forEach((resolve) => resolve(false));
  }

  /** Wait for the server before a recording starts, so config/audio cannot race the handshake. */
  async waitUntilConnected(timeoutMs = 5000): Promise<boolean> {
    if (this.isConnected) return true;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.connectionWaiters = this.connectionWaiters.filter((r) => r !== finish);
        resolve(false);
      }, timeoutMs);
      const finish = (connected: boolean) => {
        clearTimeout(timer);
        resolve(connected);
      };
      this.connectionWaiters.push(finish);
    });
  }

  private handleMessage(data: unknown) {
    if (typeof data !== "string") return;
    try {
      const msg = JSON.parse(data) as VoskResult;
      if (msg.error) {
        this.errorCbs.forEach((c) => c(`Vosk server: ${msg.error}`));
        return;
      }
      if (msg.partial !== undefined) {
        this.partialCbs.forEach((c) => c(msg.partial ?? ""));
      }
      if (msg.text !== undefined) {
        if (msg.text) {
          this.finalCbs.forEach((c) =>
            c({ text: msg.text ?? "", words: msg.result ?? [] }),
          );
        }
        this.eofResolve?.();
        this.eofResolve = null;
      }
    } catch {
      this.errorCbs.forEach((c) => c("Malformed message from Vosk ASR server"));
    }
  }

  startStream() {
    this.pending = new Uint8Array(0);
    if (this.isConnected) {
      this.ws?.send(
        JSON.stringify({ config: { sample_rate: this.sampleRate } }),
      );
    } else {
      this.errorCbs.forEach((c) =>
        c("Vosk server is not connected. Please start the Python server on ws://127.0.0.1:2700"),
      );
    }
  }

  /** Accepts 16-bit PCM at the configured sample rate. Sends ~4000 byte chunks. */
  sendAudio(pcm: Int16Array) {
    if (!this.isConnected) return;
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const merged = new Uint8Array(this.pending.length + bytes.length);
    merged.set(this.pending);
    merged.set(bytes, this.pending.length);
    let off = 0;
    while (merged.length - off >= 4000) {
      this.ws?.send(merged.slice(off, off + 4000));
      off += 4000;
    }
    this.pending = merged.slice(off);
  }

  async stopStream(): Promise<void> {
    if (!this.isConnected) {
      this.pending = new Uint8Array(0);
      return;
    }
    if (this.pending.length) {
      this.ws?.send(this.pending);
    }
    this.pending = new Uint8Array(0);
    await new Promise<void>((resolve) => {
      this.eofResolve = resolve;
      this.ws?.send(JSON.stringify({ eof: 1 }));
      setTimeout(() => {
        if (this.eofResolve === resolve) {
          this.eofResolve = null;
          resolve();
        }
      }, 4000);
    });
  }
}

export const asrClient = new AsrClient();
