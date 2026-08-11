// src/hooks/useMessages.ts
import { useState, useEffect, useRef } from "react";
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch existing messages between the two users
  useEffect(() => {
    if (!currentUser || !otherUser) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUser.id}),` +
            `and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUser.id})`
        )
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setMessages((data ?? []).map(mapRow));
      }
      setLoading(false);
    };

    fetchMessages();
  }, [currentUser?.id, otherUser?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!currentUser || !otherUser) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`messages:${currentUser.id}:${otherUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const senderId = row.sender_id as string;
          const receiverId = row.receiver_id as string;

          const isRelevant =
            (senderId === currentUser.id && receiverId === otherUser.id) ||
            (senderId === otherUser.id && receiverId === currentUser.id);

          if (isRelevant) {
            const incoming = mapRow(row);
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
        },
        () => {
          // Re-fetch when messages are deleted
          setMessages([]);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser?.id, otherUser?.id]);

  // Send a message
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
    } else if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? mapRow(data) : m))
      );
    }
  };

  // Clear chat history between current user and other user
  const clearHistory = async () => {
    if (!currentUser || !otherUser) return;

    setMessages([]);

    await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUser.id}),` +
          `and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUser.id})`
      );
  };

  return { messages, loading, error, sendMessage, clearHistory };
}
