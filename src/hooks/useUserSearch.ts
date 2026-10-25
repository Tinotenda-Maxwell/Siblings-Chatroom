// src/hooks/useUserSearch.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";
import { subscribeToFeed } from "../services/messageFeed";
import { PROFILE_COLUMNS, mapProfile } from "../services/mappers";
import type { Profile } from "../types/profile";

export interface UserSearchResult {
  profile: Profile;
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted";
  friendshipId?: string;
}

export function useUserSearch(currentUserId: string | null) {
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<UserSearchResult[]>([]);

  // Search users by username
  useEffect(() => {
    if (!currentUserId || !searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const search = async () => {
      setLoading(true);

      const query = searchTerm.trim().toLowerCase();

      // 1. Search profiles matching username or display_name
      const { data: profilesData } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .neq("id", currentUserId)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10);

      if (cancelled) return;
      if (!profilesData || profilesData.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // 2. Fetch existing friendships involving these users
      const targetIds = profilesData.map((p) => p.id as string);
      const { data: friendships } = await supabase
        .from("friendships")
        .select("id, sender_id, receiver_id, status")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.in.(${targetIds.join(",")})),` +
            `and(receiver_id.eq.${currentUserId},sender_id.in.(${targetIds.join(",")}))`
        );
      if (cancelled) return;

      const searchResults: UserSearchResult[] = profilesData.map((row) => {
        const profile = mapProfile(row);

        const f = friendships?.find(
          (item) =>
            (item.sender_id === currentUserId && item.receiver_id === profile.id) ||
            (item.receiver_id === currentUserId && item.sender_id === profile.id)
        );

        let status: UserSearchResult["friendshipStatus"] = "none";
        if (f) {
          if (f.status === "accepted") {
            status = "accepted";
          } else if (f.status === "pending") {
            status = f.sender_id === currentUserId ? "pending_sent" : "pending_received";
          }
        }

        return { profile, friendshipStatus: status, friendshipId: f?.id };
      });

      setResults(searchResults);
      setLoading(false);
    };

    const timer = setTimeout(search, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, currentUserId, refreshNonce]);

  // Fetch incoming friend requests for badge / tab
  const fetchIncomingRequests = useCallback(async () => {
    if (!currentUserId) return;

    const { data: pending } = await supabase
      .from("friendships")
      .select(`id, sender:profiles!friendships_sender_id_fkey(${PROFILE_COLUMNS})`)
      .eq("receiver_id", currentUserId)
      .eq("status", "pending");

    if (pending) {
      const formatted: UserSearchResult[] = pending.map((item) => {
        const p = item.sender as unknown as Record<string, unknown>;
        return {
          profile: mapProfile(p),
          friendshipStatus: "pending_received",
          friendshipId: item.id,
        };
      });
      setIncomingRequests(formatted);
    }
  }, [currentUserId]);

  useEffect(() => {
    void fetchIncomingRequests();
    if (!currentUserId) return;
    // Keep the request badge live instead of only loading it once.
    return subscribeToFeed(currentUserId, (event) => {
      if (event.type === "friendship") void fetchIncomingRequests();
    });
  }, [currentUserId, fetchIncomingRequests]);

  // Actions: Send, Accept, Cancel Request
  const sendFriendRequest = async (targetId: string) => {
    if (!currentUserId) return;
    // Reflect the change immediately; the refresh below confirms it.
    setResults((prev) =>
      prev.map((r) =>
        r.profile.id === targetId ? { ...r, friendshipStatus: "pending_sent" } : r
      )
    );
    await supabase.from("friendships").insert({
      sender_id: currentUserId,
      receiver_id: targetId,
      status: "pending",
    });
    setRefreshNonce((n) => n + 1);
  };

  const acceptFriendRequest = async (friendshipId?: string, senderId?: string) => {
    if (!currentUserId) return;
    setResults((prev) =>
      prev.map((r) =>
        r.profile.id === senderId ? { ...r, friendshipStatus: "accepted" } : r
      )
    );
    setIncomingRequests((prev) => prev.filter((r) => r.profile.id !== senderId));
    if (friendshipId) {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
    } else if (senderId) {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("sender_id", senderId)
        .eq("receiver_id", currentUserId);
    }
    setRefreshNonce((n) => n + 1);
    void fetchIncomingRequests();
  };

  return {
    searchTerm,
    setSearchTerm,
    results,
    loading,
    incomingRequests,
    sendFriendRequest,
    acceptFriendRequest,
  };
}
