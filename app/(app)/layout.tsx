"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5v-9Z" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M11 4a7 7 0 1 0 4.4 12.5l4 4 1.4-1.4-4-4A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "Upload",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.4 0 8 2 8 4.5V21H4v-2.5C4 16 7.6 14 12 14Z" />
      </svg>
    ),
  },
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
        <Image
          alt="Simple Social"
          className={pathname === "/" ? "brand-logo brand-logo-home" : "brand-logo"}
          height={36}
          priority
          src="/logo-simple-social.svg"
          width={224}
        />
      </header>

      <main className="page-wrap">{children}</main>

      <nav aria-label="Primary" className="tab-bar">
        {tabs.map((tab) => (
          <Link
            className={
              pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                ? "tab-link active"
                : "tab-link"
            }
            href={tab.href}
            key={tab.href}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
