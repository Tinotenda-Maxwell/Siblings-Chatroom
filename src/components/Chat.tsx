// src/components/Chat.tsx
import { useEffect, useRef } from "react";
import MessageInput from "./MessageInput";
import type { Message } from "../types/message";
import type { Profile } from "../types/profile";

const CheckMarks = () => (
  <svg
    width="16"
    height="12"
    viewBox="0 0 16 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 6.5L4.5 10L11 2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 6.5L9 10L15.5 2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ChatProps {
  messages: Message[];
  loading: boolean;
  currentUser: Profile | null;
  otherUser: Profile | null;
  onSend: (text: string) => Promise<void>;
}

function renderMessageContent(text: string) {
  // Check if message is an image attachment: [Image: name] (dataUrl)
  const imageMatch = text.match(/^\[Image: (.*?)\] \((data:image\/.*)\)$/);
  if (imageMatch) {
    const [, filename, src] = imageMatch;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <img
          src={src}
          alt={filename}
          style={{
            maxWidth: "240px",
            maxHeight: "240px",
            borderRadius: "12px",
            objectFit: "cover",
          }}
        />
        <span style={{ fontSize: "11px", opacity: 0.8 }}>📷 {filename}</span>
      </div>
    );
  }

  return <span className="bubble-text">{text}</span>;
}

function Chat({ messages, loading, currentUser, otherUser, onSend }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const otherAvatarSrc =
    otherUser?.avatarUrl ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?.username || "default"}`;

  return (
    <div className="chat">
      <div className="chat-messages">
        {loading && (
          <div className="date-divider">
            <span className="date-divider-line" />
            <span className="date-divider-label">Loading messages…</span>
            <span className="date-divider-line" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="date-divider">
            <span className="date-divider-line" />
            <span className="date-divider-label">
              No messages with {otherUser?.displayName ?? "this user"} yet. Say hi! 👋
            </span>
            <span className="date-divider-line" />
          </div>
        )}

        {!loading && messages.length > 0 && (
          <div className="date-divider">
            <span className="date-divider-line" />
            <span className="date-divider-label">Today</span>
            <span className="date-divider-line" />
          </div>
        )}

        {messages.map((msg) => {
          const isOutgoing = msg.senderId === currentUser?.id;

          if (isOutgoing) {
            return (
              <div
                key={msg.id}
                className="message-group message-group--outgoing"
              >
                <div className="bubble bubble--outgoing">
                  {renderMessageContent(msg.message)}
                  <span className="bubble-meta">
                    {formatTime(msg.createdAt)} <CheckMarks />
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className="message-group message-group--incoming"
            >
              <img
                className="avatar avatar--message"
                src={otherAvatarSrc}
                alt={otherUser?.displayName ?? "Contact"}
              />
              <div className="bubble-stack">
                <div className="bubble bubble--incoming">
                  {renderMessageContent(msg.message)}
                  <span className="bubble-meta">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={onSend} />
    </div>
  );
}

export default Chat;
