// src/services/storedSession.ts
import type { Session } from "@supabase/supabase-js";

// supabase-js persists the session in localStorage under
// `sb-<project-ref>-auth-token`. Reading it synchronously lets the app render
// the chat (from its local caches) on the first frame instead of waiting for
// the Supabase chunk to download and report INITIAL_SESSION. The real session
// from onAuthStateChange replaces this as soon as it arrives, and a missing or
// revoked session still redirects to /login at that point.
export function readStoredSession(): Session | undefined {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url) return undefined;
    const ref = new URL(url).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    return parsed?.user?.id && parsed.access_token ? (parsed as Session) : undefined;
  } catch {
    return undefined;
  }
}
