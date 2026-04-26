"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { createNotification } from "@/lib/notifications";
import { isMissingColumnError, isMissingFullNameColumnError, isMissingTableError } from "@/lib/supabase-errors";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { FeedPost, ProfileRecord } from "@/lib/types";

const FEED_FIELDS =
  "id,user_id,image_url,caption,created_at,username,avatar_url,like_count,comment_count";

type ProfileViewProps = {
  username?: string;
};

type ProfileCacheSnapshot = {
  cachedAt: number;
  viewer: User | null;
  profile: ProfileRecord | null;
  posts: FeedPost[];
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  hasPendingFollowRequest: boolean;
  isPrivate: boolean;
};

const PROFILE_CACHE_TTL_MS = 3 * 60 * 1000;
const profileCacheByKey = new Map<string, ProfileCacheSnapshot>();

export default function ProfileView({ username }: ProfileViewProps) {
  const profileCacheKey = username ? `u:${username}` : "self";
  const initialProfileCache = profileCacheByKey.get(profileCacheKey) ?? null;

  // If a fresh cache snapshot exists, use it to skip the loading spinner entirely.
  const cacheHit =
    initialProfileCache && Date.now() - initialProfileCache.cachedAt <= PROFILE_CACHE_TTL_MS;

  const [viewer, setViewer] = useState<User | null>(cacheHit ? initialProfileCache.viewer : null);
  const [profile, setProfile] = useState<ProfileRecord | null>(cacheHit ? initialProfileCache.profile : null);
  const [posts, setPosts] = useState<FeedPost[]>(cacheHit ? initialProfileCache.posts : []);
  const [followersCount, setFollowersCount] = useState(cacheHit ? initialProfileCache.followersCount : 0);
  const [followingCount, setFollowingCount] = useState(cacheHit ? initialProfileCache.followingCount : 0);
  const [isFollowing, setIsFollowing] = useState(cacheHit ? initialProfileCache.isFollowing : false);
  const [hasPendingFollowRequest, setHasPendingFollowRequest] = useState(cacheHit ? initialProfileCache.hasPendingFollowRequest : false);
  const [isPrivate, setIsPrivate] = useState(cacheHit ? initialProfileCache.isPrivate : false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv && !cacheHit);
  const [pendingFollowAction, setPendingFollowAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      if (!cacheHit) setLoading(true);
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

      const cacheAge = initialProfileCache ? Date.now() - initialProfileCache.cachedAt : Number.POSITIVE_INFINITY;
      const isCacheFresh = cacheAge <= PROFILE_CACHE_TTL_MS;
      const isCacheForViewer = initialProfileCache?.viewer?.id === userData.user.id;
      const isCacheForTargetProfile = username
        ? initialProfileCache?.profile?.username === username
        : initialProfileCache?.profile?.id === userData.user.id;

      if (initialProfileCache && isCacheFresh && isCacheForViewer && isCacheForTargetProfile) {
        setProfile(initialProfileCache.profile);
        setPosts(initialProfileCache.posts);
        setFollowersCount(initialProfileCache.followersCount);
        setFollowingCount(initialProfileCache.followingCount);
        setIsFollowing(initialProfileCache.isFollowing);
        setHasPendingFollowRequest(initialProfileCache.hasPendingFollowRequest);
        setIsPrivate(initialProfileCache.isPrivate);
        setLoading(false);
        return;
      }

      const resolveProfile = async () => {
        const attempts = [
          { fields: "id,username,avatar_url,full_name,is_private", hasPrivate: true },
          { fields: "id,username,avatar_url,full_name", hasPrivate: false },
          { fields: "id,username,avatar_url,is_private", hasPrivate: true },
          { fields: "id,username,avatar_url", hasPrivate: false },
        ] as const;

        for (const attempt of attempts) {
          const query = supabase.from("profiles").select(attempt.fields);
          const response = username
            ? await query.eq("username", username).maybeSingle()
            : await query.eq("id", userData.user.id).maybeSingle();

          if (!response.error) {
            const row = (response.data as (ProfileRecord & { is_private?: boolean | null }) | null) ?? null;
            return {
              profile: row ? { ...row, is_private: row.is_private ?? false } : null,
              error: null,
              hasPrivateColumn: attempt.hasPrivate,
            };
          }

          if (!isMissingFullNameColumnError(response.error) && !isMissingColumnError(response.error, "is_private")) {
            return { profile: null, error: response.error, hasPrivateColumn: attempt.hasPrivate };
          }
        }

        return { profile: null, error: { message: "Could not load profile." }, hasPrivateColumn: false };
      };

      const resolvedProfile = await resolveProfile();
      if (!mounted) {
        return;
      }

      if (resolvedProfile.error) {
        setError(resolvedProfile.error.message);
        setLoading(false);
        return;
      }

      const nextProfile = resolvedProfile.profile;
      if (!nextProfile) {
        setError(username ? `Profile @${username} was not found.` : "Profile not found.");
        setLoading(false);
        return;
      }

      const ownProfile = nextProfile.id === userData.user.id;
      setIsPrivate(Boolean(nextProfile.is_private));

      const [followersResponse, followingResponse, followStateResponse, pendingRequestResponse] = await Promise.all([
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
        ownProfile
          ? Promise.resolve({ data: null, error: null })
          : supabase
              .from("follow_requests")
              .select("requester_id")
              .eq("requester_id", userData.user.id)
              .eq("target_id", nextProfile.id)
              .eq("status", "pending")
              .maybeSingle(),
      ]);

      if (!mounted) {
        return;
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

      if (pendingRequestResponse.error) {
        if (!isMissingTableError(pendingRequestResponse.error, "follow_requests")) {
          setError(pendingRequestResponse.error.message);
        }
        setHasPendingFollowRequest(false);
      } else {
        setHasPendingFollowRequest(Boolean(pendingRequestResponse.data));
      }

      const isFollowingUser = Boolean(followStateResponse.data);
      const canViewPosts = ownProfile || !nextProfile.is_private || isFollowingUser || !resolvedProfile.hasPrivateColumn;
      if (!canViewPosts) {
        setPosts([]);
        setProfile(nextProfile);
        setLoading(false);
        return;
      }

      const postsResponse = await supabase
        .from("feed_posts")
        .select(FEED_FIELDS)
        .eq("user_id", nextProfile.id)
        .order("created_at", { ascending: false });

      if (!mounted) {
        return;
      }

      if (postsResponse.error) {
        setError(postsResponse.error.message);
      } else {
        setPosts((postsResponse.data as FeedPost[]) ?? []);
      }

      setProfile(nextProfile);
      setLoading(false);
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [initialProfileCache, profileCacheKey, username]);

  useEffect(() => {
    if (loading || error || !profile) {
      return;
    }

    profileCacheByKey.set(profileCacheKey, {
      cachedAt: Date.now(),
      viewer,
      profile,
      posts,
      followersCount,
      followingCount,
      isFollowing,
      hasPendingFollowRequest,
      isPrivate,
    });
  }, [
    error,
    followersCount,
    followingCount,
    hasPendingFollowRequest,
    isFollowing,
    isPrivate,
    loading,
    posts,
    profile,
    profileCacheKey,
    viewer,
  ]);

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

  const isOwnProfile = Boolean(viewer?.id && profile?.id && viewer.id === profile.id);
  const viewerMetadata = viewer?.user_metadata ?? {};
  const metadataFullName = typeof viewerMetadata.full_name === "string" ? viewerMetadata.full_name.trim() : "";
  const metadataUsername = typeof viewerMetadata.username === "string" ? viewerMetadata.username.trim() : "";
  const displayName =
    profile?.full_name?.trim() ||
    (isOwnProfile ? metadataFullName : "") ||
    profile?.username ||
    (isOwnProfile ? metadataUsername : "") ||
    viewer?.email?.split("@")[0] ||
    "Profile";
  const showSettings = isOwnProfile;
  const canViewPrivatePosts = isOwnProfile || !isPrivate || isFollowing;
  const followButtonLabel = pendingFollowAction
    ? "Updating..."
    : isFollowing
      ? "Following"
      : isPrivate
        ? hasPendingFollowRequest
          ? "Requested"
          : "Request to follow"
        : "Follow";
  const usernameLabel =
    profile?.username ?? (isOwnProfile && metadataUsername ? metadataUsername : viewer?.email?.split("@")[0] ?? "profile");
  const followersHref = isOwnProfile
    ? "/profile/followers"
    : profile?.username
      ? `/u/${profile.username}/followers`
      : null;
  const followingHref = isOwnProfile
    ? "/profile/following"
    : profile?.username
      ? `/u/${profile.username}/following`
      : null;

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
        setHasPendingFollowRequest(false);
        setFollowersCount((count) => Math.max(0, count - 1));
      }
      setPendingFollowAction(false);
      return;
    }

    if (isPrivate) {
      if (hasPendingFollowRequest) {
        const nowIso = new Date().toISOString();
        const { error: cancelError } = await supabase
          .from("follow_requests")
          .update({
            status: "canceled",
            responded_at: nowIso,
            updated_at: nowIso,
          })
          .eq("requester_id", viewer.id)
          .eq("target_id", profile.id)
          .eq("status", "pending");

        if (cancelError) {
          if (isMissingTableError(cancelError, "follow_requests")) {
            setError("Follow requests are unavailable. Please run the latest database migration.");
          } else {
            setError(cancelError.message);
          }
        } else {
          setHasPendingFollowRequest(false);
        }

        setPendingFollowAction(false);
        return;
      }

      const nowIso = new Date().toISOString();
      const { error: requestError } = await supabase.from("follow_requests").upsert(
        {
          requester_id: viewer.id,
          target_id: profile.id,
          status: "pending",
          responded_at: null,
          updated_at: nowIso,
        },
        { onConflict: "requester_id,target_id" },
      );

      if (requestError) {
        if (isMissingTableError(requestError, "follow_requests")) {
          setError("Follow requests are unavailable. Please run the latest database migration.");
        } else {
          setError(requestError.message);
        }
      } else {
        setHasPendingFollowRequest(true);
        await createNotification({
          type: "follow_request",
          recipientUserId: profile.id,
          actorUserId: viewer.id,
        });
      }

      setPendingFollowAction(false);
      return;
    }

    const { error: followError } = await supabase.from("follows").upsert(
      {
        follower_id: viewer.id,
        following_id: profile.id,
      },
      { onConflict: "follower_id,following_id" },
    );

    if (followError) {
      setError(followError.message);
    } else {
      setIsFollowing(true);
      setHasPendingFollowRequest(false);
      setFollowersCount((count) => count + 1);
      void createNotification({
        type: "follow",
        recipientUserId: profile.id,
        actorUserId: viewer.id,
      });
    }

    setPendingFollowAction(false);
  };

  if (!hasSupabaseEnv) {
    return (
      <section className="profile-page">
        <p>Supabase env vars are missing.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="profile-page">
        <div aria-live="polite" className="feed-loading" role="status">
          <span aria-hidden="true" className="loading-spinner" />
          <span className="visually-hidden">Loading profile...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="profile-page">
        <p>{error}</p>
      </section>
    );
  }

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
        <header className="profile-header">
          <img
            alt={`${displayName} avatar`}
            className="avatar profile-avatar"
            src={buildAvatarSrc(profile?.avatar_url, avatarVersion)}
          />
          <div className="profile-copy">
            <h1>{displayName}</h1>
            <p className="profile-username">@{usernameLabel}</p>
            <p className="profile-stats">
              {followersHref ? (
                <Link className="profile-stat-link" href={followersHref}>
                  {followersCount} followers
                </Link>
              ) : (
                <span>{followersCount} followers</span>
              )}
              {followingHref ? (
                <Link className="profile-stat-link" href={followingHref}>
                  {followingCount} following
                </Link>
              ) : (
                <span>{followingCount} following</span>
              )}
            </p>
          </div>
        </header>
      </div>
      {!isOwnProfile && profile ? (
        <div className="profile-actions">
          <button
            className={isFollowing || hasPendingFollowRequest ? "secondary-button" : "primary-button"}
            disabled={pendingFollowAction}
            onClick={toggleFollow}
            type="button"
          >
            {followButtonLabel}
          </button>
        </div>
      ) : null}

      {!canViewPrivatePosts ? (
        <div className="profile-private-state">
          <span aria-hidden="true" className="profile-private-lock">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3H9Z" />
            </svg>
          </span>
          <p>This user is private, request to follow to view their posts</p>
        </div>
      ) : null}

      {canViewPrivatePosts && posts.length === 0 ? <p>No posts yet.</p> : null}

      <hr aria-hidden="true" className="profile-separator" />

      {canViewPrivatePosts ? (
        <div className="profile-grid">
          {posts.map((post) => (
            <Link aria-label="Open post details" className="profile-grid-link" href={`/p/${post.id}`} key={post.id}>
              <img alt={post.caption ?? "Profile post"} className="profile-grid-image" src={post.image_url} />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
