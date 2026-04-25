"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isPushSupported, subscribeToPush } from "@/lib/push-notifications";
import { isMissingFullNameColumnError } from "@/lib/supabase-errors";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

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
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
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

  useEffect(() => {
    if (!hasSupabaseEnv || mode !== "signup") {
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      setUsernameStatus("checking");

      const { data, error: usernameError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", trimmedUsername)
        .limit(1);

      if (cancelled) {
        return;
      }

      if (usernameError) {
        setUsernameStatus("error");
        return;
      }

      setUsernameStatus(data && data.length > 0 ? "taken" : "available");
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [mode, username]);

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

    const trimmedFullName = fullName.trim();
    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedFullName) {
      setError("Name is required.");
      return;
    }

    if (!trimmedUsername) {
      setError("Username is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const { data: takenData, error: takenError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", trimmedUsername)
      .limit(1);

    if (takenError) {
      setLoading(false);
      setError(takenError.message);
      return;
    }

    if (takenData && takenData.length > 0) {
      setLoading(false);
      setUsernameStatus("taken");
      setError("That username is already taken.");
      return;
    }

    const persistProfile = async (userId: string) => {
      const payloadWithFullName = {
        id: userId,
        username: trimmedUsername,
        full_name: trimmedFullName,
      };

      const primaryUpsertResponse = await supabase.from("profiles").upsert(payloadWithFullName, { onConflict: "id" });

      if (!primaryUpsertResponse.error) {
        return;
      }

      if (!isMissingFullNameColumnError(primaryUpsertResponse.error)) {
        throw primaryUpsertResponse.error;
      }

      const fallbackUpsertResponse = await supabase.from("profiles").upsert(
        {
          id: userId,
          username: trimmedUsername,
        },
        { onConflict: "id" },
      );

      if (fallbackUpsertResponse.error) {
        throw fallbackUpsertResponse.error;
      }
    };

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: trimmedFullName,
          username: trimmedUsername,
        },
      },
    });

    if (signUpError) {
      setLoading(false);
      const friendlyError = getFriendlyAuthError(signUpError.message);
      if (friendlyError.toLowerCase().includes("duplicate key") && friendlyError.toLowerCase().includes("username")) {
        setUsernameStatus("taken");
        setError("That username is already taken.");
        return;
      }

      setError(friendlyError);
      return;
    }

    if (data.session) {
      const userId = data.user?.id ?? data.session.user.id;
      try {
        await persistProfile(userId);
      } catch (persistError) {
        setLoading(false);
        const message = persistError instanceof Error ? persistError.message : "Failed to save profile.";
        if (message.toLowerCase().includes("duplicate key") && message.toLowerCase().includes("username")) {
          setUsernameStatus("taken");
          setError("That username is already taken.");
          return;
        }
        setError(message);
        return;
      }

      setLoading(false);
      if (isPushSupported()) {
        void subscribeToPush();
      }
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

    const signedInUserId = data.user?.id;
    if (!signedInUserId) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError(userError?.message ?? "Signed in, but could not resolve user profile.");
        return;
      }
      try {
        await persistProfile(userData.user.id);
      } catch (persistError) {
        const message = persistError instanceof Error ? persistError.message : "Failed to save profile.";
        if (message.toLowerCase().includes("duplicate key") && message.toLowerCase().includes("username")) {
          setUsernameStatus("taken");
          setError("That username is already taken.");
          return;
        }
        setError(message);
        return;
      }
    } else {
      try {
        await persistProfile(signedInUserId);
      } catch (persistError) {
        const message = persistError instanceof Error ? persistError.message : "Failed to save profile.";
        if (message.toLowerCase().includes("duplicate key") && message.toLowerCase().includes("username")) {
          setUsernameStatus("taken");
          setError("That username is already taken.");
          return;
        }
        setError(message);
        return;
      }
    }

    setNotice("Account created. You are now signed in.");
    if (isPushSupported()) {
      void subscribeToPush();
    }
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
            aria-controls="auth-panel-login"
            aria-selected={mode === "login"}
            className={mode === "login" ? "auth-tab is-active" : "auth-tab"}
            id="auth-tab-login"
            onClick={() => {
              setMode("login");
              setError(null);
              setNotice(null);
              setUsernameStatus("idle");
            }}
            role="tab"
            type="button"
          >
            Log in
          </button>
          <button
            aria-controls="auth-panel-signup"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "auth-tab is-active" : "auth-tab"}
            id="auth-tab-signup"
            onClick={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
              setUsernameStatus(username.trim() ? "checking" : "idle");
            }}
            role="tab"
            type="button"
          >
            Sign up
          </button>
        </div>

        <form
          aria-labelledby={mode === "login" ? "auth-tab-login" : "auth-tab-signup"}
          className="auth-form"
          id={mode === "login" ? "auth-panel-login" : "auth-panel-signup"}
          onSubmit={mode === "login" ? signIn : signUp}
          role="tabpanel"
        >
          {mode === "signup" ? (
            <>
              <label htmlFor="full-name">Name</label>
              <input
                autoComplete="name"
                id="full-name"
                maxLength={80}
                onChange={(event) => setFullName(event.target.value)}
                required
                type="text"
                value={fullName}
              />

              <label htmlFor="username">Username</label>
              <div className="handle-input-wrap">
                <span aria-hidden="true" className="handle-input-prefix">
                  @
                </span>
                <input
                  autoComplete="username"
                  id="username"
                  maxLength={40}
                  onChange={(event) => {
                    const nextUsername = event.target.value.toLowerCase();
                    setUsername(nextUsername);
                    setUsernameStatus(nextUsername.trim() ? "checking" : "idle");
                  }}
                  required
                  type="text"
                  value={username}
                />
              </div>
              {username.trim() ? (
                <p className="auth-message">
                  {usernameStatus === "checking" ? "Checking username..." : null}
                  {usernameStatus === "available" ? "Username is available." : null}
                  {usernameStatus === "taken" ? "Username is already taken." : null}
                  {usernameStatus === "error" ? "Could not check username availability." : null}
                </p>
              ) : null}
            </>
          ) : null}

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
