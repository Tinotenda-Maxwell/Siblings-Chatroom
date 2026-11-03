// src/components/MessageInput.tsx
import { useState, useRef, useEffect, useLayoutEffect, type KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

const EMOJI_LIST = ["😃", "💜", "🎉", "🥰", "🙌", "❤️", "👍", "🔥", "✨", "😊"];
const MAX_SOURCE_BYTES = 20 * 1024 * 1024; // original file, before compression
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — images are inlined as data URLs
const MAX_DIMENSION = 1280;
const MAX_INPUT_HEIGHT = 140; // px; the textarea scrolls beyond this

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Images travel inside the message row, so every thread load and realtime
// event carries them. Downscale and re-encode first — a typical phone photo
// drops from several MB to ~100–200 KB.
async function encodeImage(file: File): Promise<Blob> {
  // Re-encoding would drop GIF animation / SVG vectors.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no alpha; paint white so transparent areas don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Type a message…",
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content, up to MAX_INPUT_HEIGHT.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [text]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    // Sends are optimistic, so the field stays enabled and focused — the
    // user can keep typing while the previous message is confirmed.
    setText("");
    setShowEmojis(false);
    textareaRef.current?.focus();
    try {
      await onSend(trimmed);
    } catch {
      // Restore the draft so a failed send doesn't lose the message.
      setText((current) => (current ? current : trimmed));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. Ignore Enter while an IME
    // composition is active so confirming a candidate doesn't send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    } else if (e.key === "Escape" && showEmojis) {
      setShowEmojis(false);
    }
  };

  // Insert at the caret rather than always appending.
  const addEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  // Close emoji picker on click outside. The toggle button lives inside
  // emojiRef, so clicking it doesn't close-then-reopen the picker.
  useEffect(() => {
    if (!showEmojis) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojis]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Only image attachments are supported right now.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      window.alert("That image is too large — please choose one under 20 MB.");
      return;
    }

    setAttaching(true);
    try {
      const encoded = await encodeImage(file);
      if (encoded.size > MAX_IMAGE_BYTES) {
        window.alert("That image is too large — please choose one under 2 MB.");
        return;
      }

      const dataUrl = await readAsDataURL(encoded);
      // Failures are surfaced by the chat's error banner.
      Promise.resolve(onSend(`[Image: ${file.name}] (${dataUrl})`)).catch(() => {});
    } finally {
      setAttaching(false);
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="message-input-bar">
      {/* Hidden file input for the attachment button */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={(e) => void handleFileSelect(e)}
        style={{ display: "none" }}
      />

      <button
        className="round-button round-button--plus"
        type="button"
        aria-label="Attach image"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || attaching}
        title={attaching ? "Preparing image…" : "Attach image"}
      >
        {attaching ? (
          <span className="auth-spinner auth-spinner--tiny" />
        ) : (
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
        )}
      </button>

      <textarea
        id="message-input"
        ref={textareaRef}
        className="message-input"
        rows={1}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        aria-label="Message"
      />

      <div className="emoji-anchor" ref={emojiRef}>
        {showEmojis && (
          <div className="emoji-popover" role="listbox" aria-label="Emoji">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-item"
                onClick={() => addEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <button
          className={`icon-button${showEmojis ? " icon-button--active" : ""}`}
          type="button"
          aria-label="Emoji"
          aria-expanded={showEmojis}
          onClick={() => setShowEmojis((open) => !open)}
          disabled={disabled}
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
      </div>

      <button
        className="round-button round-button--send"
        type="button"
        aria-label="Send message"
        title="Send (Enter)"
        onClick={() => void handleSend()}
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
