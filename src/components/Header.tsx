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
}

function Header({
  otherUser,
  searchQuery,
  onSearchChange,
  onClearHistory,
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
        <div style={{ flex: 1, maxWidth: "260px", margin: "0 16px" }}>
          <input
            className="message-input"
            type="text"
            placeholder="Search in chat..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              backgroundColor: "#14101c",
              border: "1px solid #221d2c",
              borderRadius: "20px",
              padding: "0 14px",
              height: "36px",
            }}
            autoFocus
          />
        </div>
      )}

      <div className="chat-header-actions" style={{ position: "relative" }}>
        <button
          className="icon-button"
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
          className="icon-button"
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
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: "48px",
              right: "0",
              backgroundColor: "#14101c",
              border: "1px solid #221d2c",
              borderRadius: "14px",
              padding: "8px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              zIndex: 100,
              minWidth: "160px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                if (window.confirm("Clear all message history with this user?")) {
                  onClearHistory();
                }
              }}
              style={{
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13.5px",
                color: "#f87171",
                cursor: "pointer",
              }}
            >
              Clear Chat History
            </button>
            <button
              onClick={handleLogout}
              style={{
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13.5px",
                color: "#b8b2c2",
                cursor: "pointer",
              }}
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
