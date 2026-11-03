// src/components/Sidebar.tsx
import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { avatarFor } from "../services/mappers";
import { useUserSearch } from "../hooks/useUserSearch";
import { prefetchThread } from "../hooks/useMessages";
import type { Profile } from "../types/profile";
import type { ConversationItem } from "../hooks/useConversations";

interface SidebarProps {
  currentUser: Profile | null;
  currentUserId: string | null;
  selectedUser: Profile | null;
  conversations: ConversationItem[];
  loading?: boolean;
  onSelectUser: (user: Profile) => void;
}

// Time for today, "Yesterday", weekday within a week, otherwise a short date.
function formatListTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (diffDays <= 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Sidebar({
  currentUser,
  currentUserId,
  selectedUser,
  conversations,
  loading = false,
  onSelectUser,
}: SidebarProps) {
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const {
    searchTerm,
    setSearchTerm,
    results,
    loading: searching,
    incomingRequests,
    sendFriendRequest,
    acceptFriendRequest,
  } = useUserSearch(currentUserId);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchTerm("");
  }, [setSearchTerm]);

  // Auto-close search when clicking outside the search container. The toggle
  // button is excluded so it can close the panel itself without reopening it.
  useEffect(() => {
    if (!showSearch) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        searchRef.current &&
        !searchRef.current.contains(target) &&
        !toggleRef.current?.contains(target)
      ) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearch, closeSearch]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      {/* Sidebar header with title & search icon */}
      <div className="sidebar-header">
        <h1 className="sidebar-title">Messages</h1>
        <button
          ref={toggleRef}
          className={`icon-button${showSearch ? " icon-button--active" : ""}`}
          onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
          title={showSearch ? "Close user search" : "Find friends by username"}
          aria-label={
            incomingRequests.length > 0
              ? `Find friends (${incomingRequests.length} pending requests)`
              : "Find friends"
          }
          aria-expanded={showSearch}
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
            <span className="badge-dot" />
          )}
        </button>
      </div>

      {/* Toggleable search container — pushes chats down smoothly */}
      {showSearch && (
        <div ref={searchRef} className="sidebar-search">
          <input
            className="sidebar-search-input"
            type="text"
            placeholder="Find friends by username…"
            aria-label="Find friends by username"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeSearch();
            }}
            autoFocus
          />

          {/* Pending Friend Requests Section */}
          {incomingRequests.length > 0 && !searchTerm && (
            <div className="request-panel">
              <div className="request-panel-title">
                Pending requests ({incomingRequests.length})
              </div>
              {incomingRequests.map(({ profile, friendshipId }) => (
                <div key={profile.id} className="request-row">
                  <div className="request-row-person">
                    <img
                      loading="lazy"
                      decoding="async"
                      className="avatar request-row-avatar"
                      src={avatarFor(profile)}
                      alt={profile.displayName}
                    />
                    <div>
                      <div className="request-row-name">{profile.displayName}</div>
                      <div className="request-row-username">@{profile.username}</div>
                    </div>
                  </div>
                  <button
                    className="pill-btn pill-btn--solid"
                    onClick={() => acceptFriendRequest(friendshipId, profile.id)}
                  >
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Results Dropdown/Box */}
          {(searchTerm || searching) && (
            <div className="search-panel">
              {searching && (
                <div className="search-loading">Searching users…</div>
              )}

              {!searching && searchTerm && results.length === 0 && (
                <div className="search-empty">
                  No users found matching "@{searchTerm}".
                </div>
              )}

              {!searching &&
                results.map(({ profile, friendshipStatus, friendshipId }) => {
                  const avatarSrc = avatarFor(profile);

                  return (
                    <div key={profile.id} className="search-row">
                      <div className="search-row-person">
                        <img
                          loading="lazy"
                          decoding="async"
                          className="avatar search-row-avatar"
                          src={avatarSrc}
                          alt={profile.displayName}
                        />
                        <div>
                          <div className="search-row-name">{profile.displayName}</div>
                          <div className="search-row-username">@{profile.username}</div>
                        </div>
                      </div>

                      {friendshipStatus === "none" && (
                        <button
                          className="pill-btn pill-btn--outline"
                          onClick={() => sendFriendRequest(profile.id)}
                        >
                          Add
                        </button>
                      )}

                      {friendshipStatus === "pending_sent" && (
                        <span className="pill-btn pill-btn--sent">Sent</span>
                      )}

                      {friendshipStatus === "pending_received" && (
                        <button
                          className="pill-btn pill-btn--solid"
                          onClick={() => acceptFriendRequest(friendshipId, profile.id)}
                        >
                          Accept
                        </button>
                      )}

                      {friendshipStatus === "accepted" && (
                        <button
                          className="pill-btn pill-btn--muted"
                          onClick={() => {
                            onSelectUser(profile);
                            closeSearch();
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
        {loading && conversations.length === 0 ? (
          <div className="conversation-empty">Loading conversations…</div>
        ) : conversations.length === 0 ? (
          <div className="conversation-empty">
            <p>No conversations yet.</p>
            {!showSearch && (
              <button
                type="button"
                className="pill-btn pill-btn--solid conversation-empty-cta"
                onClick={() => setShowSearch(true)}
              >
                Find friends
              </button>
            )}
          </div>
        ) : (
          conversations.map(({ profile, lastMessage }) => {
            const isSelected = selectedUser?.id === profile.id;
            const avatarSrc = avatarFor(profile);

            return (
              <button
                type="button"
                key={profile.id}
                className={`conversation-item ${
                  isSelected ? "conversation-item--selected" : ""
                }`}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelectUser(profile)}
                // Start loading the thread on hover/touch so it's usually
                // ready by the time the click lands.
                onPointerEnter={() => prefetchThread(currentUserId, profile.id)}
                onTouchStart={() => prefetchThread(currentUserId, profile.id)}
              >
                <span className="avatar-wrapper">
                  <img
                    loading="lazy"
                    decoding="async"
                    className="avatar"
                    src={avatarSrc}
                    alt=""
                  />
                </span>
                <span className="conversation-info">
                  <span className="conversation-top">
                    <span className="conversation-name">
                      {profile.displayName}{" "}
                      <span className="heart">💜</span>
                    </span>
                    {lastMessage && (
                      <span className="conversation-time">
                        {formatListTime(lastMessage.createdAt)}
                      </span>
                    )}
                  </span>
                  <span className="conversation-preview">
                    {lastMessage
                      ? `${lastMessage.senderId === currentUserId ? "You: " : ""}${lastMessage.message}`
                      : "Start a conversation…"}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer with current user info + logout */}
      <div className="sidebar-footer">
        {currentUser ? (
          <img className="avatar footer-avatar" src={avatarFor(currentUser)} alt="" />
        ) : (
          <div className="footer-avatar" />
        )}
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

export default memo(Sidebar);
