"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { getMeetingProgress, type MeetingProgress, type ProgressStage } from "@/lib/api";

const POLL_INTERVAL_MS = 500;
const LONG_RUN_HINT_MS = 20000;

const STAGE_LABEL: Record<ProgressStage, string> = {
  download: "Downloading the recording",
  convert: "Converting audio",
  chunk: "Splitting into parts",
  transcribe: "Transcribing",
  insights: "Summarizing",
  index: "Indexing for questions",
};

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ProcessingPanel({
  source,
  jobId,
  phase = "running",
  onCancel,
}: {
  source: string;
  jobId?: string;
  phase?: "running" | "done";
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<MeetingProgress | null>(null);

  useEffect(() => {
    if (phase === "done") return;
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!jobId || phase === "done") return;
    const controller = new AbortController();
    let stopped = false;

    async function poll() {
      while (!stopped) {
        const next = await getMeetingProgress(jobId!, controller.signal);
        if (stopped) return;
        // A null poll means "nothing new" (job not started, or already gone), so
        // keep showing the last known stage rather than flashing back to empty.
        if (next) setProgress(next);
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
    poll();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [jobId, phase]);

  const done = phase === "done";
  const percent = done ? 100 : progress?.percent ?? null;
  const determinate = percent !== null;

  const heading = done
    ? "Done."
    : progress
      ? STAGE_LABEL[progress.stage]
      : "Processing your meeting…";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          {determinate ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={heading}
            />
          ) : (
            <div className="progress-indeterminate h-full w-1/3 rounded-full bg-primary" />
          )}
        </div>

        <p aria-live="polite" className="mt-5 flex items-baseline justify-center gap-2 text-sm text-foreground">
          <span>{heading}</span>
          {determinate && !done && (
            <span className="tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
          )}
        </p>

        {progress?.detail && !done && (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">{progress.detail}</p>
        )}

        <p className="mt-1.5 truncate text-xs text-muted-foreground" title={source}>
          {source}
        </p>

        {!done && (
          <>
            <p className="mt-4 text-xs tabular-nums text-muted-foreground">
              {formatElapsed(elapsed)} elapsed
            </p>
            {elapsed * 1000 >= LONG_RUN_HINT_MS && !progress && (
              <p className="mt-1 text-xs text-muted-foreground">
                Long recordings can take several minutes.
              </p>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
