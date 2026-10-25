// src/hooks/useSession.ts
import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

// undefined = still resolving, null = signed out.
export const SessionContext = createContext<Session | null | undefined>(undefined);

export function useSession() {
  return useContext(SessionContext);
}
