import { AudioLines, Keyboard, Moon, Settings, Sun } from "lucide-react";
import { asrClient } from "@/services/asrClient";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

const pill = {
  connected: { label: "Connected", cls: "bg-success/15 text-success", dot: "bg-success" },
  connecting: { label: "Connecting", cls: "bg-warning/15 text-warning", dot: "bg-warning" },
  disconnected: { label: "Disconnected", cls: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
};

export function Header() {
  const connection = useStore((s) => s.connection);
  const theme = useStore((s) => s.settings.theme);
  const set = useStore((s) => s.set);
  const updateSettings = useStore((s) => s.updateSettings);
  const p = pill[connection];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#" className="flex items-center gap-2.5" aria-label="VoxNova home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-primary">
            <AudioLines className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Vox<span className="text-accent">Nova</span>
          </span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", p.cls)}
            role="status"
            title={
              connection === "connected"
                ? "Connected to Vosk ASR server"
                : connection === "connecting"
                  ? "Connecting to Vosk ASR server..."
                  : "Disconnected — ensure Python server is running on ws://localhost:2700"
            }
          >
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", p.dot)} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", p.dot)} />
            </span>
            {p.label}
          </span>
          <button aria-label="Keyboard shortcuts" onClick={() => set({ shortcutsOpen: true })} className="hidden h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground sm:grid">
            <Keyboard className="h-5 w-5" />
          </button>
          <button aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })} className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button aria-label="Open settings" onClick={() => set({ settingsOpen: true })} className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function HeroStrip() {
  return (
    <div className="section-in relative overflow-hidden rounded-2xl py-8 text-center sm:py-12">
      {/* Hero background image */}
      <img
        src="/hero-waveform.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="relative z-10">
        <p className="mb-3 font-mono text-xs tracking-[0.3em] text-accent">VOSK · REAL-TIME · OFFLINE-READY</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          AUTOMATIC <span className="bg-gradient-primary bg-clip-text text-transparent">SPEECH</span> RECOGNITION
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">Convert speech into accurate text in real time</p>
      </div>
    </div>
  );
}
