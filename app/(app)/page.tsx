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
        d="M12 3.2c4.9 0 8.8 3.2 8.8 7.2s-3.9 7.2-8.8 7.2c-1 0-2-.1-2.9-.4l-3.6 2.1a.8.8 0 0 1-1.2-.8l.5-3.3c-1-1.3-1.6-2.9-1.6-4.8 0-4 3.9-7.2 8.8-7.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [likePendingIds, setLikePendingIds] = useState<Record<string, boolean>>({});
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [error, setError] = useState<string | null>(null);
  const lastImageTapAtRef = useRef<Record<string, number>>({});

  const toggleLike = useCallback(async (postId: string) => {
    if (!viewerId || likePendingIds[postId]) {
      return;
    }

    const liked = Boolean(likedPostIds[postId]);
    setLikePendingIds((current) => ({ ...current, [postId]: true }));

    const setPendingDone = () => {
      setLikePendingIds((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
    };

    if (liked) {
      setLikedPostIds((current) => ({ ...current, [postId]: false }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                like_count: Math.max(0, post.like_count - 1),
              }
            : post,
        ),
      );

      const { error: unlikeError } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", viewerId);

      if (unlikeError) {
        setLikedPostIds((current) => ({ ...current, [postId]: true }));
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  like_count: post.like_count + 1,
                }
              : post,
          ),
        );
      }

      setPendingDone();
      return;
    }

    setLikedPostIds((current) => ({ ...current, [postId]: true }));
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              like_count: post.like_count + 1,
            }
          : post,
      ),
    );

    const { error: likeError } = await supabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: viewerId });

    if (likeError) {
      setLikedPostIds((current) => ({ ...current, [postId]: false }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                like_count: Math.max(0, post.like_count - 1),
              }
            : post,
        ),
      );
    }

    setPendingDone();
  }, [likePendingIds, likedPostIds, viewerId]);

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
      setViewerId(viewerId);
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
        const nextPosts = (data as FeedPost[]) ?? [];
        setPosts(nextPosts);

        if (nextPosts.length > 0) {
          const postIds = nextPosts.map((post) => post.id);
          const { data: likesData, error: likesError } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", viewerId)
            .in("post_id", postIds);

          if (!mounted) {
            return;
          }

          if (likesError) {
            setError(likesError.message);
          } else {
            const likedLookup = Object.fromEntries(
              (likesData ?? []).map((row) => [row.post_id as string, true]),
            );
            setLikedPostIds(likedLookup);
          }
        } else {
          setLikedPostIds({});
        }
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
          const likePending = Boolean(likePendingIds[post.id]);
          const displayedLikeCount = post.like_count;

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
                disabled={likePending}
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
  }, [avatarVersion, error, handleImageTap, likePendingIds, likedPostIds, loading, posts, toggleLike]);

  return (
    <section className="home-page">
      {content}
    </section>
  );
}
