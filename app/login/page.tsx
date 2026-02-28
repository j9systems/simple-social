"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/");
  };

  const signUp = async () => {
    if (!hasSupabaseEnv) {
      return;
    }
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setError("Account created. If email confirmation is enabled, verify your inbox before signing in.");
  };

  return (
    <main className="page-wrap auth-page">
      <section className="card">
        <h1>Login</h1>
        <p>Sign in to access Simple Social.</p>
        {!hasSupabaseEnv ? (
          <p className="auth-message">
            Missing Supabase env vars. Add values in <code>.env.local</code> first.
          </p>
        ) : null}

        <form className="auth-form" onSubmit={signIn}>
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
            autoComplete="current-password"
            id="password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          <button className="primary-button" disabled={loading || !hasSupabaseEnv} type="submit">
            {loading ? "Working..." : "Sign in"}
          </button>
        </form>

        <button
          className="secondary-button"
          disabled={loading || !hasSupabaseEnv}
          onClick={signUp}
          type="button"
        >
          Create account
        </button>

        {error ? <p className="auth-message">{error}</p> : null}
      </section>
    </main>
  );
}
