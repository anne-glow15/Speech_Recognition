import { useCallback, useEffect, useRef } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatShort } from "@/utils/format";
import { Btn, Card } from "./ui";
import { cn } from "@/lib/utils";

export function AudioPlayer() {
  const audioUrl = useStore((s) => s.audioUrl);
  const seekCmd = useStore((s) => s.seek);
  const language = useStore((s) => s.language);
  const model = useStore((s) => s.model);
  const segments = useStore((s) => s.segments);
  const connection = useStore((s) => s.connection);
  const ref = useRef<HTMLAudioElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);

  // Seek from store (click-on-timestamp)
  useEffect(() => {
    if (seekCmd && ref.current && audioUrl) {
      ref.current.currentTime = seekCmd.t;
      if (ref.current.paused) void ref.current.play();
    }
  }, [seekCmd, audioUrl]);

  // Animation loop for progress bar
  useEffect(() => {
    const tick = () => {
      const el = ref.current;
      if (el && barRef.current && thumbRef.current && timeRef.current && durRef.current) {
        const pct = el.duration ? (el.currentTime / el.duration) * 100 : 0;
        barRef.current.style.width = `${pct}%`;
        thumbRef.current.style.left = `${pct}%`;
        timeRef.current.textContent = formatShort(el.currentTime);
        durRef.current.textContent = formatShort(el.duration || 0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play(); else el.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const el = ref.current;
    if (el) el.muted = !el.muted;
  }, []);

  const scrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    const prog = progRef.current;
    if (!el || !prog || !el.duration) return;
    const rect = prog.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * el.duration;
  }, []);

  const wordCount = segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  const avgConf = segments.length ? segments.reduce((a, s) => a + s.confidence, 0) / segments.length : 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Audio player */}
      <Card title="AUDIO PLAYER" icon={<Volume2 className="h-4 w-4" />}>
        {audioUrl ? (
          <audio ref={ref} src={audioUrl} preload="metadata" />
        ) : (
          <audio ref={ref} />
        )}
        <div className="space-y-3">
          {/* Progress bar */}
          <div ref={progRef} className="group relative h-2 cursor-pointer rounded-full bg-surface-alt" onClick={scrub}>
            <div ref={barRef} className="absolute inset-y-0 left-0 rounded-full bg-gradient-primary transition-[width] duration-75" />
            <div ref={thumbRef} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-foreground opacity-0 shadow transition-opacity group-hover:opacity-100" />
          </div>
          {/* Controls */}
          <div className="flex items-center justify-between">
            <span ref={timeRef} className="font-mono text-xs tabular-nums text-muted-foreground">00:00</span>
            <div className="flex items-center gap-2">
              <Btn variant="ghost" onClick={toggleMute} aria-label="Toggle mute" className="h-9 w-9 p-0">
                <Volume2 className="h-4 w-4 muted-hidden" /><VolumeX className="hidden h-4 w-4 muted-show" />
              </Btn>
              <button
                ref={playBtnRef}
                onClick={togglePlay}
                disabled={!audioUrl}
                aria-label="Play / Pause"
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-full text-primary-foreground transition-all hover:scale-105 disabled:opacity-40",
                  "bg-gradient-primary shadow-primary"
                )}
              >
                <Play className="h-5 w-5 fill-current" />
              </button>
              <span className="w-9" />
            </div>
            <span ref={durRef} className="font-mono text-xs tabular-nums text-muted-foreground">00:00</span>
          </div>
          {!audioUrl && <p className="text-center text-xs text-muted-foreground">Record or upload audio to play it back here.</p>}
        </div>
      </Card>

      {/* ASR info card */}
      <Card title="ASR INFORMATION" icon={<Volume2 className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Language" value={language} />
          <InfoRow label="Model" value={model.split("(")[0]?.trim() ?? model} />
          <InfoRow label="Connection" value={connection === "connected" ? "Vosk Server (Live)" : "Disconnected"} />
          <InfoRow label="Sample Rate" value="16 kHz" />
          <InfoRow label="Words" value={wordCount.toString()} />
          <InfoRow label="Avg Confidence" value={avgConf ? `${(avgConf * 100).toFixed(1)}%` : "—"} />
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
