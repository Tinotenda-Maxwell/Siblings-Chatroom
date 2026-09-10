// src/hooks/useConversations.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import type { Profile } from "../types/profile";
import type { Message } from "../types/message";

export interface ConversationItem {
  profile: Profile;
  lastMessage?: Message;
}

export function useConversations(currentUser: Profile | null) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchConversations = async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      }

      // 1. Fetch accepted friendship partner IDs
      const { data: friendships } = await supabase
        .from("friendships")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      const friendIds = new Set<string>();
      if (friendships) {
        friendships.forEach((f) => {
          if (f.sender_id !== currentUser.id) friendIds.add(f.sender_id);
          if (f.receiver_id !== currentUser.id) friendIds.add(f.receiver_id);
        });
      }

      // 2. Fetch profiles of friends (or all profiles if no friendships table exist yet for backward compatibility)
      let query = supabase.from("profiles").select("*").neq("id", currentUser.id);

      if (friendIds.size > 0) {
        query = query.in("id", Array.from(friendIds));
      }

      const { data: profilesData, error: profilesError } = await query;

      if (profilesError || !profilesData) {
        if (isInitial) setLoading(false);
        return;
      }

      const profiles: Profile[] = profilesData.map((row) => ({
        id: row.id as string,
        username: row.username as string,
        displayName: row.display_name as string,
        avatarUrl: row.avatar_url as string | null,
        createdAt: row.created_at as string,
      }));

      // 3. Fetch last message for each profile
      const items: ConversationItem[] = await Promise.all(
        profiles.map(async (profile) => {
          const { data: msgData } = await supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${currentUser.id},receiver_id.eq.${profile.id}),` +
                `and(sender_id.eq.${profile.id},receiver_id.eq.${currentUser.id})`
            )
            .order("created_at", { ascending: false })
            .limit(1);

          const lastMsg: Message | undefined =
            msgData && msgData.length > 0
              ? {
                  id: msgData[0].id as string,
                  senderId: msgData[0].sender_id as string,
                  receiverId: msgData[0].receiver_id as string,
                  message: msgData[0].message as string,
                  createdAt: msgData[0].created_at as string,
                }
              : undefined;

          return { profile, lastMessage: lastMsg };
        })
      );

      setConversations(items);
      if (isInitial) {
        setLoading(false);
      }
    };

    fetchConversations(true);

    // Coalesce bursts of realtime events into a single refetch — every message
    // insert would otherwise trigger a full list rebuild plus an N+1 query.
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchConversations(false), 400);
    };

    // Realtime subscriptions for messages and friendships
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
      clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  return { conversations, loading };
}
