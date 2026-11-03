// src/pages/ChatPage.tsx
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { useSession } from "../hooks/useSession";
import { useMessages } from "../hooks/useMessages";
import { useConversations } from "../hooks/useConversations";
import {
  PROFILE_COLUMNS,
  mapProfile,
  previewText,
  readCache,
  writeCache,
} from "../services/mappers";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Chat from "../components/Chat";
import type { Profile } from "../types/profile";

const profileCacheKey = (userId: string) => `sibling-chat:profile:${userId}`;

function ChatPage() {
  // ProtectedRoute guarantees a session here.
  const userId = useSession()?.user.id ?? null;
  const [currentUser, setCurrentUser] = useState<Profile | null>(() =>
    userId ? readCache<Profile>(profileCacheKey(userId)) : null,
  );
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Tracks whether the single-pane mobile layout is showing the open
  // conversation (vs. the conversation list). Irrelevant above the mobile
  // breakpoint, where both panes are shown side by side regardless.
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);

  const handleSelectUser = useCallback((user: Profile) => {
    // An in-chat search belongs to the conversation it was typed in.
    setSearchQuery("");
    setSelectedUser(user);
    setMobileConversationOpen(true);
  }, []);

  // 1. Refresh the current user's profile. Everything else only needs the
  //    user id, so it loads in parallel instead of waiting on this.
  useEffect(() => {
    if (!userId) return;
    let active = true;

    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .single()
      .then(({ data: profile }) => {
        if (!active || !profile) return;
        const mapped = mapProfile(profile);
        setCurrentUser(mapped);
        writeCache(profileCacheKey(userId), mapped);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // 2. Fetch conversations list from Supabase profiles database
  const { conversations, loading: convsLoading } = useConversations(userId);

  // 3. Auto-select first contact if none selected yet
  useEffect(() => {
    if (!selectedUser && conversations.length > 0) {
      setSelectedUser(conversations[0].profile);
    }
  }, [conversations, selectedUser]);

  // 4. Messages hook for selected user
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    clearHistory,
  } = useMessages(userId, selectedUser);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredMessages = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return messages;
    // Match images by filename, not by their base64 payload.
    return messages.filter((m) => previewText(m.message).toLowerCase().includes(query));
  }, [messages, deferredSearchQuery]);

  const handleBack = useCallback(() => setMobileConversationOpen(false), []);

  return (
    <div
      className={`app${mobileConversationOpen ? " app--conversation-open" : ""}`}
    >
      <Sidebar
        currentUser={currentUser}
        currentUserId={userId}
        selectedUser={selectedUser}
        conversations={conversations}
        loading={convsLoading}
        onSelectUser={handleSelectUser}
      />
      <div className="main-panel">
        {selectedUser ? (
          <>
            <Header
              key={selectedUser.id}
              otherUser={selectedUser}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearHistory={clearHistory}
              onBack={handleBack}
            />
            {messagesError && (
              <div className="chat-error" role="alert">
                {messagesError}
              </div>
            )}
            <Chat
              messages={filteredMessages}
              loading={messagesLoading}
              currentUserId={userId}
              otherUser={selectedUser}
              searchQuery={deferredSearchQuery}
              onSend={sendMessage}
            />
          </>
        ) : (
          <div className="chat-empty-state">
            {convsLoading ? (
              <div className="auth-spinner" />
            ) : (
              <>
                <div className="sidebar-icon chat-empty-state-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                      fill="white"
                      fillOpacity="0.9"
                    />
                  </svg>
                </div>
                <h2>{conversations.length ? "Pick a conversation" : "No conversations yet"}</h2>
                <p>
                  {conversations.length
                    ? "Choose someone from the list to start chatting."
                    : "Use the search button in the sidebar to find friends by username."}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
