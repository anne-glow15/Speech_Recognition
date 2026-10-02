import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { exportPdf, exportTxt } from "@/services/exporters";

/**
 * Global keyboard shortcuts — mounted once at app root.
 * Skips shortcuts if an input / textarea / contenteditable is focused.
 */
export function useKeyboardShortcuts(actions: {
  onStart: () => void;
  onTogglePause: () => void;
  onStop: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active as HTMLElement)?.isContentEditable;

      // ? — open shortcuts overlay (even when typing)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !typing) {
        e.preventDefault();
        useStore.getState().set({ shortcutsOpen: true });
        return;
      }

      // Don't intercept when typing
      if (typing) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const st = useStore.getState();

      // Space — start / pause
      if (e.code === "Space" && !ctrl) {
        e.preventDefault();
        if (st.status === "idle" || st.status === "error") actions.onStart();
        else if (st.status === "recording" || st.status === "paused") actions.onTogglePause();
      }

      // Escape — stop
      if (e.key === "Escape") {
        if (st.status === "recording" || st.status === "paused") { e.preventDefault(); actions.onStop(); }
      }

      // Ctrl+E — export TXT
      if (ctrl && e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        if (st.segments.length) exportTxt(st.segments);
      }

      // Ctrl+Shift+E — export PDF
      if (ctrl && e.key === "E" && e.shiftKey) {
        e.preventDefault();
        if (st.segments.length) void exportPdf(st.segments);
      }

      // Ctrl+K — focus search (TranscriptEditor)
      if (ctrl && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[placeholder='Search transcript…']");
        input?.focus();
      }

      // Ctrl+, — open settings
      if (ctrl && e.key === ",") {
        e.preventDefault();
        st.set({ settingsOpen: true });
      }

      // Ctrl+L — clear transcript
      if (ctrl && e.key === "l") {
        e.preventDefault();
        if (st.status === "idle" || st.status === "error") st.clearTranscript();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
