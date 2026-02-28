"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function HomePage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadFeed = async () => {
      setLoading(true);
      setError(null);

      const { data, error: feedError } = await supabase
        .from("feed_posts")
        .select(FEED_FIELDS)
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
        {posts.map((post) => (
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

            <img alt={post.caption ?? "Post image"} className="feed-image" src={post.image_url} />
            {post.caption ? <p className="feed-caption">{post.caption}</p> : null}

            <footer className="feed-stats">
              <span>{post.like_count} likes</span>
              <span>{post.comment_count} comments</span>
            </footer>
          </article>
        ))}
      </div>
    );
  }, [avatarVersion, error, loading, posts]);

  return (
    <section className="home-page">
      {content}
    </section>
  );
}
