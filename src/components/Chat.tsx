// src/components/Chat.tsx
import { memo, useEffect, useMemo, useRef, useCallback, useState, type ReactNode } from "react";
import MessageInput from "./MessageInput";
import { avatarFor, parseImage } from "../services/mappers";
import { isPending } from "../hooks/useMessages";
import type { Message } from "../types/message";
import type { Profile } from "../types/profile";

// Consecutive messages from the same sender within this window are drawn as
// one visual run (shared avatar, tighter spacing).
const RUN_GAP_MS = 5 * 60 * 1000;

const CheckMarks = () => (
  <svg
    width="16"
    height="12"
    viewBox="0 0 16 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Sent"
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

const PendingClock = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Sending"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function sameRun(a: Message | undefined, b: Message | undefined): boolean {
  if (!a || !b || a.senderId !== b.senderId) return false;
  if (dayKey(a.createdAt) !== dayKey(b.createdAt)) return false;
  return Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < RUN_GAP_MS;
}

interface ChatProps {
  messages: Message[];
  loading: boolean;
  currentUserId: string | null;
  otherUser: Profile | null;
  /** Active in-chat search; changes the empty state wording. */
  searchQuery?: string;
  onSend: (text: string) => Promise<void>;
}

function renderMessageContent(text: string) {
  // Check if message is an image attachment: [Image: name] (dataUrl)
  const image = parseImage(text);
  if (image) {
    return (
      <div className="bubble-image">
        <img
          loading="lazy"
          decoding="async"
          src={image.src}
          alt={image.filename}
        />
        <span className="bubble-image-name">📷 {image.filename}</span>
      </div>
    );
  }

  return <span className="bubble-text">{text}</span>;
}

interface MessageRowProps {
  message: Message;
  outgoing: boolean;
  runStart: boolean;
  runEnd: boolean;
  avatarSrc: string;
  avatarAlt: string;
}

// Memoised so appending a message renders one new row instead of every row.
const MessageRow = memo(function MessageRow({
  message,
  outgoing,
  runStart,
  runEnd,
  avatarSrc,
  avatarAlt,
}: MessageRowProps) {
  const runClasses =
    (runStart ? " message-group--run-start" : "") +
    (runEnd ? " message-group--run-end" : "");

  if (outgoing) {
    const pending = isPending(message);
    return (
      <div
        className={`message-group message-group--outgoing${runClasses}${
          pending ? " message-group--pending" : ""
        }`}
      >
        <div className="bubble bubble--outgoing">
          {renderMessageContent(message.message)}
          <span className="bubble-meta">
            {formatTime(message.createdAt)} {pending ? <PendingClock /> : <CheckMarks />}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`message-group message-group--incoming${runClasses}`}>
      {runEnd ? (
        <img
          className="avatar avatar--message"
          loading="lazy"
          decoding="async"
          src={avatarSrc}
          alt={avatarAlt}
        />
      ) : (
        <span className="avatar--message avatar--spacer" aria-hidden="true" />
      )}
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
  searchQuery = "",
  onSend,
}: ChatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const firstLoadRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Reset scroll tracking when switching conversations.
  useEffect(() => {
    firstLoadRef.current = true;
    nearBottomRef.current = true;
    setShowJump(false);
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
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    setShowJump(!near);
  }, []);

  const jumpToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const otherAvatarSrc = avatarFor(otherUser);
  const otherName = otherUser?.displayName ?? "Contact";

  const rows = useMemo<ReactNode[]>(() => {
    const nextRows: ReactNode[] = [];
    let lastKey = 0;

    messages.forEach((msg, i) => {
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
          runStart={!sameRun(messages[i - 1], msg)}
          runEnd={!sameRun(msg, messages[i + 1])}
          avatarSrc={otherAvatarSrc}
          avatarAlt={otherName}
        />,
      );
    });

    return nextRows;
  }, [messages, currentUserId, otherAvatarSrc, otherName]);

  const trimmedQuery = searchQuery.trim();

  return (
    <div className="chat">
      <div className="chat-body">
        <div
          className="chat-messages"
          ref={containerRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading && (
            <div className="chat-placeholder">
              <div className="auth-spinner auth-spinner--small" />
              <span>Loading messages…</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="chat-placeholder">
              {trimmedQuery ? (
                <span>No messages match "{trimmedQuery}".</span>
              ) : (
                <>
                  <img className="avatar avatar--placeholder" src={otherAvatarSrc} alt="" />
                  <strong>Start your conversation with {otherName}</strong>
                  <span>Say hi! 👋</span>
                </>
              )}
            </div>
          )}

          {rows}

          <div ref={bottomRef} />
        </div>

        {showJump && (
          <button
            type="button"
            className="jump-latest"
            onClick={jumpToLatest}
            aria-label="Jump to latest message"
            title="Jump to latest"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <MessageInput
        key={otherUser?.id}
        onSend={onSend}
        disabled={!otherUser}
        placeholder={otherUser ? `Message ${otherUser.displayName}…` : "Type a message…"}
      />
    </div>
  );
}

export default Chat;
