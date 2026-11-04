// src/App.tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthProvider from "./components/AuthProvider";

// Split each route into its own chunk so the login screen doesn't download
// the chat UI (and vice versa).
const loadChatPage = () => import("./pages/ChatPage");
const ChatPage = lazy(loadChatPage);
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

// The chat chunk is otherwise only requested after the session check
// resolves. Start downloading it right away so the two happen in parallel.
if (window.location.pathname === "/") void loadChatPage();

const routeFallback = (
  <div className="auth-loading">
    <div className="auth-spinner" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={routeFallback}>
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
