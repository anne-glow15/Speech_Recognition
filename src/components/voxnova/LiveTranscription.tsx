import { useEffect, useRef, useState } from "react";
import { ArrowDown, MessageSquareText, Mic } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Card } from "./ui";

export function LiveTranscription() {
  const segments = useStore((s) => s.segments);
  const partial = useStore((s) => s.partial);
  const showPartials = useStore((s) => s.settings.showPartials);
  const status = useStore((s) => s.status);
  const ref = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    if (pinned && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [segments, partial, pinned]);

  const onScroll = () => {
    const el = ref.current;
    if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  const empty = !segments.length && !partial;
  return (
    <Card
      title="LIVE TRANSCRIPTION"
      icon={<MessageSquareText className="h-4 w-4" />}
      className="flex flex-col"
      action={status === "recording" && <span className="font-mono text-xs text-destructive">● LIVE</span>}
    >
      <div className="relative flex-1">
        <div ref={ref} onScroll={onScroll} aria-live="polite" aria-label="Live transcript" className="h-72 overflow-y-auto rounded-xl bg-surface-alt/60 p-4 text-lg leading-relaxed lg:h-[340px]">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-2">
              <div className="relative mb-3 h-24 w-24 overflow-hidden rounded-2xl border border-border/50 shadow-md shadow-primary/5">
                <img
                  src="/mic-illustration.jpg"
                  alt="Speech recognition illustration"
                  className="h-full w-full object-cover transition-transform hover:scale-105 duration-300"
                />
              </div>
              <p className="font-semibold text-foreground">Press record and start speaking</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your speech will appear here with real-time word-level timestamps.</p>
            </div>
          ) : (
            <p>
              {segments.map((s) => <span key={s.id}>{s.text} </span>)}
              {showPartials && partial && <span className="italic text-muted-foreground">{partial}</span>}
            </p>
          )}
        </div>
        {!pinned && (
          <button onClick={() => setPinned(true)} className="absolute bottom-3 left-1/2 flex min-h-9 -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground shadow-primary">
            <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
          </button>
        )}
      </div>
    </Card>
  );
}
