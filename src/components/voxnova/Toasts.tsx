import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "section-in card-surface flex items-center gap-3 px-4 py-3 text-sm font-medium shadow-lg",
            t.tone === "error" && "border-destructive/30 text-destructive",
            t.tone === "success" && "border-success/30 text-success",
            t.tone === "info" && "text-foreground",
          )}
        >
          <span className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            t.tone === "error" ? "bg-destructive" : t.tone === "success" ? "bg-success" : "bg-accent",
          )} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
