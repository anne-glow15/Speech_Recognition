import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { useStore } from "@/store/useStore";

const SHORTCUTS = [
  { key: "Space", desc: "Start / pause recording" },
  { key: "Escape", desc: "Stop recording" },
  { key: "Ctrl + E", desc: "Export transcript as TXT" },
  { key: "Ctrl + Shift + E", desc: "Export transcript as PDF" },
  { key: "Ctrl + K", desc: "Focus search" },
  { key: "Ctrl + ,", desc: "Open settings" },
  { key: "Ctrl + L", desc: "Clear transcript" },
  { key: "?", desc: "Show shortcuts overlay" },
];

export function ShortcutsOverlay() {
  const open = useStore((s) => s.shortcutsOpen);
  const set = useStore((s) => s.set);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") set({ shortcutsOpen: false }); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, set]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) set({ shortcutsOpen: false }); }}>
      <div className="card-surface section-in w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Keyboard className="h-5 w-5 text-accent" /> Keyboard Shortcuts
          </h2>
          <button onClick={() => set({ shortcutsOpen: false })} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface-alt/60">
              <span className="text-foreground">{s.desc}</span>
              <kbd className="rounded-md border border-border bg-surface-alt px-2.5 py-1 font-mono text-xs text-muted-foreground">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
