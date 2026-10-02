import { useEffect, useRef, useState } from "react";
import { Activity, Clock, Gauge, ShieldCheck, Type } from "lucide-react";
import { useStore } from "@/store/useStore";
import { avgConfidence, countWords, formatShort, wordsPerMinute } from "@/utils/format";
import { cn } from "@/lib/utils";

function useAnimated(value: number) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 300);
      const cur = a + (value - a) * (1 - (1 - p) ** 3);
      setV(cur);
      from.current = cur;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return v;
}

function Stat({ icon, label, value, suffix, children }: { icon: React.ReactNode; label: string; value: string; suffix?: string; children?: React.ReactNode }) {
  return (
    <div className="card-surface section-in p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="font-mono text-2xl font-semibold tabular-nums">
        {value}<span className="ml-1 text-sm text-muted-foreground">{suffix}</span>
      </div>
      {children}
    </div>
  );
}

export function StatsRow() {
  const segments = useStore((s) => s.segments);
  const elapsed = useStore((s) => s.elapsed);
  const speech = useStore((s) => s.speechFrames);
  const total = useStore((s) => s.totalFrames);
  const lastEnd = segments[segments.length - 1]?.end ?? 0;
  const duration = Math.max(elapsed, lastEnd);
  const words = useAnimated(countWords(segments));
  const wpm = useAnimated(wordsPerMinute(countWords(segments), duration));
  const conf = useAnimated(avgConfidence(segments) * 100);
  const detected = useAnimated(total ? (speech / total) * 100 : 0);
  const tone = conf >= 90 ? "bg-success" : conf >= 75 ? "bg-warning" : "bg-destructive";

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
      <Stat icon={<Type className="h-4 w-4 text-accent" />} label="Words" value={Math.round(words).toString()} />
      <Stat icon={<Gauge className="h-4 w-4 text-accent" />} label="Speech Rate" value={Math.round(wpm).toString()} suffix="WPM" />
      <Stat icon={<ShieldCheck className="h-4 w-4 text-accent" />} label="Confidence" value={conf ? conf.toFixed(1) : "—"} suffix={conf ? "%" : ""}>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-alt">
          <div className={cn("h-full transition-all", tone)} style={{ width: `${conf}%` }} />
        </div>
      </Stat>
      <Stat icon={<Clock className="h-4 w-4 text-accent" />} label="Duration" value={formatShort(duration)} />
      <Stat icon={<Activity className="h-4 w-4 text-accent" />} label="Speech Detected" value={Math.round(detected).toString()} suffix="%" />
    </div>
  );
}
