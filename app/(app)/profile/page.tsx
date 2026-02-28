"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { FeedPost, ProfileRecord } from "@/lib/types";

const FEED_FIELDS =
  "id,user_id,image_url,caption,created_at,username,avatar_url,like_count,comment_count";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      setUser(userData.user);
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const [profileResponse, postsResponse] = await Promise.all([
        supabase.from("profiles").select("id,username,avatar_url").eq("id", userData.user.id).maybeSingle(),
        supabase.from("feed_posts").select(FEED_FIELDS).eq("user_id", userData.user.id).order("created_at", {
          ascending: false,
        }),
      ]);

      if (!mounted) {
        return;
      }

      if (profileResponse.error) {
        setError(profileResponse.error.message);
      } else {
        setProfile(profileResponse.data as ProfileRecord | null);
      }

      if (postsResponse.error) {
        setError(postsResponse.error.message);
      } else {
        setPosts((postsResponse.data as FeedPost[]) ?? []);
      }

      setLoading(false);
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const syncAvatarVersion = () => {
      setAvatarVersion(readAvatarVersion());
    };

    syncAvatarVersion();
    window.addEventListener(AVATAR_UPDATED_EVENT, syncAvatarVersion);

    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, syncAvatarVersion);
    };
  }, []);

  const displayName = profile?.username ?? user?.email?.split("@")[0] ?? "Profile";

  return (
    <section className="profile-page">
      <header className="profile-header card">
        <img
          alt={`${displayName} avatar`}
          className="avatar profile-avatar"
          src={buildAvatarSrc(profile?.avatar_url, avatarVersion)}
        />
        <div className="profile-copy">
          <h1>{displayName}</h1>
          <p>{posts.length} posts</p>
        </div>
        <Link className="secondary-button settings-link" href="/profile/settings">
          Settings
        </Link>
      </header>

      {!hasSupabaseEnv ? <p>Supabase env vars are missing.</p> : null}
      {loading ? <p>Loading profile...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && !error && posts.length === 0 ? <p>No posts yet.</p> : null}

      <div className="profile-grid">
        {posts.map((post) => (
          <img alt={post.caption ?? "Profile post"} className="profile-grid-image" key={post.id} src={post.image_url} />
        ))}
      </div>
    </section>
  );
}
