// src/hooks/useMessages.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import type { Message } from "../types/message";
import type { Profile } from "../types/profile";

function mapRow(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    receiverId: row.receiver_id as string,
    message: row.message as string,
    createdAt: row.created_at as string,
  };
}

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useMessages(
  currentUser: Profile | null,
  otherUser: Profile | null
): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped to force a re-sync with the server (e.g. after a delete we can't
  // reconcile locally).
  const [resyncNonce, setResyncNonce] = useState(0);

  const pairFilter =
    currentUser && otherUser
      ? `and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUser.id}),` +
        `and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUser.id})`
      : null;

  // Load the full conversation from the server.
  useEffect(() => {
    if (!currentUser || !otherUser || !pairFilter) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .or(pairFilter)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setMessages((data ?? []).map(mapRow));
      }
      setLoading(false);
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, otherUser?.id, pairFilter, resyncNonce]);

  // Real-time subscription, scoped to rows that involve the current user so
  // clients don't receive the whole table.
  useEffect(() => {
    if (!currentUser || !otherUser) return;

    const belongsToThread = (row: Record<string, unknown>) => {
      const senderId = row.sender_id as string;
      const receiverId = row.receiver_id as string;
      return (
        (senderId === currentUser.id && receiverId === otherUser.id) ||
        (senderId === otherUser.id && receiverId === currentUser.id)
      );
    };

    const applyInsert = (payload: { new: Record<string, unknown> }) => {
      const row = payload.new;
      if (!belongsToThread(row)) return;
      const incoming = mapRow(row);
      setMessages((prev) =>
        prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
      );
    };

    const channel = supabase
      .channel(`messages:${currentUser.id}:${otherUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        applyInsert
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${currentUser.id}`,
        },
        applyInsert
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const deletedId = (payload.old as Record<string, unknown>)?.id as
            | string
            | undefined;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          } else {
            // Replica identity doesn't expose the id — re-sync from the server
            // instead of blanking the conversation.
            setResyncNonce((n) => n + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, otherUser?.id]);

  // Send a message with an optimistic bubble.
  const sendMessage = async (text: string) => {
    if (!currentUser || !otherUser) return;

    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      senderId: currentUser.id,
      receiverId: otherUser.id,
      message: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUser.id,
        receiver_id: otherUser.id,
        message: text,
      })
      .select()
      .single();

    if (insertError) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(insertError.message);
      throw new Error(insertError.message);
    }

    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? mapRow(data) : m))
      );
    }
  };

  // Clear chat history between the current user and the other user.
  const clearHistory = async () => {
    if (!currentUser || !otherUser || !pairFilter) return;

    const snapshot = messages;
    setMessages([]);
    setError(null);

    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .or(pairFilter);

    if (deleteError) {
      setMessages(snapshot);
      setError(deleteError.message);
    }
  };

  return { messages, loading, error, sendMessage, clearHistory };
}
