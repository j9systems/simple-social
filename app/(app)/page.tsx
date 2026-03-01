"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { FeedPost } from "@/lib/types";

const FEED_FIELDS =
  "id,user_id,image_url,caption,created_at,username,avatar_url,like_count,comment_count";

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M16.8 4.8c2.7 0 4.7 2.1 4.7 4.8 0 4.4-4.3 7.6-8.4 11.2a1.2 1.2 0 0 1-1.6 0C7.4 17.2 3 14 3 9.6 3 7 5 4.8 7.7 4.8c1.6 0 3.1.8 4.1 2.1 1-1.3 2.5-2.1 4.1-2.1Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4.5 5.3A2.8 2.8 0 0 1 7.3 2.5h9.4a2.8 2.8 0 0 1 2.8 2.8v8a2.8 2.8 0 0 1-2.8 2.8h-7l-4 3.4a.7.7 0 0 1-1.2-.5v-2.9A2.8 2.8 0 0 1 1.7 13.3v-8A2.8 2.8 0 0 1 4.5 5.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [error, setError] = useState<string | null>(null);
  const lastImageTapAtRef = useRef<Record<string, number>>({});

  const toggleLike = useCallback((postId: string) => {
    setLikedPostIds((current) => ({
      ...current,
      [postId]: !current[postId],
    }));
  }, []);

  const handleImageTap = useCallback((postId: string, eventTimeStamp: number) => {
    const now = eventTimeStamp;
    const lastTapAt = lastImageTapAtRef.current[postId] ?? 0;
    const isDoubleTap = now - lastTapAt < 300;

    if (isDoubleTap) {
      toggleLike(postId);
      lastImageTapAtRef.current[postId] = 0;
      return;
    }

    lastImageTapAtRef.current[postId] = now;
  }, [toggleLike]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadFeed = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (userError) {
        setError(userError.message);
        setPosts([]);
        setLoading(false);
        return;
      }

      if (!userData.user) {
        setError("You need to be logged in to view your feed.");
        setPosts([]);
        setLoading(false);
        return;
      }

      const viewerId = userData.user.id;
      const { data: followsData, error: followsError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId);

      if (!mounted) {
        return;
      }

      if (followsError) {
        setError(followsError.message);
        setPosts([]);
        setLoading(false);
        return;
      }

      const allowedUserIds = [
        viewerId,
        ...((followsData ?? []).map((row) => row.following_id).filter(Boolean) as string[]),
      ];

      const { data, error: feedError } = await supabase
        .from("feed_posts")
        .select(FEED_FIELDS)
        .in("user_id", allowedUserIds)
        .order("created_at", { ascending: false });

      if (!mounted) {
        return;
      }

      if (feedError) {
        setError(feedError.message);
        setPosts([]);
      } else {
        setPosts((data as FeedPost[]) ?? []);
      }

      setLoading(false);
    };

    loadFeed();

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

  const content = useMemo(() => {
    if (!hasSupabaseEnv) {
      return <p>Supabase env vars are missing.</p>;
    }
    if (loading) {
      return <p>Loading feed...</p>;
    }
    if (error) {
      return <p>{error}</p>;
    }
    if (posts.length === 0) {
      return <p>No posts yet.</p>;
    }

    return (
      <div className="feed-list">
        {posts.map((post) => {
          const liked = Boolean(likedPostIds[post.id]);
          const displayedLikeCount = post.like_count + (liked ? 1 : 0);

          return (
            <article className="feed-post" key={post.id}>
            <header className="feed-post-header">
              {post.username ? (
                <Link className="feed-user-link" href={`/u/${post.username}`}>
                  <img
                    alt={`${post.username} avatar`}
                    className="avatar"
                    src={buildAvatarSrc(post.avatar_url, avatarVersion)}
                  />
                  <div className="feed-post-meta">
                    <strong>{post.username}</strong>
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                </Link>
              ) : (
                <>
                  <img
                    alt="User avatar"
                    className="avatar"
                    src={buildAvatarSrc(post.avatar_url, avatarVersion)}
                  />
                  <div className="feed-post-meta">
                    <strong>Unknown user</strong>
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                </>
              )}
            </header>

            <img
              alt={post.caption ?? "Post image"}
              className="feed-image"
              onClick={(event) => handleImageTap(post.id, event.timeStamp)}
              src={post.image_url}
            />

            <div className="feed-actions">
              <button
                aria-label={liked ? "Unlike post" : "Like post"}
                className={`feed-action-button ${liked ? "is-liked" : ""}`}
                onClick={() => toggleLike(post.id)}
                type="button"
              >
                <HeartIcon filled={liked} />
              </button>
              <button
                aria-label="Comment"
                className="feed-action-button"
                type="button"
              >
                <CommentIcon />
              </button>
            </div>

            {post.caption ? <p className="feed-caption">{post.caption}</p> : null}

            <footer className="feed-stats">
              <span>{displayedLikeCount} likes</span>
              <span>{post.comment_count} comments</span>
            </footer>
            </article>
          );
        })}
      </div>
    );
  }, [avatarVersion, error, handleImageTap, likedPostIds, loading, posts, toggleLike]);

  return (
    <section className="home-page">
      {content}
    </section>
  );
}
