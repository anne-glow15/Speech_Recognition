import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Pen, Search, Subtitles, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatShort } from "@/utils/format";
import { exportPdf, exportSrt, exportTxt } from "@/services/exporters";
import { Card, Btn } from "./ui";
import { cn } from "@/lib/utils";

export function TranscriptEditor() {
  const segments = useStore((s) => s.segments);
  const confThreshold = useStore((s) => s.settings.confThreshold);
  const editSegment = useStore((s) => s.editSegment);
  const seekTo = useStore((s) => s.seekTo);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!query.trim()) return new Set<string>();
    const q = query.toLowerCase();
    return new Set(segments.filter((s) => s.text.toLowerCase().includes(q)).map((s) => s.id));
  }, [query, segments]);

  const startEdit = useCallback((id: string, text: string) => {
    setEditing(id);
    setEditText(text);
  }, []);

  const commitEdit = useCallback(() => {
    if (editing && editText.trim()) editSegment(editing, editText.trim());
    setEditing(null);
  }, [editing, editText, editSegment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) setEditing(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing]);

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const q = query.toLowerCase();
    const parts: { text: string; match: boolean }[] = [];
    let remaining = text;
    while (remaining.length) {
      const idx = remaining.toLowerCase().indexOf(q);
      if (idx === -1) { parts.push({ text: remaining, match: false }); break; }
      if (idx > 0) parts.push({ text: remaining.slice(0, idx), match: false });
      parts.push({ text: remaining.slice(idx, idx + q.length), match: true });
      remaining = remaining.slice(idx + q.length);
    }
    return parts.map((p, i) => p.match ? <mark key={i} className="rounded bg-accent/30 px-0.5 text-accent-foreground">{p.text}</mark> : <span key={i}>{p.text}</span>);
  };

  return (
    <Card
      title="TRANSCRIPT EDITOR"
      icon={<Pen className="h-4 w-4" />}
      className="flex flex-col"
      action={
        segments.length > 0 && (
          <div className="flex gap-1">
            <Btn variant="ghost" onClick={() => exportTxt(segments)} aria-label="Export TXT" className="h-8 px-2"><FileText className="h-3.5 w-3.5" /><span className="hidden text-xs sm:inline">TXT</span></Btn>
            <Btn variant="ghost" onClick={() => exportPdf(segments).catch(() => toast("PDF export failed", "error"))} aria-label="Export PDF" className="h-8 px-2"><Download className="h-3.5 w-3.5" /><span className="hidden text-xs sm:inline">PDF</span></Btn>
            <Btn variant="ghost" onClick={() => exportSrt(segments)} aria-label="Export SRT" className="h-8 px-2"><Subtitles className="h-3.5 w-3.5" /><span className="hidden text-xs sm:inline">SRT</span></Btn>
          </div>
        )
      }
    >
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcript…"
          className="min-h-10 w-full rounded-lg border border-input bg-surface-alt pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
        {query.trim() && <p className="mt-1 text-xs text-muted-foreground">{matches.size} match{matches.size !== 1 ? "es" : ""}</p>}
      </div>

      {/* Segments list */}
      <div className="max-h-80 space-y-1 overflow-y-auto lg:max-h-[420px]" aria-label="Editable transcript">
        {segments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No transcript yet. Start recording or upload a file.</p>
        ) : (
          segments.map((seg) => {
            const hidden = query.trim() && !matches.has(seg.id);
            if (hidden) return null;
            return (
              <div key={seg.id} className={cn("group flex gap-3 rounded-lg p-2 transition-colors hover:bg-surface-alt/60")}>
                <button
                  onClick={() => seekTo(seg.start)}
                  className="mt-0.5 shrink-0 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary transition-colors hover:bg-primary/20"
                  title={`Jump to ${formatShort(seg.start)}`}
                >
                  {formatShort(seg.start)}
                </button>
                <div className="min-w-0 flex-1">
                  {editing === seg.id ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
                        onBlur={commitEdit}
                        className="min-h-8 flex-1 rounded border border-ring bg-surface-alt px-2 text-sm text-foreground focus:outline-none"
                      />
                    </div>
                  ) : (
                    <p
                      className="cursor-text text-sm leading-relaxed"
                      onDoubleClick={() => startEdit(seg.id, seg.text)}
                      title="Double-click to edit"
                    >
                      {seg.words.length > 0
                        ? seg.words.map((w, i) => (
                            <span key={i} className={cn(w.conf < confThreshold && "low-conf")} title={w.conf < confThreshold ? `Confidence: ${(w.conf * 100).toFixed(0)}%` : undefined}>
                              {w.word}{" "}
                            </span>
                          ))
                        : highlight(seg.text)}
                    </p>
                  )}
                </div>
                <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {(seg.confidence * 100).toFixed(0)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
