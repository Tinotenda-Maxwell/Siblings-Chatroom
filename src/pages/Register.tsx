// src/pages/Register.tsx
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const email = form.email.trim();
    const username = form.username.trim().toLowerCase();
    const displayName = form.username.trim();

    // 1. Create the auth account with user_metadata
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
      },
    });

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? "Sign up failed. Please try again.");
      setLoading(false);
      return;
    }

    // 2. Insert the profile row into public.profiles
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: authData.user.id,
        username,
        display_name: displayName,
        avatar_url: null,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.warn("Profile creation note:", profileError.message);
    }

    // 3. Sign out so user logs in cleanly
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="sidebar-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                fill="white"
                fillOpacity="0.9"
              />
            </svg>
          </div>
          <h1 className="auth-title">Sibling Chat</h1>
        </div>

        <p className="auth-subtitle">Create your account to get started</p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-username">
              Username
            </label>
            <input
              id="reg-username"
              className="auth-input"
              type="text"
              name="username"
              placeholder="e.g. maxwell99"
              value={form.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              className="auth-input"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              className="auth-input"
              type="password"
              name="password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <button
            id="register-submit"
            className="auth-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="auth-link-text">
          Already have an account?{" "}
          <Link className="auth-link" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
