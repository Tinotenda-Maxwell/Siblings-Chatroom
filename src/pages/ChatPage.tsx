// src/pages/ChatPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useMessages } from "../hooks/useMessages";
import { useConversations } from "../hooks/useConversations";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Chat from "../components/Chat";
import type { Profile } from "../types/profile";

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function ChatPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch current logged-in user profile
  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const userId = session.user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile) {
        setCurrentUser(mapProfile(profile));
      }
      setProfileLoading(false);
    };

    load();
  }, [navigate]);

  // 2. Fetch conversations list from Supabase profiles database
  const { conversations, loading: convsLoading } = useConversations(currentUser);

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
  } = useMessages(currentUser, selectedUser);

  // Filter messages by header search query if active
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  if (profileLoading || convsLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        currentUser={currentUser}
        selectedUser={selectedUser}
        conversations={conversations}
        onSelectUser={(user) => setSelectedUser(user)}
      />
      <div className="main-panel">
        <Header
          otherUser={selectedUser}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearHistory={clearHistory}
        />
        {messagesError && (
          <div className="chat-error" role="alert">
            {messagesError}
          </div>
        )}
        <Chat
          messages={filteredMessages}
          loading={messagesLoading}
          currentUser={currentUser}
          otherUser={selectedUser}
          onSend={sendMessage}
        />
      </div>
    </div>
  );
}

export default ChatPage;
