// src/hooks/useConversations.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import type { Profile } from "../types/profile";
import type { Message } from "../types/message";

export interface ConversationItem {
  profile: Profile;
  lastMessage?: Message;
}

const PROFILE_COLUMNS = "id, username, display_name, avatar_url, created_at";
const MESSAGE_COLUMNS = "id, sender_id, receiver_id, message, created_at";

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

      // Only the newest message per friend is needed for the sidebar preview.
      // Fetching whole histories (which may contain base64 images) is far
      // slower, so run one tiny limit(1) query per friend in parallel.
      const [profilesResult, latestRows] = await Promise.all([
        supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .neq("id", currentUser.id)
          .in("id", friendIdList),
        Promise.all(
          friendIdList.map((friendId) =>
            supabase
              .from("messages")
              .select(MESSAGE_COLUMNS)
              .or(
                `and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),` +
                  `and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`
              )
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          )
        ),
      ]);

      if (!active) return;

      if (profilesResult.error || !profilesResult.data) {
        if (isInitial) setLoading(false);
        return;
      }

      const profiles = profilesResult.data.map(mapProfile);
      const latestMessagesByPeer = new Map<string, Message>();

      latestRows.forEach(({ data }, i) => {
        if (data) latestMessagesByPeer.set(friendIdList[i], mapMessage(data));
      });

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
