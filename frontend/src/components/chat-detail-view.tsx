"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  CheckListIcon,
  LinkSquare01Icon,
  File01Icon,
} from "@hugeicons/core-free-icons";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat-composer";
import { Markdown } from "@/components/markdown";
import { Wordmark } from "@/components/wordmark";
import { deleteChat, streamMessage, ApiError, type ChatDetail, type ChatMessage } from "@/lib/api";
import { refreshChats } from "@/lib/chats-store";
import { formatDate, parseSummaryBlocks } from "@/lib/format";
import { cn } from "@/lib/utils";

const DELETE_ARM_TIMEOUT_MS = 4000;

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-foreground marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function SourceLabel({ source }: { source: string }) {
  const isUrl = /^https?:\/\//.test(source);
  const label = isUrl ? source.replace(/^https?:\/\//, "") : source.split("/").pop() ?? source;
  return (
    <span className="inline-flex min-w-0 max-w-[28ch] items-center gap-1 align-middle">
      <HugeiconsIcon
        icon={isUrl ? LinkSquare01Icon : File01Icon}
        size={12}
        strokeWidth={2}
        className="shrink-0"
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

function MessageRow({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isAssistant = role === "assistant";
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "text-[11px] font-medium tracking-wide",
          isAssistant ? "text-primary" : "text-muted-foreground"
        )}
      >
        {isAssistant ? "LEIA" : "YOU"}
      </span>
      {isAssistant ? (
        content.length === 0 ? (
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none" />
        ) : (
          <Markdown content={content} />
        )
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{content}</p>
      )}
    </div>
  );
}

export function ChatDetailView({
  chatId,
  initialChat,
  initialMessages,
}: {
  chatId: string;
  initialChat: ChatDetail;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [chat] = useState(initialChat);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const composerRef = useRef<ChatComposerHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextLocalId = useRef(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    return () => {
      if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
    };
  }, []);

  async function handleSend(question: string) {
    setSendError(null);
    setMessages((prev) => [
      ...prev,
      { id: nextLocalId.current--, role: "user", content: question, created_at: new Date().toISOString() },
    ]);
    setStreamingText("");
    try {
      let full = "";
      for await (const chunk of streamMessage(chatId, question)) {
        full += chunk;
        setStreamingText(full);
      }
      setMessages((prev) => [
        ...prev,
        { id: nextLocalId.current--, role: "assistant", content: full, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Couldn't get a response. Try again.");
    } finally {
      setStreamingText(null);
    }
  }

  async function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      armTimeoutRef.current = setTimeout(() => setDeleteArmed(false), DELETE_ARM_TIMEOUT_MS);
      return;
    }
    if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
    setDeleting(true);
    try {
      await deleteChat(chatId);
      await refreshChats();
      router.push("/");
    } catch {
      setDeleting(false);
      setDeleteArmed(false);
    }
  }

  const summaryBlocks = parseSummaryBlocks(chat.summary);
  const hasMessages = messages.length > 0 || streamingText !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-10 md:px-12">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="text-2xl leading-tight font-medium tracking-tight text-foreground"
                style={{ textWrap: "balance" }}
              >
                {chat.title}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>{formatDate(chat.created_at)}</span>
                <span aria-hidden="true">·</span>
                <SourceLabel source={chat.source} />
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
                deleteArmed
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:border-input hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={2} />
              {deleteArmed ? "Confirm delete" : "Delete"}
            </button>
          </div>

          <Section label="SUMMARY">
            <div className="flex flex-col gap-2.5">
              {summaryBlocks.map((block, i) =>
                block.type === "list" ? (
                  <BulletList key={i} items={block.items} />
                ) : (
                  <p key={i} className="text-sm leading-relaxed text-foreground">
                    {block.text}
                  </p>
                )
              )}
            </div>
          </Section>

          {chat.action_items.length > 0 && (
            <Section label="ACTION ITEMS">
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {chat.action_items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-card px-4 py-3">
                    <HugeiconsIcon
                      icon={CheckListIcon}
                      size={15}
                      strokeWidth={1.8}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{item.task}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.owner} · {item.deadline}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {chat.key_decisions.length > 0 && (
            <Section label="KEY DECISIONS">
              <BulletList items={chat.key_decisions} />
            </Section>
          )}

          {chat.open_questions.length > 0 && (
            <Section label="OPEN QUESTIONS">
              <BulletList items={chat.open_questions} />
            </Section>
          )}

          <div className="mt-12">
            <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground">
              ASK LEIA
            </span>
            <div className="mt-3 flex flex-col gap-5">
              {!hasMessages && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wordmark className="opacity-70" />
                  <span>Ask anything about this meeting — I have the full transcript.</span>
                </div>
              )}
              {messages.map((m) => (
                <MessageRow key={m.id} role={m.role} content={m.content} />
              ))}
              {streamingText !== null && <MessageRow role="assistant" content={streamingText} />}
              {/* A trailing user message with no reply means a previous send failed
                  after the question was already saved — surface that on reload
                  instead of leaving it looking silently ignored. */}
              {streamingText === null &&
                sendError === null &&
                messages.length > 0 &&
                messages.at(-1)?.role === "user" && (
                  <p className="text-xs text-muted-foreground">
                    This didn&apos;t get a response — try asking again.
                  </p>
                )}
            </div>
            {sendError && (
              <p role="alert" className="mt-3 text-xs text-destructive">
                {sendError}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 md:px-12">
        <div className="mx-auto w-full max-w-3xl">
          <ChatComposer ref={composerRef} onSubmit={handleSend} disabled={streamingText !== null} />
        </div>
      </div>
    </div>
  );
}
