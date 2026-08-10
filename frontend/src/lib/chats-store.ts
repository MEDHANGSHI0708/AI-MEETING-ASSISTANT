"use client";

import { useSyncExternalStore } from "react";
import { listChats, type ChatSidebarItem, ApiError } from "@/lib/api";

type State = {
  chats: ChatSidebarItem[];
  loading: boolean;
  error: string | null;
};

let state: State = { chats: [], loading: true, error: null };
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

let inflight: Promise<void> | null = null;

// Any part of the app (composer, sidebar, detail page) can call this after a
// mutation — create, delete, rename — and every mounted useChats() consumer
// re-renders with fresh data, regardless of which route it's on.
export function refreshChats(): Promise<void> {
  if (inflight) return inflight;
  setState({ loading: state.chats.length === 0, error: null });
  inflight = listChats()
    .then((chats) => setState({ chats, loading: false, error: null }))
    .catch((err) =>
      setState({
        loading: false,
        error: err instanceof ApiError ? err.message : "Couldn't load meetings.",
      })
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useChats() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
