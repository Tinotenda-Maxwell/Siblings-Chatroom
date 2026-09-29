// src/hooks/useConversations.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import type { Profile } from "../types/profile";
import type { Message } from "../types/message";

export interface ConversationItem {
  profile: Profile;
  lastMessage?: Message;
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    receiverId: row.receiver_id as string,
    message: row.message as string,
    createdAt: row.created_at as string,
  };
}

export function useConversations(currentUser: Profile | null) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let active = true;

    const fetchConversations = async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      }

      const { data: friendships } = await supabase
        .from("friendships")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (!active) return;

      const friendIds = new Set<string>();
      if (friendships) {
        friendships.forEach((friendship) => {
          if (friendship.sender_id !== currentUser.id) {
            friendIds.add(friendship.sender_id);
          }
          if (friendship.receiver_id !== currentUser.id) {
            friendIds.add(friendship.receiver_id);
          }
        });
      }

      if (friendIds.size === 0) {
        setConversations([]);
        if (isInitial) setLoading(false);
        return;
      }

      const friendIdList = Array.from(friendIds);

      const [profilesResult, messagesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .neq("id", currentUser.id)
          .in("id", friendIdList),
        supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${currentUser.id},receiver_id.in.(${friendIdList.join(",")})),` +
              `and(sender_id.in.(${friendIdList.join(",")}),receiver_id.eq.${currentUser.id})`
          )
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      if (profilesResult.error || !profilesResult.data) {
        if (isInitial) setLoading(false);
        return;
      }

      const profiles = profilesResult.data.map(mapProfile);
      const latestMessagesByPeer = new Map<string, Message>();

      for (const row of messagesResult.data ?? []) {
        const message = mapMessage(row);
        const peerId =
          message.senderId === currentUser.id
            ? message.receiverId
            : message.senderId;
        const currentLatest = latestMessagesByPeer.get(peerId);

        if (
          !currentLatest ||
          new Date(message.createdAt).getTime() >
            new Date(currentLatest.createdAt).getTime()
        ) {
          latestMessagesByPeer.set(peerId, message);
        }
      }

      const items = profiles
        .map((profile) => ({
          profile,
          lastMessage: latestMessagesByPeer.get(profile.id),
        }))
        .sort((a, b) => {
          const aTime = a.lastMessage
            ? new Date(a.lastMessage.createdAt).getTime()
            : 0;
          const bTime = b.lastMessage
            ? new Date(b.lastMessage.createdAt).getTime()
            : 0;
          return bTime - aTime;
        });

      setConversations(items);
      if (isInitial) {
        setLoading(false);
      }
    };

    fetchConversations(true);

    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchConversations(false), 400);
    };

    const channel = supabase
      .channel("public:conversations:updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      active = false;
      clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  return { conversations, loading };
}
