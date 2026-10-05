// src/App.tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Split each route into its own chunk so the login screen doesn't download
// the chat UI (and vice versa).
const ChatPage = lazy(() => import("./pages/ChatPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

const routeFallback = (
  <div className="auth-loading">
    <div className="auth-spinner" />
  </div>
);

function App() {
  return (
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
  );
}

export default App;
