// src/hooks/useMessages.ts
import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { supabase } from "../services/supabase";
import { subscribeToFeed } from "../services/messageFeed";
import { MESSAGE_COLUMNS, mapMessage } from "../services/mappers";
import type { Message } from "../types/message";
import type { Profile } from "../types/profile";

// Load only the most recent messages; older history can be paged in later.
const INITIAL_PAGE_SIZE = 100;
const OPTIMISTIC_PREFIX = "optimistic-";

// ---------------------------------------------------------------------------
// Thread store: messages per conversation, shared across mounts so switching
// back to a conversation renders instantly while it revalidates in the
// background. Realtime events are applied to every cached thread, not just
// the open one, so cached threads stay current.
// ---------------------------------------------------------------------------

const threads = new Map<string, Message[]>();
const threadListeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();

const threadKey = (me: string, peer: string) => `${me}:${peer}`;

function getThread(key: string | null) {
  return key ? threads.get(key) : undefined;
}

function setThread(key: string, messages: Message[]) {
  threads.set(key, messages);
  threadListeners.get(key)?.forEach((notify) => notify());
}

function updateThread(key: string, fn: (prev: Message[]) => Message[]) {
  const prev = threads.get(key) ?? [];
  const next = fn(prev);
  if (next !== prev) setThread(key, next);
}

function subscribeThread(key: string | null, notify: () => void) {
  if (!key) return () => {};
  let set = threadListeners.get(key);
  if (!set) threadListeners.set(key, (set = new Set()));
  set.add(notify);
  return () => set.delete(notify);
}

const time = (m: Message) => Date.parse(m.createdAt);

/** Insert keeping chronological order; the common case is a plain append. */
function insertSorted(list: Message[], message: Message): Message[] {
  const last = list[list.length - 1];
  if (!last || time(message) >= time(last)) return [...list, message];
  return [...list, message].sort((a, b) => time(a) - time(b));
}

/** Apply a confirmed server row, replacing its optimistic placeholder if any. */
function applyServerMessage(list: Message[], message: Message, optimisticId?: string) {
  if (list.some((m) => m.id === message.id)) {
    // Already present (realtime beat the insert response, or vice versa).
    return optimisticId ? list.filter((m) => m.id !== optimisticId) : list;
  }
  const placeholder = optimisticId
    ? list.findIndex((m) => m.id === optimisticId)
    : list.findIndex(
        (m) =>
          m.id.startsWith(OPTIMISTIC_PREFIX) &&
          m.senderId === message.senderId &&
          m.message === message.message,
      );
  if (placeholder === -1) return insertSorted(list, message);
  const next = [...list];
  next[placeholder] = message;
  return next;
}

function fetchThread(me: string, peer: string): Promise<void> {
  const key = threadKey(me, peer);
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${peer}),` +
          `and(sender_id.eq.${peer},receiver_id.eq.${me})`,
      )
      .order("created_at", { ascending: false })
      .limit(INITIAL_PAGE_SIZE);

    if (error) throw new Error(error.message);

    const fetched = (data ?? []).map(mapMessage).reverse();
    // Keep any sends that are still in flight.
    const pending = (threads.get(key) ?? []).filter((m) =>
      m.id.startsWith(OPTIMISTIC_PREFIX),
    );
    setThread(key, pending.reduce(insertSorted, fetched));
  })().finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

/** Warm the cache for a conversation (e.g. on hover) before it's opened. */
export function prefetchThread(me: string | null, peer: string) {
  if (!me || threads.has(threadKey(me, peer))) return;
  fetchThread(me, peer).catch(() => {
    // Ignore — the real open will retry and surface the error.
  });
}

// ---------------------------------------------------------------------------

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const EMPTY: Message[] = [];

export function useMessages(
  currentUserId: string | null,
  otherUser: Profile | null
): UseMessagesReturn {
  const otherId = otherUser?.id ?? null;
  const key = currentUserId && otherId ? threadKey(currentUserId, otherId) : null;

  const cached = useSyncExternalStore(
    useCallback((notify: () => void) => subscribeThread(key, notify), [key]),
    () => getThread(key),
  );

  const [error, setError] = useState<{ key: string | null; message: string } | null>(null);
  const [resyncNonce, setResyncNonce] = useState(0);

  // Revalidate whenever a conversation is opened (cached data shows meanwhile).
  useEffect(() => {
    if (!currentUserId || !otherId) return;
    const k = threadKey(currentUserId, otherId);
    fetchThread(currentUserId, otherId).then(
      () => setError((prev) => (prev?.key === k ? null : prev)),
      (e: Error) => setError({ key: k, message: e.message }),
    );
  }, [currentUserId, otherId, resyncNonce]);

  // Apply realtime events to every cached thread.
  useEffect(() => {
    if (!currentUserId) return;

    return subscribeToFeed(currentUserId, (event) => {
      if (event.type === "insert") {
        const { message } = event;
        const peer =
          message.senderId === currentUserId ? message.receiverId : message.senderId;
        const k = threadKey(currentUserId, peer);
        if (threads.has(k)) updateThread(k, (prev) => applyServerMessage(prev, message));
      } else if (event.type === "delete") {
        if (!event.id) {
          setResyncNonce((n) => n + 1);
          return;
        }
        const id = event.id;
        for (const k of threads.keys()) {
          updateThread(k, (prev) =>
            prev.some((m) => m.id === id) ? prev.filter((m) => m.id !== id) : prev,
          );
        }
      }
    });
  }, [currentUserId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!currentUserId || !otherId) return;
      const k = threadKey(currentUserId, otherId);

      const optimisticId = `${OPTIMISTIC_PREFIX}${Date.now()}-${Math.random()}`;
      updateThread(k, (prev) =>
        insertSorted(prev, {
          id: optimisticId,
          senderId: currentUserId,
          receiverId: otherId,
          message: text,
          createdAt: new Date().toISOString(),
        }),
      );

      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          sender_id: currentUserId,
          receiver_id: otherId,
          message: text,
        })
        // Only echo back what's needed — not the (possibly huge) message body.
        .select("id, sender_id, receiver_id, created_at")
        .single();

      if (insertError) {
        updateThread(k, (prev) => prev.filter((m) => m.id !== optimisticId));
        setError({ key: k, message: insertError.message });
        throw new Error(insertError.message);
      }

      if (data) {
        const confirmed = mapMessage({ ...data, message: text });
        updateThread(k, (prev) => applyServerMessage(prev, confirmed, optimisticId));
      }
    },
    [currentUserId, otherId],
  );

  const clearHistory = useCallback(async () => {
    if (!currentUserId || !otherId) return;
    const k = threadKey(currentUserId, otherId);

    const snapshot = threads.get(k) ?? [];
    setThread(k, []);
    setError(null);

    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherId}),` +
          `and(sender_id.eq.${otherId},receiver_id.eq.${currentUserId})`,
      );

    if (deleteError) {
      setThread(k, snapshot);
      setError({ key: k, message: deleteError.message });
    }
  }, [currentUserId, otherId]);

  const errorMessage = error && error.key === key ? error.message : null;

  return {
    messages: cached ?? EMPTY,
    loading: key !== null && cached === undefined && !errorMessage,
    error: errorMessage,
    sendMessage,
    clearHistory,
  };
}
