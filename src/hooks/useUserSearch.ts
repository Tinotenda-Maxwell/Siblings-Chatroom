// src/hooks/useUserSearch.ts
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import type { Profile } from "../types/profile";

export interface UserSearchResult {
  profile: Profile;
  friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted";
  friendshipId?: string;
}

export function useUserSearch(currentUser: Profile | null) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<UserSearchResult[]>([]);

  // Search users by username
  useEffect(() => {
    if (!currentUser || !searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const search = async () => {
      setLoading(true);

      const query = searchTerm.trim().toLowerCase();

      // 1. Search profiles matching username or display_name
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", currentUser.id)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10);

      if (!profilesData || profilesData.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // 2. Fetch existing friendships involving these users
      const targetIds = profilesData.map((p) => p.id as string);
      const { data: friendships } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.in.(${targetIds.join(",")})),` +
            `and(receiver_id.eq.${currentUser.id},sender_id.in.(${targetIds.join(",")}))`
        );

      const searchResults: UserSearchResult[] = profilesData.map((row) => {
        const profile: Profile = {
          id: row.id as string,
          username: row.username as string,
          displayName: row.display_name as string,
          avatarUrl: row.avatar_url as string | null,
          createdAt: row.created_at as string,
        };

        const f = friendships?.find(
          (item) =>
            (item.sender_id === currentUser.id && item.receiver_id === profile.id) ||
            (item.receiver_id === currentUser.id && item.sender_id === profile.id)
        );

        let status: UserSearchResult["friendshipStatus"] = "none";
        if (f) {
          if (f.status === "accepted") {
            status = "accepted";
          } else if (f.status === "pending") {
            status = f.sender_id === currentUser.id ? "pending_sent" : "pending_received";
          }
        }

        return { profile, friendshipStatus: status, friendshipId: f?.id };
      });

      setResults(searchResults);
      setLoading(false);
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, currentUser?.id]);

  // Fetch incoming friend requests for badge / tab
  const fetchIncomingRequests = async () => {
    if (!currentUser) return;

    const { data: pending } = await supabase
      .from("friendships")
      .select("*, sender:profiles!friendships_sender_id_fkey(*)")
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    if (pending) {
      const formatted: UserSearchResult[] = pending.map((item) => {
        const p = item.sender as Record<string, unknown>;
        return {
          profile: {
            id: p.id as string,
            username: p.username as string,
            displayName: p.display_name as string,
            avatarUrl: p.avatar_url as string | null,
            createdAt: p.created_at as string,
          },
          friendshipStatus: "pending_received",
          friendshipId: item.id,
        };
      });
      setIncomingRequests(formatted);
    }
  };

  useEffect(() => {
    fetchIncomingRequests();
  }, [currentUser?.id]);

  // Actions: Send, Accept, Cancel Request
  const sendFriendRequest = async (targetId: string) => {
    if (!currentUser) return;
    await supabase.from("friendships").insert({
      sender_id: currentUser.id,
      receiver_id: targetId,
      status: "pending",
    });
    setSearchTerm((prev) => prev); // trigger re-search
    fetchIncomingRequests();
  };

  const acceptFriendRequest = async (friendshipId?: string, senderId?: string) => {
    if (!currentUser) return;
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
        .eq("receiver_id", currentUser.id);
    }
    setSearchTerm((prev) => prev);
    fetchIncomingRequests();
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
