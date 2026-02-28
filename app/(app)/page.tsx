"use client";

import { useEffect, useMemo, useState } from "react";
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
              <img
                alt={`${post.username ?? "User"} avatar`}
                className="avatar"
                src={post.avatar_url || "/next.svg"}
              />
              <div className="feed-post-meta">
                <strong>{post.username ?? "Unknown user"}</strong>
                <span>{formatDate(post.created_at)}</span>
              </div>
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
  }, [error, loading, posts]);

  return (
    <section>
      <h1>Home</h1>
      {content}
    </section>
  );
}
