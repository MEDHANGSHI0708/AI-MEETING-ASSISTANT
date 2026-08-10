"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { SuggestedActions, type SuggestedActionId } from "@/components/suggested-actions";
import { MeetingInputBar, type MeetingInputBarHandle } from "@/components/meeting-input-bar";
import { ProcessingPanel } from "@/components/processing-panel";
import { processMeeting, uploadMeeting, ApiError, type Language } from "@/lib/api";
import { refreshChats, useChats } from "@/lib/chats-store";

type Status =
  | { state: "idle" }
  | { state: "processing"; source: string; jobId: string; done?: boolean }
  | { state: "error"; message: string };

// Long enough for the bar to visibly reach full before the route changes.
const COMPLETION_DWELL_MS = 520;

export function HomeContent() {
  const router = useRouter();
  const composerRef = useRef<MeetingInputBarHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const { chats } = useChats();

  async function runProcess(kind: "url" | "file", payload: string | File, language: Language) {
    const sourceLabel = kind === "url" ? (payload as string) : (payload as File).name;
    const controller = new AbortController();
    abortRef.current = controller;
    // The client picks the id so it can poll progress from the moment the
    // request leaves, without waiting for the server to hand one back.
    const jobId = crypto.randomUUID();
    setStatus({ state: "processing", source: sourceLabel, jobId });
    try {
      const chat =
        kind === "url"
          ? await processMeeting(payload as string, language, controller.signal, jobId)
          : await uploadMeeting(payload as File, language, controller.signal, jobId);
      setStatus({ state: "processing", source: sourceLabel, jobId, done: true });
      await Promise.all([
        refreshChats(),
        new Promise((resolve) => setTimeout(resolve, COMPLETION_DWELL_MS)),
      ]);
      router.push(`/chats/${chat.id}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus({
        state: "error",
        message: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setStatus({ state: "idle" });
  }

  function handleComposerSubmit(value: string, language: Language) {
    runProcess("url", value, language);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow selecting the same file again later
    if (file) runProcess("file", file, "english");
  }

  function handleSuggestedAction(id: SuggestedActionId) {
    if (id === "paste-link") {
      composerRef.current?.focus();
      return;
    }
    if (id === "upload") {
      fileInputRef.current?.click();
      return;
    }
    // "ask-past" and "action-items" both point at an existing meeting — there's
    // no cross-meeting aggregate view yet, so the most recent one is the honest
    // destination for either.
    if (chats.length > 0) {
      router.push(`/chats/${chats[0].id}`);
    } else {
      composerRef.current?.focus();
    }
  }

  if (status.state === "processing") {
    return (
      <ProcessingPanel
        source={status.source}
        jobId={status.jobId}
        phase={status.done ? "done" : "running"}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-6 py-10 md:px-12">
        <div className="mx-auto w-full max-w-xl">
          <h1
            className="text-[34px] leading-[1.15] font-medium tracking-tight text-foreground"
            style={{ textWrap: "balance" }}
          >
            Hello.
          </h1>
          <h2 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-tight text-muted-foreground">
            What are we working on today?
          </h2>

          {status.state === "error" && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{status.message}</span>
            </div>
          )}

          <div className="mt-10">
            <SuggestedActions onAction={handleSuggestedAction} />
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 md:px-12">
        <div className="mx-auto w-full max-w-3xl">
          <MeetingInputBar
            ref={composerRef}
            onSubmit={handleComposerSubmit}
            onAttachClick={() => fileInputRef.current?.click()}
          />
        </div>
      </div>
    </div>
  );
}
