import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <ellipse
          cx="9"
          cy="9"
          rx="8"
          ry="3.4"
          transform="rotate(-28 9 9)"
          stroke="var(--primary)"
          strokeWidth="1.1"
          opacity="0.55"
        />
        <circle cx="9" cy="9" r="1.6" fill="var(--primary)" />
      </svg>
      <span className="text-sm font-medium tracking-tight text-foreground">
        Leia
      </span>
    </div>
  );
}
