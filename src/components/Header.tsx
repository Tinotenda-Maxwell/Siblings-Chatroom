// src/components/Header.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
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
  const avatarSrc =
    otherUser?.avatarUrl ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?.username || "default"}`;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <span className="chat-header-status">
            <span className="online-dot online-dot--inline" />
            Online
          </span>
        </div>
      </div>

      {showSearch && (
        <div className="chat-header-search">
          <input
            className="chat-header-search-input"
            type="text"
            placeholder="Search in chat..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <div className="chat-header-actions">
        <button
          className={`icon-button${showSearch ? " icon-button--active" : ""}`}
          aria-label="Search"
          onClick={() => {
            setShowSearch(!showSearch);
            if (showSearch) onSearchChange("");
          }}
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

        <button
          className={`icon-button${showMenu ? " icon-button--active" : ""}`}
          aria-label="More options"
          onClick={() => setShowMenu(!showMenu)}
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
          <div ref={menuRef} className="dropdown-menu">
            <button
              className="dropdown-item dropdown-item--danger"
              onClick={() => {
                setShowMenu(false);
                if (window.confirm("Clear all message history with this user?")) {
                  onClearHistory();
                }
              }}
            >
              Clear Chat History
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
