// src/components/AuthProvider.tsx
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { clearCaches } from "../services/mappers";
import { SessionContext } from "../hooks/useSession";

// Resolves the auth session once for the whole app so routes don't each
// call getSession() and wait on it in sequence.
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    // Keep the Supabase client out of the app shell. The auth and chat
    // routes load it alongside their own chunks instead of blocking the
    // initial route code.
    void import("../services/supabase").then(({ supabase }) => {
      if (cancelled) return;

      // onAuthStateChange emits INITIAL_SESSION immediately, so a separate
      // getSession() call is unnecessary.
      const { data: listener } = supabase.auth.onAuthStateChange(
        (event, currentSession) => {
          if (event === "SIGNED_OUT") clearCaches();
          // Token refreshes hand us a new object for the same user; keep the
          // old reference so consumers don't re-run their effects.
          setSession((prev) =>
            prev && currentSession && prev.user.id === currentSession.user.id
              ? prev
              : currentSession,
          );
        },
      );
      unsubscribe = () => listener.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  );
}

export default AuthProvider;
