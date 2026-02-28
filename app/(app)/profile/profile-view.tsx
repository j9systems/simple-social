"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { FeedPost, ProfileRecord } from "@/lib/types";

const FEED_FIELDS =
  "id,user_id,image_url,caption,created_at,username,avatar_url,like_count,comment_count";

type ProfileViewProps = {
  username?: string;
};

export default function ProfileView({ username }: ProfileViewProps) {
  const [viewer, setViewer] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [pendingFollowAction, setPendingFollowAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!userData.user) {
        setError("You need to be logged in to view profiles.");
        setLoading(false);
        return;
      }

      setViewer(userData.user);

      const profileQuery = supabase.from("profiles").select("id,username,avatar_url");
      const profileResponse = username
        ? await profileQuery.eq("username", username).maybeSingle()
        : await profileQuery.eq("id", userData.user.id).maybeSingle();

      if (!mounted) {
        return;
      }

      if (profileResponse.error) {
        setError(profileResponse.error.message);
        setLoading(false);
        return;
      }

      const nextProfile = profileResponse.data as ProfileRecord | null;
      if (!nextProfile) {
        setError(username ? `Profile @${username} was not found.` : "Profile not found.");
        setLoading(false);
        return;
      }

      const ownProfile = nextProfile.id === userData.user.id;

      const [postsResponse, followersResponse, followingResponse, followStateResponse] = await Promise.all([
        supabase.from("feed_posts").select(FEED_FIELDS).eq("user_id", nextProfile.id).order("created_at", {
          ascending: false,
        }),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", nextProfile.id),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", nextProfile.id),
        ownProfile
          ? Promise.resolve({ data: null, error: null })
          : supabase
              .from("follows")
              .select("follower_id")
              .eq("follower_id", userData.user.id)
              .eq("following_id", nextProfile.id)
              .maybeSingle(),
      ]);

      if (!mounted) {
        return;
      }

      if (postsResponse.error) {
        setError(postsResponse.error.message);
      } else {
        setPosts((postsResponse.data as FeedPost[]) ?? []);
      }

      if (followersResponse.error) {
        setError(followersResponse.error.message);
      } else {
        setFollowersCount(followersResponse.count ?? 0);
      }

      if (followingResponse.error) {
        setError(followingResponse.error.message);
      } else {
        setFollowingCount(followingResponse.count ?? 0);
      }

      if (followStateResponse.error) {
        setError(followStateResponse.error.message);
      } else {
        setIsFollowing(Boolean(followStateResponse.data));
      }

      setProfile(nextProfile);
      setLoading(false);
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [username]);

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

  const displayName = useMemo(() => {
    if (profile?.username) {
      return profile.username;
    }
    return viewer?.email?.split("@")[0] ?? "Profile";
  }, [profile?.username, viewer?.email]);

  const isOwnProfile = Boolean(viewer?.id && profile?.id && viewer.id === profile.id);
  const showSettings = isOwnProfile;
  const usernameLabel = profile?.username ?? viewer?.email?.split("@")[0] ?? "profile";

  const toggleFollow = async () => {
    if (!viewer?.id || !profile?.id || isOwnProfile || pendingFollowAction) {
      return;
    }

    setPendingFollowAction(true);
    setError(null);

    if (isFollowing) {
      if (!window.confirm("Unfollow?")) {
        setPendingFollowAction(false);
        return;
      }

      const { error: unfollowError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", viewer.id)
        .eq("following_id", profile.id);

      if (unfollowError) {
        setError(unfollowError.message);
      } else {
        setIsFollowing(false);
        setFollowersCount((count) => Math.max(0, count - 1));
      }
      setPendingFollowAction(false);
      return;
    }

    const { error: followError } = await supabase.from("follows").insert({
      follower_id: viewer.id,
      following_id: profile.id,
    });

    if (followError) {
      setError(followError.message);
    } else {
      setIsFollowing(true);
      setFollowersCount((count) => count + 1);
    }

    setPendingFollowAction(false);
  };

  return (
    <section className="profile-page">
      <div className="profile-header-area">
        {showSettings ? (
          <Link aria-label="Profile settings" className="icon-button profile-settings-button" href="/profile/settings">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M19.14 12.94a7.7 7.7 0 0 0 .06-.94 7.7 7.7 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.13.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.85a.5.5 0 0 0 .12.63l2.03 1.58a7.7 7.7 0 0 0-.06.94 7.7 7.7 0 0 0 .06.94L2.82 14.52a.5.5 0 0 0-.12.63l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.13-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
          </Link>
        ) : null}
        <header className="profile-header card">
          <img
            alt={`${displayName} avatar`}
            className="avatar profile-avatar"
            src={buildAvatarSrc(profile?.avatar_url, avatarVersion)}
          />
          <div className="profile-copy">
            <h1>{displayName}</h1>
            <p className="profile-username">@{usernameLabel}</p>
            <p className="profile-stats">
              <span>{followersCount} followers</span>
              <span>{followingCount} following</span>
            </p>
          </div>
        </header>
      </div>
      {!isOwnProfile && profile ? (
        <div className="profile-actions">
          <button className={isFollowing ? "secondary-button" : "primary-button"} onClick={toggleFollow} type="button">
            {pendingFollowAction ? "Updating..." : isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      ) : null}

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
