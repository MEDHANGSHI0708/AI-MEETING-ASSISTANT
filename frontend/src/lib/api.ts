const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Language = "english" | "hinglish";

export type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
};

export type ChatSidebarItem = {
  id: string;
  meeting_id: string;
  title: string;
  source: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type ChatDetail = {
  id: string;
  meeting_id: string;
  title: string;
  source: string;
  summary: string;
  action_items: ActionItem[];
  key_decisions: string[];
  open_questions: string[];
  transcript: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ChatHistory = {
  chat: ChatDetail;
  messages: ChatMessage[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // response wasn't JSON — fall through to the status text
  }
  return res.statusText || `Request failed with status ${res.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Couldn't reach the backend. Is the server running?");
  }
  if (!res.ok) throw new ApiError(res.status, await parseErrorDetail(res));
  return (await res.json()) as T;
}

export function listChats(): Promise<ChatSidebarItem[]> {
  return request<ChatSidebarItem[]>("/api/chats");
}

export function getChat(chatId: string): Promise<ChatDetail> {
  return request<ChatDetail>(`/api/chats/${chatId}`);
}

export function getChatHistory(chatId: string): Promise<ChatHistory> {
  return request<ChatHistory>(`/api/chats/${chatId}/history`);
}

export function deleteChat(chatId: string): Promise<{ status: string; message: string }> {
  return request(`/api/chats/${chatId}`, { method: "DELETE" });
}

export type ProgressStage =
  | "download"
  | "convert"
  | "chunk"
  | "transcribe"
  | "insights"
  | "index";

export type MeetingProgress = {
  stage: ProgressStage;
  /** 0-100, or null for stages whose completion cannot be measured. */
  percent: number | null;
  detail: string;
};

export function processMeeting(
  source: string,
  language: Language,
  signal?: AbortSignal,
  jobId?: string
): Promise<ChatDetail> {
  return request<ChatDetail>("/api/meetings/process", {
    method: "POST",
    body: JSON.stringify({ source, language, job_id: jobId }),
    signal,
  });
}

/**
 * Polls the job's progress. Returns null when the backend has nothing to report
 * — before the first stage is recorded, after the job finishes, or if the poll
 * itself fails. A failed poll must never surface as an error, because the real
 * request is still running and carries the actual outcome.
 */
export async function getMeetingProgress(
  jobId: string,
  signal?: AbortSignal
): Promise<MeetingProgress | null> {
  try {
    const res = await fetch(`${API_BASE}/api/meetings/progress/${jobId}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as MeetingProgress;
  } catch {
    return null;
  }
}

export async function uploadMeeting(
  file: File,
  language: Language,
  signal?: AbortSignal,
  jobId?: string
): Promise<ChatDetail> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  if (jobId) form.append("job_id", jobId);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/meetings/upload`, { method: "POST", body: form, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Couldn't reach the backend. Is the server running?");
  }
  if (!res.ok) throw new ApiError(res.status, await parseErrorDetail(res));
  return (await res.json()) as ChatDetail;
}

export function sendMessage(
  chatId: string,
  question: string
): Promise<{ user_message: ChatMessage; assistant_message: ChatMessage; answer: string }> {
  return request(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// The backend streams raw text chunks (not formatted SSE "data:" frames), so a
// plain ReadableStream reader is the correct client — EventSource doesn't apply
// here (it can't POST, and there's no "data:" framing to parse anyway).
export async function* streamMessage(
  chatId: string,
  question: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chats/${chatId}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw new ApiError(0, "Couldn't reach the backend. Is the server running?");
  }
  if (!res.ok) throw new ApiError(res.status, await parseErrorDetail(res));
  if (!res.body) throw new ApiError(res.status, "The server didn't return a stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
