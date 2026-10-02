import { useEffect, useRef, useState } from "react";
import { FileAudio, Mic, SlidersHorizontal, Upload } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Card, Field, Select } from "./ui";
import { cn } from "@/lib/utils";

const LANGS = ["English", "Tamil", "Hindi", "Telugu", "Spanish", "French", "German"];
const MODELS = [
  "Vosk Higher Accuracy (en-us lgraph)",
  "Vosk Small (en-us 0.15)",
  "Vosk Small (en-in 0.4)",
  "Vosk Hindi (hi 0.22)",
];
const ACCEPT = ".wav,.mp3,.m4a,.webm,audio/*";

export function InputPanel({ onFile }: { onFile: (f: File) => void }) {
  const { language, model, deviceId, source, status, uploadProgress, set } = useStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status !== "idle" && status !== "error";

  useEffect(() => {
    const load = () =>
      navigator.mediaDevices?.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "audioinput"))).catch(() => setDevices([]));
    load();
    navigator.mediaDevices?.addEventListener("devicechange", load);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", load);
  }, [status]);

  const accept = (f?: File) => {
    if (!f) return;
    if (!/\.(wav|mp3|m4a|webm|ogg)$/i.test(f.name) && !f.type.startsWith("audio/")) {
      useStore.getState().toast("Unsupported file type", "error");
      return;
    }
    onFile(f);
  };

  return (
    <Card title="INPUT" icon={<SlidersHorizontal className="h-4 w-4" />}>
      <div className="space-y-4">
        <Field label="Microphone">
          <Select value={deviceId} onChange={(e) => set({ deviceId: e.target.value })} disabled={busy}>
            <option value="default">System default</option>
            {devices.filter((d) => d.deviceId && d.deviceId !== "default").map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language">
            <Select value={language} onChange={(e) => set({ language: e.target.value })} disabled={busy}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="ASR model">
            <Select value={model} onChange={(e) => set({ model: e.target.value })} disabled={busy}>
              {MODELS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Audio source</span>
          <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-alt p-1">
            {(["record", "upload"] as const).map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={source === v}
                disabled={busy}
                onClick={() => set({ source: v })}
                className={cn("flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all", source === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
              >
                {v === "record" ? <Mic className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {v === "record" ? "Record" : "Upload"}
              </button>
            ))}
          </div>
        </div>
        {source === "upload" ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
            className={cn("rounded-xl border-2 border-dashed p-6 text-center transition-colors", drag ? "border-accent bg-accent/10" : "border-border")}
          >
            <FileAudio className="mx-auto mb-2 h-8 w-8 text-accent" />
            <p className="text-sm">Drag & drop an audio file</p>
            <p className="mb-3 text-xs text-muted-foreground">.wav · .mp3 · .m4a · .webm</p>
            <button disabled={busy} onClick={() => inputRef.current?.click()} className="min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-secondary disabled:opacity-40">
              Browse files
            </button>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ""; }} />
            {uploadProgress !== null && (
              <div className="mt-4" aria-live="polite">
                <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground"><span>Transcribing…</span><span>{uploadProgress}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                  <div className="h-full bg-gradient-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-alt p-3 text-xs text-muted-foreground">
            Press <kbd className="rounded bg-card px-1.5 py-0.5 font-mono">Space</kbd> to start/pause and <kbd className="rounded bg-card px-1.5 py-0.5 font-mono">Esc</kbd> to stop.
          </p>
        )}
      </div>
    </Card>
  );
}
