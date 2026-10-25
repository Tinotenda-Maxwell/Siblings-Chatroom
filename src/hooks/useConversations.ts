// src/hooks/useConversations.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { subscribeToFeed } from "../services/messageFeed";
import {
  MESSAGE_COLUMNS,
  PROFILE_COLUMNS,
  mapMessage,
  mapProfile,
  previewText,
  readCache,
  writeCache,
} from "../services/mappers";
import type { Profile } from "../types/profile";
import type { Message } from "../types/message";

export interface ConversationItem {
  profile: Profile;
  /** Latest message, with `message` reduced to a short preview string. */
  lastMessage?: Message;
}

const cacheKey = (userId: string) => `sibling-chat:conversations:${userId}`;

const lastTime = (item: ConversationItem) =>
  item.lastMessage ? Date.parse(item.lastMessage.createdAt) : 0;

const byRecent = (a: ConversationItem, b: ConversationItem) => lastTime(b) - lastTime(a);

const toPreview = (message: Message): Message => ({
  ...message,
  message: previewText(message.message),
});

/** Friends' profiles. Embeds them in the friendships query to save a round trip. */
async function fetchFriendProfiles(userId: string): Promise<Profile[] | null> {
  const embedded = await supabase
    .from("friendships")
    .select(
      `sender_id, receiver_id,
       sender:profiles!friendships_sender_id_fkey(${PROFILE_COLUMNS}),
       receiver:profiles!friendships_receiver_id_fkey(${PROFILE_COLUMNS})`,
    )
    .eq("status", "accepted")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (!embedded.error) {
    const byId = new Map<string, Profile>();
    for (const row of embedded.data ?? []) {
      const friend = (row.sender_id === userId ? row.receiver : row.sender) as unknown;
      // A to-one embed can come back as an object or a single-element array.
      const friendRow = (Array.isArray(friend) ? friend[0] : friend) as
        | Record<string, unknown>
        | null;
      if (friendRow && friendRow.id !== userId) {
        byId.set(friendRow.id as string, mapProfile(friendRow));
      }
    }
    return Array.from(byId.values());
  }

  // Fallback if the foreign-key names differ: two sequential queries.
  const { data: friendships, error } = await supabase
    .from("friendships")
    .select("sender_id, receiver_id")
    .eq("status", "accepted")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
  if (error) return null;

  const friendIds = new Set<string>();
  for (const f of friendships ?? []) {
    friendIds.add(f.sender_id === userId ? f.receiver_id : f.sender_id);
  }
  friendIds.delete(userId);
  if (friendIds.size === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", Array.from(friendIds));
  return profilesError ? null : (profiles ?? []).map(mapProfile);
}

export function useConversations(currentUserId: string | null) {
  // Render the last known list immediately, then revalidate.
  const [conversations, setConversations] = useState<ConversationItem[]>(
    () => (currentUserId && readCache<ConversationItem[]>(cacheKey(currentUserId))) || [],
  );
  const [loading, setLoading] = useState(conversations.length === 0);

  useEffect(() => {
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let active = true;
    let current: ConversationItem[] =
      readCache<ConversationItem[]>(cacheKey(currentUserId)) ?? [];

    const commit = (items: ConversationItem[]) => {
      current = items;
      setConversations(items);
      writeCache(cacheKey(currentUserId), items);
    };

    const fetchConversations = async () => {
      const profiles = await fetchFriendProfiles(currentUserId);
      if (!active) return;
      if (!profiles) {
        setLoading(false);
        return;
      }

      // Only the newest message per friend is needed for the sidebar
      // preview, so run one tiny limit(1) query per friend in parallel.
      const latestRows = await Promise.all(
        profiles.map((friend) =>
          supabase
            .from("messages")
            .select(MESSAGE_COLUMNS)
            .or(
              `and(sender_id.eq.${currentUserId},receiver_id.eq.${friend.id}),` +
                `and(sender_id.eq.${friend.id},receiver_id.eq.${currentUserId})`
            )
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      );
      if (!active) return;

      commit(
        profiles
          .map((profile, i) => {
            const row = latestRows[i].data;
            return {
              profile,
              lastMessage: row ? toPreview(mapMessage(row)) : undefined,
            };
          })
          .sort(byRecent),
      );
      setLoading(false);
    };

    void fetchConversations();

    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => void fetchConversations(), 400);
    };

    const unsubscribe = subscribeToFeed(currentUserId, (event) => {
      if (event.type === "insert") {
        const { message } = event;
        const peer =
          message.senderId === currentUserId ? message.receiverId : message.senderId;
        if (!current.some((item) => item.profile.id === peer)) {
          scheduleRefetch();
          return;
        }
        // Patch the preview in place — no network round trip needed.
        commit(
          current
            .map((item) =>
              item.profile.id === peer && lastTime(item) <= Date.parse(message.createdAt)
                ? { ...item, lastMessage: toPreview(message) }
                : item,
            )
            .sort(byRecent),
        );
      } else if (event.type === "delete") {
        // Only a deleted *preview* message changes what the sidebar shows.
        if (!event.id || current.some((item) => item.lastMessage?.id === event.id)) {
          scheduleRefetch();
        }
      } else {
        scheduleRefetch();
      }
    });

    return () => {
      active = false;
      clearTimeout(refetchTimer);
      unsubscribe();
    };
  }, [currentUserId]);

  return { conversations, loading };
}
