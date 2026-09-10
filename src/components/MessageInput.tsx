// src/components/MessageInput.tsx
import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
}

const EMOJI_LIST = ["😃", "💜", "🎉", "🥰", "🙌", "❤️", "👍", "🔥", "✨", "😊"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — images are inlined as data URLs

function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [sending, setSending] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    setText("");
    setShowEmojis(false);
    setSending(true);
    try {
      await onSend(trimmed);
    } catch {
      // Restore the draft so a failed send doesn't lose the message.
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Only image attachments are supported right now.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert("That image is too large — please choose one under 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      void onSend(`[Image: ${file.name}] (${reader.result as string})`);
    };
    reader.readAsDataURL(file);
  };

  const canSend = !disabled && !sending && text.trim().length > 0;

  return (
    <div className="message-input-bar">
      {/* Hidden file input for attachment / plus button */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Emoji Picker Popover */}
      {showEmojis && (
        <div
          ref={emojiRef}
          style={{
            position: "absolute",
            bottom: "60px",
            right: "50px",
            backgroundColor: "#14101c",
            border: "1px solid #221d2c",
            borderRadius: "16px",
            padding: "10px",
            display: "flex",
            gap: "8px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            zIndex: 50,
          }}
        >
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              style={{
                fontSize: "18px",
                padding: "4px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <button
        className="round-button round-button--plus"
        type="button"
        aria-label="Add attachment"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Add image"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <input
        id="message-input"
        className="message-input"
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        autoComplete="off"
      />

      <button
        className="icon-button"
        type="button"
        aria-label="Emoji"
        onClick={() => setShowEmojis(!showEmojis)}
        title="Insert emoji"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
          <path
            d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <button
        className="icon-button"
        type="button"
        aria-label="Attach image"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Attach image"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 10.5l-8.4 8.4a4.5 4.5 0 01-6.36-6.36l8.4-8.4a3 3 0 014.24 4.24l-8.4 8.4a1.5 1.5 0 01-2.12-2.12l7.77-7.77"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        className="round-button round-button--send"
        type="button"
        aria-label="Send message"
        onClick={handleSend}
        disabled={!canSend}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 12L20 4L13 20L11 13L4 12Z" fill="white" />
        </svg>
      </button>
    </div>
  );
}

export default MessageInput;
