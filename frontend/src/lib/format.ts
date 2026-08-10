// The backend stores naive UTC timestamps (datetime.utcnow().isoformat(), no
// offset). Parsed as-is, JS treats a timezone-less date-time string as local
// time, which silently shifts every timestamp by the viewer's UTC offset.
// Appending "Z" makes the UTC intent explicit before parsing.
function parseBackendTimestamp(iso: string): Date {
  const hasOffset = /[zZ]|[+-]\d\d:\d\d$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}Z`);
}

export function formatRelativeTime(iso: string): string {
  const date = parseBackendTimestamp(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Fixed locale, not `undefined` — this renders in both a server pass (Node's
// locale) and a client hydration pass (the browser's locale), and those can
// disagree (e.g. "Aug 7, 2026" vs "7 Aug 2026"), which React flags as a
// hydration mismatch. Pinning the locale keeps the two renders identical.
export function formatDate(iso: string): string {
  return parseBackendTimestamp(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type SummaryBlock =
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

// The LLM returns the summary as loose "- bullet" / prose text, not structured
// data — group consecutive "- " lines into one list block and everything else
// into paragraph blocks, so it renders as real <ul>/<p> instead of literal
// dashes in a wall of text.
export function parseSummaryBlocks(summary: string): SummaryBlock[] {
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: SummaryBlock[] = [];

  for (const line of lines) {
    const isBullet = line.startsWith("- ") || line.startsWith("• ");
    const content = isBullet ? line.slice(2).trim() : line;
    const last = blocks.at(-1);

    if (isBullet && last?.type === "list") {
      last.items.push(content);
    } else if (isBullet) {
      blocks.push({ type: "list", items: [content] });
    } else {
      blocks.push({ type: "paragraph", text: content });
    }
  }

  return blocks;
}
