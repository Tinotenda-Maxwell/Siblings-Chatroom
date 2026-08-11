// src/components/Sidebar.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useUserSearch } from "../hooks/useUserSearch";
import type { Profile } from "../types/profile";
import type { ConversationItem } from "../hooks/useConversations";

interface SidebarProps {
  currentUser: Profile | null;
  selectedUser: Profile | null;
  conversations: ConversationItem[];
  onSelectUser: (user: Profile) => void;
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Sidebar({
  currentUser,
  selectedUser,
  conversations,
  onSelectUser,
}: SidebarProps) {
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const {
    searchTerm,
    setSearchTerm,
    results,
    loading: searching,
    incomingRequests,
    sendFriendRequest,
    acceptFriendRequest,
  } = useUserSearch(currentUser);

  const currentInitial = currentUser?.displayName?.[0]?.toUpperCase() ?? "M";

  // Auto-close search when clicking outside search container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchTerm("");
      }
    };

    if (showSearch) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSearch, setSearchTerm]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      {/* Sidebar header with title & search icon */}
      <div className="sidebar-header" style={{ justifyContent: "space-between" }}>
        <h1 className="sidebar-title">Messages</h1>
        <button
          className="icon-button"
          onClick={() => {
            setShowSearch(!showSearch);
            if (showSearch) setSearchTerm("");
          }}
          title={showSearch ? "Close user search" : "Find friends by username"}
          aria-label="Search users"
          style={{ position: "relative" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {showSearch ? (
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
          {incomingRequests.length > 0 && !showSearch && (
            <span
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#a78bfa",
              }}
            />
          )}
        </button>
      </div>

      {/* Toggleable search container — pushes chats down smoothly */}
      {showSearch && (
        <div ref={searchRef} style={{ padding: "0 12px 12px" }}>
          <input
            className="message-input"
            type="text"
            placeholder="Search by username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              backgroundColor: "#14101c",
              border: "1px solid #221d2c",
              borderRadius: "14px",
              padding: "0 14px",
              height: "38px",
              marginBottom: "8px",
            }}
            autoFocus
          />

          {/* Pending Friend Requests Section */}
          {incomingRequests.length > 0 && !searchTerm && (
            <div
              style={{
                backgroundColor: "#14101c",
                border: "1px solid #221d2c",
                borderRadius: "12px",
                padding: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#a78bfa",
                  fontWeight: 600,
                  marginBottom: "6px",
                  paddingLeft: "4px",
                }}
              >
                PENDING REQUESTS ({incomingRequests.length})
              </div>
              {incomingRequests.map(({ profile, friendshipId }) => (
                <div
                  key={profile.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px",
                    borderRadius: "8px",
                    backgroundColor: "#191325",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <img
                      className="avatar"
                      src={
                        profile.avatarUrl ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`
                      }
                      alt={profile.displayName}
                      style={{ width: "30px", height: "30px" }}
                    />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{profile.displayName}</div>
                      <div style={{ fontSize: "11px", color: "#8b8594" }}>@{profile.username}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => acceptFriendRequest(friendshipId, profile.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      backgroundColor: "#7c3aed",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Results Dropdown/Box */}
          {(searchTerm || searching) && (
            <div
              style={{
                backgroundColor: "#14101c",
                border: "1px solid #221d2c",
                borderRadius: "12px",
                padding: "8px",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {searching && (
                <div style={{ padding: "8px", color: "#8b8594", fontSize: "12.5px" }}>
                  Searching users…
                </div>
              )}

              {!searching && searchTerm && results.length === 0 && (
                <div style={{ padding: "8px", color: "#8b8594", fontSize: "12.5px" }}>
                  No users found matching "@{searchTerm}".
                </div>
              )}

              {!searching &&
                results.map(({ profile, friendshipStatus, friendshipId }) => {
                  const avatarSrc =
                    profile.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`;

                  return (
                    <div
                      key={profile.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px",
                        borderRadius: "8px",
                        backgroundColor: "#191325",
                        marginBottom: "4px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img
                          className="avatar"
                          src={avatarSrc}
                          alt={profile.displayName}
                          style={{ width: "32px", height: "32px" }}
                        />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{profile.displayName}</div>
                          <div style={{ fontSize: "11px", color: "#8b8594" }}>@{profile.username}</div>
                        </div>
                      </div>

                      {friendshipStatus === "none" && (
                        <button
                          onClick={() => sendFriendRequest(profile.id)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #7c3aed",
                            color: "#a78bfa",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Add
                        </button>
                      )}

                      {friendshipStatus === "pending_sent" && (
                        <span style={{ fontSize: "11px", color: "#8b8594", padding: "4px" }}>
                          Sent
                        </span>
                      )}

                      {friendshipStatus === "pending_received" && (
                        <button
                          onClick={() => acceptFriendRequest(friendshipId, profile.id)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#7c3aed",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Accept
                        </button>
                      )}

                      {friendshipStatus === "accepted" && (
                        <button
                          onClick={() => {
                            onSelectUser(profile);
                            setShowSearch(false);
                            setSearchTerm("");
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#241d30",
                            color: "#a78bfa",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Message
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Main Conversation List — stays visible and shifts down when search is active */}
      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div style={{ padding: "20px 12px", color: "#8b8594", fontSize: "13.5px" }}>
            No conversations yet. Click the search icon above to find friends by username!
          </div>
        ) : (
          conversations.map(({ profile, lastMessage }) => {
            const isSelected = selectedUser?.id === profile.id;
            const avatarSrc =
              profile.avatarUrl ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`;

            return (
              <div
                key={profile.id}
                className={`conversation-item ${
                  isSelected ? "conversation-item--selected" : ""
                }`}
                onClick={() => onSelectUser(profile)}
              >
                <div className="avatar-wrapper">
                  <img
                    className="avatar"
                    src={avatarSrc}
                    alt={profile.displayName}
                  />
                  <span className="online-dot" />
                </div>
                <div className="conversation-info">
                  <div className="conversation-top">
                    <span className="conversation-name">
                      {profile.displayName}{" "}
                      <span className="heart">💜</span>
                    </span>
                    {lastMessage && (
                      <span className="conversation-time">
                        {formatTime(lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="conversation-preview">
                    {lastMessage
                      ? lastMessage.message
                      : "Start a conversation…"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer with current user info + logout */}
      <div className="sidebar-footer">
        <div className="footer-avatar">{currentInitial}</div>
        <span className="footer-name">
          {currentUser?.displayName ?? "You"}
        </span>
        <button
          className="footer-chevron icon-button"
          aria-label="Log out"
          onClick={handleLogout}
          title="Log out"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
