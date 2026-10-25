// src/services/mappers.ts
import type { Message } from "../types/message";
import type { Profile } from "../types/profile";

export const PROFILE_COLUMNS = "id, username, display_name, avatar_url, created_at";
export const MESSAGE_COLUMNS = "id, sender_id, receiver_id, message, created_at";

export function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    receiverId: row.receiver_id as string,
    message: row.message as string,
    createdAt: row.created_at as string,
  };
}

export function avatarFor(profile: Pick<Profile, "avatarUrl" | "username"> | null) {
  return (
    profile?.avatarUrl ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.username || "default"}`
  );
}

// Image attachments are stored inline as `[Image: name] (data:image/...)`.
const IMAGE_PATTERN = /^\[Image: (.*?)\] \((data:image\/.*)\)$/s;

export function parseImage(text: string): { filename: string; src: string } | null {
  // Cheap prefix check first so plain text never runs the regex.
  if (!text.startsWith("[Image: ")) return null;
  const match = text.match(IMAGE_PATTERN);
  return match ? { filename: match[1], src: match[2] } : null;
}

/** Short, human-readable preview (never a multi-megabyte data URL). */
export function previewText(text: string): string {
  const image = parseImage(text);
  return image ? `📷 ${image.filename}` : text;
}

// Tiny localStorage helpers for stale-while-revalidate caching. Storage can
// be unavailable (private mode, quota), so every access is guarded.
export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / availability errors — the cache is only an optimisation.
  }
}

export function clearCaches() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("sibling-chat:")) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
