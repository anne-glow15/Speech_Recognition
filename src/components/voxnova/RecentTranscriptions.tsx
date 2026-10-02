import { useMemo, useState } from "react";
import { Clock, Download, ExternalLink, History, Search, Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatShort, avgConfidence, countWords } from "@/utils/format";
import { exportTxt } from "@/services/exporters";
import { deleteAudio, loadHistory, saveHistory } from "@/services/storage";
import { Card, Btn } from "./ui";
import { cn } from "@/lib/utils";
import type { HistoryItem } from "@/types";

export function RecentTranscriptions() {
  const history = useStore((s) => s.history);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return history;
    const q = query.toLowerCase();
    return history.filter((h) => h.title.toLowerCase().includes(q) || h.language.toLowerCase().includes(q));
  }, [history, query]);

  const remove = (item: HistoryItem) => {
    const next = history.filter((h) => h.id !== item.id);
    set({ history: next });
    saveHistory(next);
    if (item.audio_blob_key) void deleteAudio(item.audio_blob_key);
    toast("Deleted", "info");
  };

  const load = (item: HistoryItem) => {
    const st = useStore.getState();
    st.clearTranscript();
    st.set({ segments: item.segments, elapsed: item.duration });
    toast(`Loaded "${item.title}"`, "success");
  };

  return (
    <Card title="RECENT TRANSCRIPTIONS" icon={<History className="h-4 w-4" />}>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history…"
          className="min-h-10 w-full rounded-lg border border-input bg-surface-alt pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium tracking-wider text-muted-foreground">
              <th className="pb-2 pr-3">Title</th>
              <th className="hidden pb-2 pr-3 sm:table-cell">Language</th>
              <th className="pb-2 pr-3 text-right">Duration</th>
              <th className="hidden pb-2 pr-3 text-right md:table-cell">Words</th>
              <th className="pb-2 pr-3 text-right">Confidence</th>
              <th className="pb-2 pr-3 text-right">Date</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No transcriptions found.</td></tr>
            )}
            {filtered.map((item) => {
              const conf = item.confidence || avgConfidence(item.segments);
              const words = countWords(item.segments);
              const date = new Date(item.created_at);
              return (
                <tr key={item.id} className="group border-b border-border/50 transition-colors hover:bg-surface-alt/40">
                  <td className="py-3 pr-3 font-medium">{item.title}</td>
                  <td className="hidden py-3 pr-3 text-muted-foreground sm:table-cell">{item.language}</td>
                  <td className="py-3 pr-3 text-right font-mono text-muted-foreground">{formatShort(item.duration)}</td>
                  <td className="hidden py-3 pr-3 text-right font-mono text-muted-foreground md:table-cell">{words}</td>
                  <td className="py-3 pr-3 text-right">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                      conf >= 0.9 ? "bg-success/15 text-success" : conf >= 0.75 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                    )}>
                      {(conf * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Btn variant="ghost" onClick={() => load(item)} className="h-7 px-1.5" aria-label="Load"><ExternalLink className="h-3.5 w-3.5" /></Btn>
                      <Btn variant="ghost" onClick={() => exportTxt(item.segments, item.title)} className="h-7 px-1.5" aria-label="Export"><Download className="h-3.5 w-3.5" /></Btn>
                      <Btn variant="danger" onClick={() => remove(item)} className="h-7 px-1.5" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
