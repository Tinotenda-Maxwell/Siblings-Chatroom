// src/components/Header.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { avatarFor } from "../services/mappers";
import type { Profile } from "../types/profile";

interface HeaderProps {
  otherUser: Profile | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearHistory: () => Promise<void>;
  onBack?: () => void;
}

function Header({
  otherUser,
  searchQuery,
  onSearchChange,
  onClearHistory,
  onBack,
}: HeaderProps) {
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = otherUser?.displayName ?? "Contact";
  const avatarSrc = avatarFor(otherUser);

  // Close dropdown on outside click or Escape. The toggle button lives inside
  // menuRef, so clicking it doesn't close-then-reopen the menu.
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showMenu]);

  const closeSearch = () => {
    setShowSearch(false);
    onSearchChange("");
  };

  const handleLogout = async () => {
    setShowMenu(false);
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="chat-header">
      <button
        className="chat-header-back"
        aria-label="Back to conversations"
        onClick={onBack}
        title="Back"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="chat-header-contact">
        <div className="avatar-wrapper">
          <img
            className="avatar avatar--header"
            src={avatarSrc}
            alt={displayName}
          />
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">
            {displayName} <span className="heart">💜</span>
          </span>
          {otherUser && (
            <span className="chat-header-status">@{otherUser.username}</span>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="chat-header-search">
          <input
            className="chat-header-search-input"
            type="text"
            placeholder="Search in chat…"
            aria-label="Search messages"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeSearch();
            }}
            autoFocus
          />
        </div>
      )}

      <div className="chat-header-actions">
        <button
          className={`icon-button${showSearch ? " icon-button--active" : ""}`}
          aria-label="Search"
          aria-pressed={showSearch}
          onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
          title="Search messages"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M21 21l-4.35-4.35"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="menu-anchor" ref={menuRef}>
          <button
            className={`icon-button${showMenu ? " icon-button--active" : ""}`}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            onClick={() => setShowMenu((open) => !open)}
            title="More options"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="5" r="1.6" fill="currentColor" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <circle cx="12" cy="19" r="1.6" fill="currentColor" />
            </svg>
          </button>
  
          {showMenu && (
            <div className="dropdown-menu" role="menu">
              <button
                role="menuitem"
                className="dropdown-item dropdown-item--danger"
                onClick={() => {
                  setShowMenu(false);
                  if (
                    window.confirm(
                      `Delete all messages with ${displayName}? This can't be undone.`,
                    )
                  ) {
                    onClearHistory();
                  }
                }}
              >
                Clear Chat History
              </button>
              <div className="dropdown-divider" />
              <button role="menuitem" className="dropdown-item" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
