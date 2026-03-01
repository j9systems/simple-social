"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { FeedComment, FeedPost } from "@/lib/types";

const FEED_FIELDS =
  "id,user_id,image_url,caption,created_at,username,avatar_url,like_count,comment_count";
const IMAGE_ZOOM_MIN_SCALE = 1;
const IMAGE_ZOOM_MAX_SCALE = 3;
const COMMENT_LONG_PRESS_MS = 550;

type PinchTouches = {
  length: number;
  [index: number]: { clientX: number; clientY: number };
};

function getPinchDistance(touches: PinchTouches) {
  if (touches.length < 2) {
    return 0;
  }

  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

type PostDetailViewProps = {
  postId: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string | null;
  created_at: string;
  content?: string | null;
  text?: string | null;
  body?: string | null;
  comment?: string | null;
  profiles?:
    | { username?: string | null; avatar_url?: string | null }
    | Array<{ username?: string | null; avatar_url?: string | null }>
    | null;
  username?: string | null;
  avatar_url?: string | null;
};

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

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

function extractCommentUsername(row: CommentRow): string | null {
  if (row.username) {
    return row.username;
  }

  if (Array.isArray(row.profiles)) {
    return row.profiles[0]?.username ?? null;
  }

  return row.profiles?.username ?? null;
}

function extractCommentAvatarUrl(row: CommentRow): string | null {
  if (row.avatar_url) {
    return row.avatar_url;
  }

  if (Array.isArray(row.profiles)) {
    return row.profiles[0]?.avatar_url ?? null;
  }

  return row.profiles?.avatar_url ?? null;
}

function normalizeComment(
  row: CommentRow,
  likeCount: number,
  fallbackUsername?: string | null,
  fallbackAvatarUrl?: string | null,
): FeedComment {
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    created_at: row.created_at,
    username: extractCommentUsername(row) ?? fallbackUsername ?? null,
    avatar_url: extractCommentAvatarUrl(row) ?? fallbackAvatarUrl ?? null,
    text: row.content ?? row.text ?? row.body ?? row.comment ?? "",
    like_count: likeCount,
  };
}

export default function PostDetailView({ postId }: PostDetailViewProps) {
  const router = useRouter();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);
  const [viewerAvatarUrl, setViewerAvatarUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [likedCommentIds, setLikedCommentIds] = useState<Record<string, boolean>>({});
  const [commentLikePendingIds, setCommentLikePendingIds] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentSubmitPending, setCommentSubmitPending] = useState(false);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);
  const [commentOwnerMenuId, setCommentOwnerMenuId] = useState<string | null>(null);
  const [commentDeletePendingId, setCommentDeletePendingId] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [error, setError] = useState<string | null>(null);
  const [pinchScale, setPinchScale] = useState(IMAGE_ZOOM_MIN_SCALE);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const pinchStartDistanceRef = useRef(0);
  const isPinchingRef = useRef(false);
  const ownerMenuRef = useRef<HTMLDivElement | null>(null);
  const ownerMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const commentLongPressTimeoutRef = useRef<number | null>(null);

  const loadComments = useCallback(async () => {
    if (!viewerId) {
      return;
    }

    setCommentsLoading(true);
    setCommentsError(null);

    let commentsResponse = await supabase
      .from("comments")
      .select("id,post_id,user_id,created_at,content,profiles(username,avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (commentsResponse.error) {
      commentsResponse = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
    }

    if (commentsResponse.error) {
      setCommentsError(commentsResponse.error.message);
      setCommentsLoading(false);
      return;
    }

    const commentRows = ((commentsResponse.data as CommentRow[]) ?? []).filter((row) => Boolean(row?.id));
    const commentIds = commentRows.map((comment) => comment.id);

    if (commentIds.length === 0) {
      setComments([]);
      setLikedCommentIds({});
      setCommentsLoading(false);
      return;
    }

    const { data: commentLikesData, error: commentLikesError } = await supabase
      .from("comment_likes")
      .select("comment_id,user_id")
      .in("comment_id", commentIds);

    if (commentLikesError) {
      setCommentsError(commentLikesError.message);
      setCommentsLoading(false);
      return;
    }

    const likesByCommentId = new Map<string, number>();
    const viewerLikedLookup: Record<string, boolean> = {};
    for (const like of commentLikesData ?? []) {
      const commentId = like.comment_id as string;
      const likeUserId = like.user_id as string;
      likesByCommentId.set(commentId, (likesByCommentId.get(commentId) ?? 0) + 1);
      if (likeUserId === viewerId) {
        viewerLikedLookup[commentId] = true;
      }
    }

    const missingProfileUserIds = Array.from(
      new Set(
        commentRows
          .filter((row) => (!extractCommentUsername(row) || !extractCommentAvatarUrl(row)) && Boolean(row.user_id))
          .map((row) => row.user_id as string),
      ),
    );

    const profileByUserId = new Map<string, { username: string | null; avatar_url: string | null }>();
    if (missingProfileUserIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", missingProfileUserIds);

      for (const row of profileRows ?? []) {
        const profileId = row.id as string | undefined;
        const profileUsername = row.username as string | null | undefined;
        const profileAvatarUrl = row.avatar_url as string | null | undefined;
        if (profileId) {
          profileByUserId.set(profileId, {
            username: profileUsername ?? null,
            avatar_url: profileAvatarUrl ?? null,
          });
        }
      }
    }

    const normalized = commentRows.map((row) => {
      const fallbackProfile = row.user_id ? profileByUserId.get(row.user_id) : null;
      return normalizeComment(
        row,
        likesByCommentId.get(row.id) ?? 0,
        fallbackProfile?.username,
        fallbackProfile?.avatar_url,
      );
    });
    setComments(normalized);
    setLikedCommentIds(viewerLikedLookup);
    setCommentsLoading(false);
  }, [postId, viewerId]);

  const toggleLike = useCallback(async () => {
    if (!viewerId || !post || likePending) {
      return;
    }

    const wasLiked = liked;
    setLikePending(true);
    setLiked(!wasLiked);
    setPost((current) =>
      current
        ? {
            ...current,
            like_count: wasLiked ? Math.max(0, current.like_count - 1) : current.like_count + 1,
          }
        : current,
    );

    if (wasLiked) {
      const { error: unlikeError } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", viewerId);

      if (unlikeError) {
        setLiked(true);
        setPost((current) =>
          current
            ? {
                ...current,
                like_count: current.like_count + 1,
              }
            : current,
        );
      }

      setLikePending(false);
      return;
    }

    const { error: likeError } = await supabase
      .from("post_likes")
      .insert({ post_id: post.id, user_id: viewerId });

    if (likeError) {
      setLiked(false);
      setPost((current) =>
        current
          ? {
              ...current,
              like_count: Math.max(0, current.like_count - 1),
            }
          : current,
      );
    }

    setLikePending(false);
  }, [liked, likePending, post, viewerId]);

  const openComments = useCallback(async () => {
    setCommentsOpen(true);
    await loadComments();
  }, [loadComments]);

  const closeComments = useCallback(() => {
    setCommentsOpen(false);
    setCommentsError(null);
    setCommentSubmitError(null);
    setCommentOwnerMenuId(null);
    setCommentDeletePendingId(null);
  }, []);

  const clearCommentLongPressTimeout = useCallback(() => {
    if (commentLongPressTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(commentLongPressTimeoutRef.current);
    commentLongPressTimeoutRef.current = null;
  }, []);

  const startCommentLongPress = useCallback((comment: FeedComment) => {
    if (!viewerId || comment.user_id !== viewerId) {
      return;
    }

    clearCommentLongPressTimeout();
    commentLongPressTimeoutRef.current = window.setTimeout(() => {
      setCommentOwnerMenuId((current) => (current === comment.id ? null : comment.id));
      commentLongPressTimeoutRef.current = null;
    }, COMMENT_LONG_PRESS_MS);
  }, [clearCommentLongPressTimeout, viewerId]);

  const cancelCommentLongPress = useCallback(() => {
    clearCommentLongPressTimeout();
  }, [clearCommentLongPressTimeout]);

  const toggleCommentLike = useCallback(async (commentId: string) => {
    if (!viewerId || commentLikePendingIds[commentId]) {
      return;
    }

    const currentlyLiked = Boolean(likedCommentIds[commentId]);
    setCommentLikePendingIds((current) => ({ ...current, [commentId]: true }));
    setLikedCommentIds((current) => ({ ...current, [commentId]: !currentlyLiked }));
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              like_count: currentlyLiked ? Math.max(0, comment.like_count - 1) : comment.like_count + 1,
            }
          : comment,
      ),
    );

    if (currentlyLiked) {
      const { error: unlikeError } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", viewerId);

      if (unlikeError) {
        setLikedCommentIds((current) => ({ ...current, [commentId]: true }));
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId
              ? { ...comment, like_count: comment.like_count + 1 }
              : comment,
          ),
        );
      }
    } else {
      const { error: likeError } = await supabase
        .from("comment_likes")
        .insert({ comment_id: commentId, user_id: viewerId });

      if (likeError) {
        setLikedCommentIds((current) => ({ ...current, [commentId]: false }));
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId
              ? { ...comment, like_count: Math.max(0, comment.like_count - 1) }
              : comment,
          ),
        );
      }
    }

    setCommentLikePendingIds((current) => {
      const next = { ...current };
      delete next[commentId];
      return next;
    });
  }, [commentLikePendingIds, likedCommentIds, viewerId]);

  const submitComment = useCallback(async () => {
    if (!viewerId || !post) {
      return;
    }

    const nextText = commentDraft.trim();
    if (!nextText || commentSubmitPending) {
      return;
    }

    setCommentSubmitPending(true);
    setCommentSubmitError(null);

    const payloadBase = {
      post_id: post.id,
      user_id: viewerId,
    };
    const columnCandidates: Array<"content" | "text" | "body" | "comment"> = ["content", "text", "body", "comment"];

    let insertedComment: CommentRow | null = null;
    let insertErrorMessage: string | null = null;
    for (const columnName of columnCandidates) {
      const insertResponse = await supabase
        .from("comments")
        .insert({ ...payloadBase, [columnName]: nextText })
        .select("*")
        .single();

      if (!insertResponse.error && insertResponse.data) {
        insertedComment = insertResponse.data as CommentRow;
        break;
      }

      const message = insertResponse.error?.message ?? "Failed to add comment.";
      insertErrorMessage = message;
      if (!message.toLowerCase().includes("column")) {
        break;
      }
    }

    setCommentSubmitPending(false);

    if (!insertedComment) {
      setCommentSubmitError(insertErrorMessage ?? "Failed to add comment.");
      return;
    }

    const normalizedComment = normalizeComment(
      {
        ...insertedComment,
        username: viewerUsername,
        avatar_url: viewerAvatarUrl,
      },
      0,
    );
    setComments((current) => [...current, normalizedComment]);
    setPost((current) =>
      current
        ? {
            ...current,
            comment_count: current.comment_count + 1,
          }
        : current,
    );
    setCommentDraft("");
  }, [commentDraft, commentSubmitPending, post, viewerAvatarUrl, viewerId, viewerUsername]);

  const deleteComment = useCallback(async (comment: FeedComment) => {
    if (!viewerId || comment.user_id !== viewerId || commentDeletePendingId === comment.id) {
      return;
    }

    if (!window.confirm("Delete this comment? This action cannot be undone.")) {
      return;
    }

    setCommentDeletePendingId(comment.id);
    setCommentsError(null);

    const { error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", viewerId);

    if (deleteError) {
      setCommentsError(deleteError.message);
      setCommentDeletePendingId(null);
      return;
    }

    setComments((current) => current.filter((entry) => entry.id !== comment.id));
    setPost((current) =>
      current
        ? { ...current, comment_count: Math.max(0, current.comment_count - 1) }
        : current,
    );
    setLikedCommentIds((current) => {
      const next = { ...current };
      delete next[comment.id];
      return next;
    });
    setCommentLikePendingIds((current) => {
      const next = { ...current };
      delete next[comment.id];
      return next;
    });
    setCommentOwnerMenuId(null);
    setCommentDeletePendingId(null);
  }, [commentDeletePendingId, viewerId]);

  const handleImagePinchStart = useCallback((event: TouchEvent<HTMLImageElement>) => {
    if (event.touches.length < 2) {
      return;
    }

    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }

    isPinchingRef.current = true;
    pinchStartDistanceRef.current = getPinchDistance(event.touches);
    setPinchScale(IMAGE_ZOOM_MIN_SCALE);
  }, []);

  const handleImagePinchMove = useCallback((event: TouchEvent<HTMLImageElement>) => {
    if (!isPinchingRef.current || event.touches.length < 2 || pinchStartDistanceRef.current <= 0) {
      return;
    }

    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }

    const distance = getPinchDistance(event.touches);
    const nextScale = Math.max(
      IMAGE_ZOOM_MIN_SCALE,
      Math.min(IMAGE_ZOOM_MAX_SCALE, distance / pinchStartDistanceRef.current),
    );
    setPinchScale(nextScale);
  }, []);

  const handleImagePinchEnd = useCallback((event: TouchEvent<HTMLImageElement>) => {
    if (!isPinchingRef.current || event.touches.length >= 2) {
      return;
    }

    event.stopPropagation();
    isPinchingRef.current = false;
    pinchStartDistanceRef.current = 0;
    setPinchScale(IMAGE_ZOOM_MIN_SCALE);
  }, []);

  const deletePost = useCallback(async () => {
    if (!viewerId || !post || viewerId !== post.user_id || deletePending) {
      return;
    }

    setOwnerMenuOpen(false);
    if (!window.confirm("Delete this photo? This action cannot be undone.")) {
      return;
    }

    setDeletePending(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", viewerId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletePending(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }, [deletePending, post, router, viewerId]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadPost = async () => {
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
        setError("You need to be logged in to view this post.");
        setLoading(false);
        return;
      }

      const nextViewerId = userData.user.id;
      setViewerId(nextViewerId);

      const { data: viewerProfileData } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", nextViewerId)
        .maybeSingle();
      if (!mounted) {
        return;
      }

      const metadata = userData.user.user_metadata ?? {};
      const metadataUsername = typeof metadata.username === "string" ? metadata.username.trim() : "";
      setViewerUsername(((viewerProfileData?.username as string | null) ?? metadataUsername) || null);
      setViewerAvatarUrl((viewerProfileData?.avatar_url as string | null) ?? null);

      const { data: postData, error: postError } = await supabase
        .from("feed_posts")
        .select(FEED_FIELDS)
        .eq("id", postId)
        .maybeSingle();
      if (!mounted) {
        return;
      }

      if (postError) {
        setError(postError.message);
        setPost(null);
        setLoading(false);
        return;
      }

      const nextPost = (postData as FeedPost | null) ?? null;
      if (!nextPost) {
        setError("Post not found.");
        setPost(null);
        setLoading(false);
        return;
      }

      setPost(nextPost);

      const { data: likeData, error: likeError } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", nextViewerId)
        .eq("post_id", postId)
        .maybeSingle();
      if (!mounted) {
        return;
      }

      if (likeError) {
        setError(likeError.message);
        setLiked(false);
      } else {
        setLiked(Boolean(likeData));
      }

      setLoading(false);
    };

    void loadPost();

    return () => {
      mounted = false;
    };
  }, [postId]);

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

  useEffect(() => {
    if (!commentsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComments();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeComments, commentsOpen]);

  useEffect(() => {
    return () => {
      clearCommentLongPressTimeout();
    };
  }, [clearCommentLongPressTimeout]);

  useEffect(() => {
    if (!ownerMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | globalThis.TouchEvent) => {
      const target = event.target as Node;
      if (ownerMenuRef.current?.contains(target) || ownerMenuButtonRef.current?.contains(target)) {
        return;
      }
      setOwnerMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOwnerMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [ownerMenuOpen]);

  if (!hasSupabaseEnv) {
    return <p>Supabase env vars are missing.</p>;
  }

  if (loading) {
    return (
      <div aria-live="polite" className="feed-loading" role="status">
        <span aria-hidden="true" className="loading-spinner" />
        <span className="visually-hidden">Loading post...</span>
      </div>
    );
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!post) {
    return <p>Post not found.</p>;
  }

  const isOwnPost = Boolean(viewerId && viewerId === post.user_id);

  return (
    <section className="home-page">
      <div className="feed-list">
        <article className="feed-post">
          <header className="feed-post-header">
            <div className="feed-post-header-main">
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
            </div>
            {isOwnPost ? (
              <div className="post-owner-menu">
                <button
                  aria-expanded={ownerMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Post options"
                  className="post-owner-menu-button"
                  onClick={() => {
                    setOwnerMenuOpen((current) => !current);
                  }}
                  ref={ownerMenuButtonRef}
                  type="button"
                >
                  <MoreIcon />
                </button>
                {ownerMenuOpen ? (
                  <div className="post-owner-menu-dropdown" ref={ownerMenuRef} role="menu">
                    <button
                      className="post-owner-menu-item"
                      disabled={deletePending}
                      onClick={() => {
                        void deletePost();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      {deletePending ? "Deleting..." : "Delete photo"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </header>

          <img
            alt={post.caption ?? "Post image"}
            className="feed-image"
            onTouchCancel={handleImagePinchEnd}
            onTouchEnd={handleImagePinchEnd}
            onTouchMove={handleImagePinchMove}
            onTouchStart={handleImagePinchStart}
            src={post.image_url}
            style={{ transform: `scale(${pinchScale})` }}
          />

          <div className="feed-actions">
            <button
              aria-label={liked ? "Unlike post" : "Like post"}
              className={`feed-action-button ${liked ? "is-liked" : ""}`}
              disabled={likePending}
              onClick={() => {
                void toggleLike();
              }}
              type="button"
            >
              <HeartIcon filled={liked} />
              <span className="feed-action-count">{post.like_count}</span>
            </button>
            <button
              aria-label="Comment"
              className="feed-action-button feed-action-button-comment"
              onClick={() => {
                void openComments();
              }}
              type="button"
            >
              <CommentIcon />
              <span className="feed-action-count">{post.comment_count}</span>
            </button>
          </div>

          {post.caption ? (
            <p className="feed-caption">
              {post.username ? <strong>{post.username}</strong> : <strong>Unknown user</strong>} {post.caption}
            </p>
          ) : null}
        </article>
      </div>

      <div
        aria-hidden={!commentsOpen}
        className={`comments-sheet-backdrop ${commentsOpen ? "is-open" : ""}`}
        onClick={closeComments}
      />
      <section
        aria-label="Comments"
        aria-hidden={!commentsOpen}
        aria-modal="true"
        className={`comments-sheet ${commentsOpen ? "is-open" : ""}`}
        role="dialog"
      >
        <header className="comments-sheet-header">
          <h2>Comments</h2>
          <button aria-label="Close comments" className="comments-close-button" onClick={closeComments} type="button">
            x
          </button>
        </header>
        <p className="comments-post-caption">{post.caption ?? "Post comments"}</p>
        {commentsLoading ? (
          <div aria-live="polite" className="comments-loading" role="status">
            <span aria-hidden="true" className="loading-spinner" />
            <span className="visually-hidden">Loading comments...</span>
          </div>
        ) : null}
        {!commentsLoading && commentsError ? <p className="comments-empty-state">{commentsError}</p> : null}
        {!commentsLoading && !commentsError && comments.length === 0 ? (
          <p className="comments-empty-state">No comments yet.</p>
        ) : null}
        {!commentsLoading && !commentsError && comments.length > 0 ? (
          <div className="comments-list">
            {comments.map((comment) => {
              const commentLiked = Boolean(likedCommentIds[comment.id]);
              const pending = Boolean(commentLikePendingIds[comment.id]);
              const isOwnedByViewer = Boolean(viewerId && comment.user_id === viewerId);
              const isMenuOpen = commentOwnerMenuId === comment.id;
              const isDeletePending = commentDeletePendingId === comment.id;
              return (
                <article className="comment-row" key={comment.id}>
                  <div
                    className="comment-main"
                    onMouseDown={() => startCommentLongPress(comment)}
                    onMouseLeave={cancelCommentLongPress}
                    onMouseUp={cancelCommentLongPress}
                    onTouchCancel={cancelCommentLongPress}
                    onTouchEnd={cancelCommentLongPress}
                    onTouchMove={cancelCommentLongPress}
                    onTouchStart={() => startCommentLongPress(comment)}
                  >
                    {comment.username ? (
                      <Link aria-label={`${comment.username}'s profile`} className="comment-avatar-link" href={`/u/${comment.username}`}>
                        <img
                          alt={`${comment.username} avatar`}
                          className="avatar comment-avatar"
                          src={buildAvatarSrc(comment.avatar_url, avatarVersion)}
                        />
                      </Link>
                    ) : (
                      <img
                        alt="Comment author avatar"
                        className="avatar comment-avatar"
                        src={buildAvatarSrc(comment.avatar_url, avatarVersion)}
                      />
                    )}
                    <p className="comment-copy">
                      {comment.username ? (
                        <Link className="comment-user-link" href={`/u/${comment.username}`}>
                          <strong>{comment.username}</strong>
                        </Link>
                      ) : (
                        <strong>unknown</strong>
                      )}{" "}
                      {comment.text}
                    </p>
                  </div>
                  {isOwnedByViewer && isMenuOpen ? (
                    <div className="comment-owner-menu">
                      <button
                        className="comment-owner-menu-item"
                        disabled={isDeletePending}
                        onClick={() => {
                          void deleteComment(comment);
                        }}
                        type="button"
                      >
                        {isDeletePending ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  ) : null}
                  <button
                    aria-label={commentLiked ? "Unlike comment" : "Like comment"}
                    className={`comment-like-button ${commentLiked ? "is-liked" : ""}`}
                    disabled={pending}
                    onClick={() => {
                      void toggleCommentLike(comment.id);
                    }}
                    type="button"
                  >
                    <HeartIcon filled={commentLiked} />
                    <span>{comment.like_count}</span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}
        <form
          className="comment-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitComment();
          }}
        >
          <img
            alt="Your avatar"
            className="avatar comment-composer-avatar"
            src={buildAvatarSrc(viewerAvatarUrl, avatarVersion)}
          />
          <input
            aria-label="Add a comment"
            className="comment-composer-input"
            onChange={(event) => {
              setCommentDraft(event.target.value);
            }}
            placeholder="Add a comment..."
            type="text"
            value={commentDraft}
          />
          <button className="primary-button comment-composer-submit" disabled={commentSubmitPending || !commentDraft.trim()} type="submit">
            {commentSubmitPending ? "Posting..." : "Post"}
          </button>
        </form>
        {commentSubmitError ? <p className="comments-empty-state">{commentSubmitError}</p> : null}
      </section>
    </section>
  );
}
