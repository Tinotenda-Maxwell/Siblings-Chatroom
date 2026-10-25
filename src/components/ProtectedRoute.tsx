// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const session = useSession();

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
