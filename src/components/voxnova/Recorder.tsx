import { useEffect, useRef } from "react";
import { Loader2, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatClock } from "@/utils/format";
import { Btn } from "./ui";
import { cn } from "@/lib/utils";

function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyser = useStore((s) => s.analyser);
  const status = useStore((s) => s.status);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary").trim();
    const accent = styles.getPropertyValue("--accent").trim();
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 128);
    let raf = 0;
    let t = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, primary);
      grad.addColorStop(1, accent);
      t += 0.04;
      if (analyser && status === "recording") {
        analyser.getByteFrequencyData(data);
        const bars = Math.min(96, Math.floor(w / 8));
        const bw = w / bars;
        ctx.fillStyle = grad;
        for (let i = 0; i < bars; i++) {
          // mirror around centre for a symmetric look
          const idx = Math.floor((Math.abs(i - bars / 2) / (bars / 2)) * data.length * 0.7);
          const v = (data[idx] ?? 0) / 255;
          const bh = Math.max(3, v * h * 0.9);
          ctx.beginPath();
          ctx.roundRect(i * bw + 1.5, (h - bh) / 2, bw - 3, bh, 3);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.globalAlpha = status === "paused" ? 0.4 : 0.8;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const y = h / 2 + Math.sin(x * 0.03 + t) * 4 * Math.sin(x * 0.005 + t * 0.3);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, status]);

  return <canvas ref={canvasRef} className="h-32 w-full sm:h-40" aria-hidden="true" />;
}

interface Props { onStart: () => void; onTogglePause: () => void; onStop: () => void }

export function Recorder({ onStart, onTogglePause, onStop }: Props) {
  const status = useStore((s) => s.status);
  const elapsed = useStore((s) => s.elapsed);
  const source = useStore((s) => s.source);
  const clearTranscript = useStore((s) => s.clearTranscript);
  const recording = status === "recording";
  const active = recording || status === "paused";
  const busy = status === "processing" || status === "requesting_permission";

  return (
    <section className="card-surface section-in overflow-hidden p-5 sm:p-6" aria-label="Recorder">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">AUDIO VISUALIZER</h2>
        <div className="flex items-center gap-2 font-mono text-sm" aria-live="polite">
          {recording && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />}
          <span className={cn(recording ? "text-destructive" : "text-muted-foreground")}>
            {recording ? "Recording" : status === "paused" ? "Paused" : status === "processing" ? "Processing" : "Idle"}
          </span>
          <span className="tabular-nums text-foreground">{formatClock(elapsed)}</span>
        </div>
      </div>
      <Visualizer />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
        <Btn variant="outline" onClick={onTogglePause} disabled={!active} aria-label={status === "paused" ? "Resume" : "Pause"}>
          {status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span className="hidden sm:inline">{status === "paused" ? "Resume" : "Pause"}</span>
        </Btn>
        <button
          onClick={active ? onStop : onStart}
          disabled={busy || source === "upload"}
          aria-label={active ? "Stop recording" : "Start recording"}
          className={cn(
            "grid h-20 w-20 place-items-center rounded-full text-primary-foreground transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100",
            active ? "bg-destructive shadow-glow" : "bg-gradient-primary shadow-primary",
          )}
        >
          {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : active ? <Square className="h-7 w-7 fill-current" /> : <Mic className="h-8 w-8" />}
        </button>
        <Btn variant="outline" onClick={onStop} disabled={!active} aria-label="Stop">
          <Square className="h-4 w-4" /><span className="hidden sm:inline">Stop</span>
        </Btn>
        <Btn variant="ghost" onClick={clearTranscript} disabled={active || busy} aria-label="Clear">
          <Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Clear</span>
        </Btn>
      </div>
      {source === "upload" && <p className="mt-3 text-center text-xs text-muted-foreground">Switch the audio source to Record to use the microphone.</p>}
    </section>
  );
}
