// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import type { Session } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // 2. Listen for auth changes (SIGNED_IN, SIGNED_OUT, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Still checking session
  if (session === undefined) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
      </div>
    );
  }

  // If signed out, redirect to /login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
