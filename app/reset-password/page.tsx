"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash.
    // The client library picks it up automatically and establishes a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if we already have a session (e.g. if the event fired before mount)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.replace("/");
    }, 2000);
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
        <h1>Reset Password</h1>

        {success ? (
          <p className="auth-message" style={{ color: "var(--accent)" }}>
            Password updated! Redirecting you now...
          </p>
        ) : !ready ? (
          <p className="auth-message" style={{ color: "var(--muted)" }}>
            Verifying your reset link...
          </p>
        ) : (
          <form className="auth-form" onSubmit={handleReset}>
            <label htmlFor="new-password">New password</label>
            <input
              autoComplete="new-password"
              id="new-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />

            <label htmlFor="confirm-password">Confirm password</label>
            <input
              autoComplete="new-password"
              id="confirm-password"
              minLength={6}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Updating..." : "Update password"}
            </button>

            {error ? <p className="auth-message">{error}</p> : null}
          </form>
        )}
      </section>
    </main>
  );
}
