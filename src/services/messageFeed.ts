// src/services/messageFeed.ts
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { mapMessage } from "./mappers";
import type { Message } from "../types/message";

export type FeedEvent =
  | { type: "insert"; message: Message }
  | { type: "delete"; id?: string }
  | { type: "friendship" };

type Listener = (event: FeedEvent) => void;

// One realtime channel per signed-in user, shared by every hook. Opening a
// channel costs a websocket round trip, and per-conversation channels drop
// events while they're being re-established, so keep a single long-lived one.
let channel: RealtimeChannel | null = null;
let channelUserId: string | null = null;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let topicSeq = 0;
const listeners = new Set<Listener>();

function emit(event: FeedEvent) {
  listeners.forEach((listener) => listener(event));
}

function open(userId: string) {
  const onInsert = (payload: { new: Record<string, unknown> }) =>
    emit({ type: "insert", message: mapMessage(payload.new) });

  channelUserId = userId;
  channel = supabase
    // Unique topic so a channel that's still leaving is never reused.
    .channel(`feed:${userId}:${++topicSeq}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
      onInsert,
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` },
      onInsert,
    )
    // DELETE payloads only carry the primary key, so they can't be filtered
    // server-side by sender/receiver.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) =>
      emit({ type: "delete", id: (payload.old as Record<string, unknown>)?.id as string | undefined }),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friendships", filter: `receiver_id=eq.${userId}` },
      () => emit({ type: "friendship" }),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friendships", filter: `sender_id=eq.${userId}` },
      () => emit({ type: "friendship" }),
    )
    .subscribe();
}

function close() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  channelUserId = null;
}

export function subscribeToFeed(userId: string, listener: Listener): () => void {
  clearTimeout(closeTimer);
  if (channelUserId !== userId) {
    close();
    open(userId);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    // Defer teardown so a quick remount (StrictMode, route change) reuses
    // the live channel instead of reconnecting.
    if (listeners.size === 0) closeTimer = setTimeout(close, 2000);
  };
}
