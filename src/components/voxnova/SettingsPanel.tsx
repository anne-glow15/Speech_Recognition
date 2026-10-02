import { useEffect, useRef } from "react";
import { Settings as SettingsIcon, X } from "lucide-react";
import { useStore, DEFAULT_SETTINGS } from "@/store/useStore";
import { Btn, Field, Toggle } from "./ui";
import { saveSettings } from "@/services/storage";

export function SettingsPanel() {
  const open = useStore((s) => s.settingsOpen);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") set({ settingsOpen: false }); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, set]);

  if (!open) return null;

  const save = () => {
    saveSettings(settings);
    toast("Settings saved", "success");
    set({ settingsOpen: false });
  };

  const reset = () => {
    updateSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    toast("Settings reset to defaults", "info");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) set({ settingsOpen: false }); }}>
      <div ref={panelRef} className="card-surface section-in m-4 w-full max-w-md overflow-y-auto p-6" style={{ maxHeight: "calc(100vh - 2rem)" }}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <SettingsIcon className="h-5 w-5 text-accent" /> Settings
          </h2>
          <button onClick={() => set({ settingsOpen: false })} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close settings">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <Field label="WebSocket URL">
            <input
              value={settings.wsUrl}
              onChange={(e) => updateSettings({ wsUrl: e.target.value })}
              className="min-h-10 w-full rounded-lg border border-input bg-surface-alt px-3 text-sm text-foreground focus:border-ring"
            />
          </Field>

          <Field label="Sample Rate (Hz)">
            <input
              type="number"
              value={settings.sampleRate}
              onChange={(e) => updateSettings({ sampleRate: parseInt(e.target.value) || 16000 })}
              className="min-h-10 w-full rounded-lg border border-input bg-surface-alt px-3 text-sm text-foreground focus:border-ring"
            />
          </Field>

          <Field label={`Confidence Threshold: ${(settings.confThreshold * 100).toFixed(0)}%`}>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={settings.confThreshold}
              onChange={(e) => updateSettings({ confThreshold: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </Field>

          <div className="space-y-1 rounded-lg border border-border p-3">
            <Toggle checked={settings.showPartials} onChange={(v) => updateSettings({ showPartials: v })} label="Show partial results" />
            <Toggle checked={settings.autoPunctuation} onChange={(v) => updateSettings({ autoPunctuation: v })} label="Auto-punctuation" />
          </div>

          <div className="flex gap-3 pt-2">
            <Btn variant="primary" onClick={save} className="flex-1">Save</Btn>
            <Btn variant="outline" onClick={reset}>Reset</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
