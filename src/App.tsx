// src/App.tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./services/supabase";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatPage from "./pages/ChatPage";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  // Persist and restore session across page refreshes
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // Auth state changes (login / logout) are handled inside
      // ProtectedRoute and ChatPage via getSession(), so no additional
      // action is required here. The listener just keeps the session
      // token refreshed automatically by the Supabase client.
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        {/* Catch-all — redirect unknown paths to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
