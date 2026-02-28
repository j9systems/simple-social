"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUser(data.user);
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <h1>Profile</h1>
      {!hasSupabaseEnv ? (
        <p>Supabase env vars are missing. Update .env.local to load your profile.</p>
      ) : (
        <p>{user?.email ? `Signed in as ${user.email}` : "Loading profile..."}</p>
      )}
    </section>
  );
}
