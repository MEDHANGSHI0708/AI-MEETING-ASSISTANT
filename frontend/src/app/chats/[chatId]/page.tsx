import type { Metadata } from "next";
import { ChatDetailView } from "@/components/chat-detail-view";
import { NotFoundPanel } from "@/components/not-found-panel";
import type { ChatHistory } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchHistory(chatId: string): Promise<ChatHistory | "not-found" | "unreachable"> {
  try {
    const res = await fetch(`${API_BASE}/api/chats/${chatId}/history`, { cache: "no-store" });
    if (res.status === 404) return "not-found";
    if (!res.ok) return "unreachable";
    return (await res.json()) as ChatHistory;
  } catch {
    return "unreachable";
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/chats/[chatId]">): Promise<Metadata> {
  const { chatId } = await params;
  const data = await fetchHistory(chatId);
  if (data === "not-found" || data === "unreachable") return { title: "Meeting — Leia" };
  return { title: `${data.chat.title} — Leia` };
}

export default async function ChatPage({ params }: PageProps<"/chats/[chatId]">) {
  const { chatId } = await params;
  const data = await fetchHistory(chatId);

  if (data === "not-found") {
    return (
      <NotFoundPanel
        title="Meeting not found"
        message="This meeting may have been deleted, or the link is wrong."
      />
    );
  }

  if (data === "unreachable") {
    return (
      <NotFoundPanel
        title="Can't reach the backend"
        message="The FastAPI server isn't responding. Make sure it's running, then reload."
      />
    );
  }

  return <ChatDetailView chatId={chatId} initialChat={data.chat} initialMessages={data.messages} />;
}
