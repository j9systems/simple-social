"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

function getFriendlyAuthError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("already registered") || lowerMessage.includes("already been registered")) {
    return "That email is already in use. Try logging in instead.";
  }

  if (lowerMessage.includes("email not confirmed")) {
    return "Email confirmation is still enabled in Supabase. Disable it to allow instant sign-up.";
  }

  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/");
      }
    };

    check();
  }, [router]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSupabaseEnv) {
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(getFriendlyAuthError(signInError.message));
      return;
    }

    router.replace("/");
  };

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSupabaseEnv) {
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setLoading(false);
      setError(getFriendlyAuthError(signUpError.message));
      return;
    }

    if (data.session) {
      setLoading(false);
      router.replace("/");
      return;
    }

    const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInAfterSignUpError) {
      setError(getFriendlyAuthError(signInAfterSignUpError.message));
      return;
    }

    setNotice("Account created. You are now signed in.");
    router.replace("/");
  };

  return (
    <main className="page-wrap auth-page">
      <section className="card">
        <Image
          alt="Simple Social"
          className="auth-wordmark"
          height={64}
          priority
          src="https://res.cloudinary.com/duy32f0q4/image/upload/v1772339914/ss_wordmark_htwmgq.svg"
          width={320}
        />
        <h1>Welcome</h1>
        <p>Log in or create an account to access Simple Social.</p>
        {!hasSupabaseEnv ? (
          <p className="auth-message">
            Missing Supabase env vars. Add values in <code>.env.local</code> first.
          </p>
        ) : null}

        <div className="auth-tabs" role="tablist" aria-label="Authentication options">
          <button
            aria-selected={mode === "login"}
            className={mode === "login" ? "auth-tab is-active" : "auth-tab"}
            onClick={() => {
              setMode("login");
              setError(null);
              setNotice(null);
            }}
            role="tab"
            type="button"
          >
            Log in
          </button>
          <button
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "auth-tab is-active" : "auth-tab"}
            onClick={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
            }}
            role="tab"
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={mode === "login" ? signIn : signUp}>
          <label htmlFor="email">Email</label>
          <input
            autoComplete="email"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label htmlFor="password">Password</label>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            id="password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <button className="primary-button" disabled={loading || !hasSupabaseEnv} type="submit">
            {loading ? "Working..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        {error ? <p className="auth-message">{error}</p> : null}
        {notice ? <p className="auth-message">{notice}</p> : null}
      </section>
    </main>
  );
}
