import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ title, icon, action, className, children }: { title?: string; icon?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("card-surface section-in p-5 sm:p-6", className)}>
      {title && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-primary text-primary-foreground shadow-primary hover:brightness-110",
  secondary: "bg-secondary text-secondary-foreground hover:bg-border",
  outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  danger: "bg-destructive/15 text-destructive hover:bg-destructive/25",
};

export function Btn({ variant = "secondary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cn("min-h-11 w-full rounded-lg border border-input bg-surface-alt px-3 text-sm text-foreground transition-colors focus:border-ring", className)}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-sm text-foreground"
    >
      {label}
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-primary" : "bg-border")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all", checked ? "left-5.5" : "left-0.5")} />
      </span>
    </button>
  );
}
