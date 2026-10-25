// src/components/Chat.tsx
import { memo, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import MessageInput from "./MessageInput";
import { avatarFor, parseImage } from "../services/mappers";
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

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayKey(iso: string): number {
  return startOfDay(new Date(iso));
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / 86_400_000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

interface ChatProps {
  messages: Message[];
  loading: boolean;
  currentUserId: string | null;
  otherUser: Profile | null;
  onSend: (text: string) => Promise<void>;
}

function renderMessageContent(text: string) {
  // Check if message is an image attachment: [Image: name] (dataUrl)
  const image = parseImage(text);
  if (image) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <img
          loading="lazy"
          decoding="async"
          src={image.src}
          alt={image.filename}
          style={{
            maxWidth: "240px",
            maxHeight: "240px",
            borderRadius: "12px",
            objectFit: "cover",
          }}
        />
        <span style={{ fontSize: "11px", opacity: 0.8 }}>📷 {image.filename}</span>
      </div>
    );
  }

  return <span className="bubble-text">{text}</span>;
}

interface MessageRowProps {
  message: Message;
  outgoing: boolean;
  avatarSrc: string;
  avatarAlt: string;
}

// Memoised so appending a message renders one new row instead of every row.
const MessageRow = memo(function MessageRow({
  message,
  outgoing,
  avatarSrc,
  avatarAlt,
}: MessageRowProps) {
  if (outgoing) {
    return (
      <div className="message-group message-group--outgoing">
        <div className="bubble bubble--outgoing">
          {renderMessageContent(message.message)}
          <span className="bubble-meta">
            {formatTime(message.createdAt)} <CheckMarks />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="message-group message-group--incoming">
      <img
        className="avatar avatar--message"
        loading="lazy"
        decoding="async"
        src={avatarSrc}
        alt={avatarAlt}
      />
      <div className="bubble-stack">
        <div className="bubble bubble--incoming">
          {renderMessageContent(message.message)}
          <span className="bubble-meta">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
});

function Chat({
  messages,
  loading,
  currentUserId,
  otherUser,
  onSend,
}: ChatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const firstLoadRef = useRef(true);

  // Reset scroll tracking when switching conversations.
  useEffect(() => {
    firstLoadRef.current = true;
    nearBottomRef.current = true;
  }, [otherUser?.id]);

  // Auto-scroll only when it makes sense: first load, the reader is already
  // near the bottom, or the newest message was sent by the current user.
  useEffect(() => {
    if (loading) return;
    const last = messages[messages.length - 1];
    const sentByMe = last?.senderId === currentUserId;
    if (firstLoadRef.current || nearBottomRef.current || sentByMe) {
      bottomRef.current?.scrollIntoView({
        behavior: firstLoadRef.current ? "auto" : "smooth",
      });
    }
    firstLoadRef.current = false;
  }, [messages, loading, currentUserId]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const otherAvatarSrc = avatarFor(otherUser);
  const otherName = otherUser?.displayName ?? "Contact";

  const rows = useMemo<ReactNode[]>(() => {
    const nextRows: ReactNode[] = [];
    let lastKey = 0;

    for (const msg of messages) {
      const key = dayKey(msg.createdAt);
      if (key !== lastKey) {
        lastKey = key;
        nextRows.push(
          <div className="date-divider" key={`divider-${key}`}>
            <span className="date-divider-line" />
            <span className="date-divider-label">
              {dayLabel(msg.createdAt)}
            </span>
            <span className="date-divider-line" />
          </div>,
        );
      }

      nextRows.push(
        <MessageRow
          key={msg.id}
          message={msg}
          outgoing={msg.senderId === currentUserId}
          avatarSrc={otherAvatarSrc}
          avatarAlt={otherName}
        />,
      );
    }

    return nextRows;
  }, [messages, currentUserId, otherAvatarSrc, otherName]);

  return (
    <div className="chat">
      <div
        className="chat-messages"
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-busy={loading}
      >
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
              No messages with {otherUser?.displayName ?? "this user"} yet. Say
              hi! 👋
            </span>
            <span className="date-divider-line" />
          </div>
        )}

        {rows}

        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={onSend} disabled={!otherUser} />
    </div>
  );
}

export default Chat;
