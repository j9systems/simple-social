"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/upload", label: "Upload" },
  { href: "/profile", label: "Profile" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(hasSupabaseEnv);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) {
        router.replace("/login");
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const email = useMemo(() => session?.user.email ?? "Logged in user", [session]);

  if (checkingAuth) {
    return (
      <main className="page-wrap">
        <p>Checking session...</p>
      </main>
    );
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="page-wrap auth-page">
        <section className="card">
          <h1>Supabase not configured</h1>
          <p>
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            in <code>.env.local</code>.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-copy">
          <strong>Simple Social</strong>
          <span>{email}</span>
        </div>
        <button
          className="secondary-button"
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          type="button"
        >
          Log out
        </button>
      </header>

      <main className="page-wrap">{children}</main>

      <nav aria-label="Primary" className="tab-bar">
        {tabs.map((tab) => (
          <Link
            className={pathname === tab.href ? "tab-link active" : "tab-link"}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
