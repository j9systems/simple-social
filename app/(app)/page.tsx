"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TouchEvent } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { HOME_INITIAL_FEED_READY_EVENT, HOME_TAB_RESELECT_EVENT } from "@/lib/events";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { FeedComment, FeedPost } from "@/lib/types";

const FEED_FIELDS =
  "id,user_id,image_url,caption,created_at,username,avatar_url,like_count,comment_count";
const PULL_TRIGGER_DISTANCE = 92;
const MAX_PULL_DISTANCE = 136;
const PULL_RESIST_START = 80;
const PULL_RESIST_FACTOR = 0.35;
const IMAGE_ZOOM_MIN_SCALE = 1;
const IMAGE_ZOOM_MAX_SCALE = 3;
const COMMENT_LONG_PRESS_MS = 550;
const DOUBLE_TAP_MAX_DELAY_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 24;

type PinchTouches = {
  length: number;
  [index: number]: { clientX: number; clientY: number };
};

type TapSnapshot = {
  time: number;
  x: number;
  y: number;
};

type HomeFeedCacheSnapshot = {
  cachedAt: number;
  posts: FeedPost[];
  likedPostIds: Record<string, boolean>;
  viewerId: string | null;
  viewerUsername: string | null;
  viewerAvatarUrl: string | null;
};

const HOME_FEED_CACHE_TTL_MS = 3 * 60 * 1000;
let homeFeedCacheSnapshot: HomeFeedCacheSnapshot | null = null;

function getPinchDistance(touches: PinchTouches) {
  if (touches.length < 2) {
    return 0;
  }

  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

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

export default function HomePage() {
  const initialHomeFeedCache = homeFeedCacheSnapshot;

  const [posts, setPosts] = useState<FeedPost[]>(initialHomeFeedCache?.posts ?? []);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>(initialHomeFeedCache?.likedPostIds ?? {});
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, FeedComment[]>>({});
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);
  const [commentOwnerMenuId, setCommentOwnerMenuId] = useState<string | null>(null);
  const [commentDeletePendingId, setCommentDeletePendingId] = useState<string | null>(null);
  const [postOwnerMenuId, setPostOwnerMenuId] = useState<string | null>(null);
  const [postDeletePendingId, setPostDeletePendingId] = useState<string | null>(null);
  const [likedCommentIds, setLikedCommentIds] = useState<Record<string, boolean>>({});
  const [viewerId, setViewerId] = useState<string | null>(initialHomeFeedCache?.viewerId ?? null);
  const [viewerUsername, setViewerUsername] = useState<string | null>(initialHomeFeedCache?.viewerUsername ?? null);
  const [viewerAvatarUrl, setViewerAvatarUrl] = useState<string | null>(initialHomeFeedCache?.viewerAvatarUrl ?? null);
  const [likePendingIds, setLikePendingIds] = useState<Record<string, boolean>>({});
  const [commentLikePendingIds, setCommentLikePendingIds] = useState<Record<string, boolean>>({});
  const [commentSubmitPendingByPostId, setCommentSubmitPendingByPostId] = useState<Record<string, boolean>>({});
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv && !initialHomeFeedCache);
  const [error, setError] = useState<string | null>(null);
  const [doubleTapLikeOverlayByPostId, setDoubleTapLikeOverlayByPostId] = useState<Record<string, boolean>>({});
  const [likeBounceByPostId, setLikeBounceByPostId] = useState<Record<string, boolean>>({});
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullingFeed, setIsPullingFeed] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [feedRefreshTick, setFeedRefreshTick] = useState(0);
  const [pinchScaleByPostId, setPinchScaleByPostId] = useState<Record<string, number>>({});
  const pinchStartDistanceRef = useRef(0);
  const pinchPostIdRef = useRef<string | null>(null);
  const lastTapByPostIdRef = useRef<Record<string, TapSnapshot>>({});
  const commentLongPressTimeoutRef = useRef<number | null>(null);
  const pullStartYRef = useRef(0);
  const pullActiveRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshStartedAtRef = useRef<number | null>(null);
  const hasCompletedInitialFeedLoadRef = useRef(Boolean(initialHomeFeedCache));
  const doubleTapOverlayTimerByPostIdRef = useRef<Record<string, number>>({});
  const likeBounceTimerByPostIdRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!initialHomeFeedCache) {
      return;
    }

    const nextWindow = window as Window & { __ssHomeInitialFeedReady?: boolean };
    if (!nextWindow.__ssHomeInitialFeedReady) {
      nextWindow.__ssHomeInitialFeedReady = true;
      window.dispatchEvent(new Event(HOME_INITIAL_FEED_READY_EVENT));
    }
  }, [initialHomeFeedCache]);

  const triggerFeedRefresh = useCallback((holdDistance: number = PULL_TRIGGER_DISTANCE) => {
    if (isRefreshingFeed) {
      return;
    }

    pullActiveRef.current = false;
    pullDistanceRef.current = 0;
    refreshStartedAtRef.current = Date.now();
    setIsRefreshingFeed(true);
    setIsPullingFeed(true);
    setPullDistance(Math.max(PULL_TRIGGER_DISTANCE, Math.min(MAX_PULL_DISTANCE, holdDistance)));
    setFeedRefreshTick((current) => current + 1);
  }, [isRefreshingFeed]);

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

  const loadCommentsForPost = useCallback(async (postId: string) => {
    if (!viewerId) {
      return;
    }

    setCommentsLoadingPostId(postId);
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
      setCommentsLoadingPostId(null);
      return;
    }

    const commentRows = ((commentsResponse.data as CommentRow[]) ?? []).filter((row) => Boolean(row?.id));
    const commentIds = commentRows.map((comment) => comment.id);

    if (commentIds.length === 0) {
      setCommentsByPostId((current) => ({ ...current, [postId]: [] }));
      setCommentsLoadingPostId(null);
      return;
    }

    const { data: commentLikesData, error: commentLikesError } = await supabase
      .from("comment_likes")
      .select("comment_id,user_id")
      .in("comment_id", commentIds);

    if (commentLikesError) {
      setCommentsError(commentLikesError.message);
      setCommentsLoadingPostId(null);
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
    setCommentsByPostId((current) => ({ ...current, [postId]: normalized }));
    setLikedCommentIds((current) => {
      const next = { ...current };
      for (const commentId of commentIds) {
        delete next[commentId];
      }
      return { ...next, ...viewerLikedLookup };
    });
    setCommentsLoadingPostId(null);
  }, [viewerId]);

  const openComments = useCallback(async (postId: string) => {
    setOpenCommentsPostId(postId);
    await loadCommentsForPost(postId);
  }, [loadCommentsForPost]);

  const closeComments = useCallback(() => {
    setOpenCommentsPostId(null);
    setCommentsError(null);
    setCommentSubmitError(null);
    setCommentsLoadingPostId(null);
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

  const toggleCommentLike = useCallback(async (commentId: string, postId: string) => {
    if (!viewerId || commentLikePendingIds[commentId]) {
      return;
    }

    const liked = Boolean(likedCommentIds[commentId]);
    setCommentLikePendingIds((current) => ({ ...current, [commentId]: true }));

    const setPendingDone = () => {
      setCommentLikePendingIds((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    };

    if (liked) {
      setLikedCommentIds((current) => ({ ...current, [commentId]: false }));
      setCommentsByPostId((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).map((comment) =>
          comment.id === commentId
            ? { ...comment, like_count: Math.max(0, comment.like_count - 1) }
            : comment,
        ),
      }));

      const { error: unlikeError } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", viewerId);

      if (unlikeError) {
        setLikedCommentIds((current) => ({ ...current, [commentId]: true }));
        setCommentsByPostId((current) => ({
          ...current,
          [postId]: (current[postId] ?? []).map((comment) =>
            comment.id === commentId
              ? { ...comment, like_count: comment.like_count + 1 }
              : comment,
          ),
        }));
      }

      setPendingDone();
      return;
    }

    setLikedCommentIds((current) => ({ ...current, [commentId]: true }));
    setCommentsByPostId((current) => ({
      ...current,
      [postId]: (current[postId] ?? []).map((comment) =>
        comment.id === commentId
          ? { ...comment, like_count: comment.like_count + 1 }
          : comment,
      ),
    }));

    const { error: likeError } = await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: viewerId });

    if (likeError) {
      setLikedCommentIds((current) => ({ ...current, [commentId]: false }));
      setCommentsByPostId((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).map((comment) =>
          comment.id === commentId
            ? { ...comment, like_count: Math.max(0, comment.like_count - 1) }
            : comment,
        ),
      }));
    }

    setPendingDone();
  }, [commentLikePendingIds, likedCommentIds, viewerId]);

  const submitComment = useCallback(async () => {
    if (!viewerId || !openCommentsPostId) {
      return;
    }

    const nextText = (commentDraftByPostId[openCommentsPostId] ?? "").trim();
    if (!nextText || commentSubmitPendingByPostId[openCommentsPostId]) {
      return;
    }

    setCommentSubmitPendingByPostId((current) => ({ ...current, [openCommentsPostId]: true }));
    setCommentSubmitError(null);

    const payloadBase = {
      post_id: openCommentsPostId,
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

    setCommentSubmitPendingByPostId((current) => {
      const next = { ...current };
      delete next[openCommentsPostId];
      return next;
    });

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
    setCommentsByPostId((current) => ({
      ...current,
      [openCommentsPostId]: [...(current[openCommentsPostId] ?? []), normalizedComment],
    }));
    setPosts((current) =>
      current.map((post) =>
        post.id === openCommentsPostId
          ? { ...post, comment_count: post.comment_count + 1 }
          : post,
      ),
    );
    setCommentDraftByPostId((current) => ({ ...current, [openCommentsPostId]: "" }));

  }, [commentDraftByPostId, commentSubmitPendingByPostId, openCommentsPostId, viewerAvatarUrl, viewerId, viewerUsername]);

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

    setCommentsByPostId((current) => ({
      ...current,
      [comment.post_id]: (current[comment.post_id] ?? []).filter((entry) => entry.id !== comment.id),
    }));
    setPosts((current) =>
      current.map((post) =>
        post.id === comment.post_id
          ? { ...post, comment_count: Math.max(0, post.comment_count - 1) }
          : post,
      ),
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

  const deletePost = useCallback(async (post: FeedPost) => {
    if (!viewerId || post.user_id !== viewerId || postDeletePendingId === post.id) {
      return;
    }

    setPostOwnerMenuId(null);
    if (!window.confirm("Delete this photo? This action cannot be undone.")) {
      return;
    }

    setPostDeletePendingId(post.id);
    setError(null);

    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", viewerId);

    if (deleteError) {
      setError(deleteError.message);
      setPostDeletePendingId(null);
      return;
    }

    setPosts((current) => current.filter((entry) => entry.id !== post.id));
    setCommentsByPostId((current) => {
      const next = { ...current };
      delete next[post.id];
      return next;
    });
    setCommentDraftByPostId((current) => {
      const next = { ...current };
      delete next[post.id];
      return next;
    });
    setCommentSubmitPendingByPostId((current) => {
      const next = { ...current };
      delete next[post.id];
      return next;
    });
    setPostDeletePendingId(null);

    if (openCommentsPostId === post.id) {
      closeComments();
    }
  }, [closeComments, openCommentsPostId, postDeletePendingId, viewerId]);

  const handleImagePinchStart = useCallback((postId: string, event: TouchEvent<HTMLImageElement>) => {
    if (event.touches.length < 2) {
      return;
    }

    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }

    pinchPostIdRef.current = postId;
    pinchStartDistanceRef.current = getPinchDistance(event.touches);
    setPinchScaleByPostId((current) => ({ ...current, [postId]: IMAGE_ZOOM_MIN_SCALE }));
  }, []);

  const handleImagePinchMove = useCallback((postId: string, event: TouchEvent<HTMLImageElement>) => {
    if (pinchPostIdRef.current !== postId || event.touches.length < 2 || pinchStartDistanceRef.current <= 0) {
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
    setPinchScaleByPostId((current) => ({ ...current, [postId]: nextScale }));
  }, []);

  const handleImagePinchEnd = useCallback((postId: string, event: TouchEvent<HTMLImageElement>) => {
    if (pinchPostIdRef.current !== postId || event.touches.length >= 2) {
      return;
    }

    event.stopPropagation();
    pinchPostIdRef.current = null;
    pinchStartDistanceRef.current = 0;
    setPinchScaleByPostId((current) => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
  }, []);

  const triggerDoubleTapLike = useCallback((postId: string) => {
    if (!viewerId || likePendingIds[postId] || likedPostIds[postId]) {
      return;
    }

    const previousOverlayTimer = doubleTapOverlayTimerByPostIdRef.current[postId];
    if (previousOverlayTimer) {
      window.clearTimeout(previousOverlayTimer);
    }

    const previousBounceTimer = likeBounceTimerByPostIdRef.current[postId];
    if (previousBounceTimer) {
      window.clearTimeout(previousBounceTimer);
    }

    setDoubleTapLikeOverlayByPostId((current) => ({ ...current, [postId]: true }));
    setLikeBounceByPostId((current) => ({ ...current, [postId]: true }));

    doubleTapOverlayTimerByPostIdRef.current[postId] = window.setTimeout(() => {
      setDoubleTapLikeOverlayByPostId((current) => ({ ...current, [postId]: false }));
      delete doubleTapOverlayTimerByPostIdRef.current[postId];
    }, 760);

    likeBounceTimerByPostIdRef.current[postId] = window.setTimeout(() => {
      setLikeBounceByPostId((current) => ({ ...current, [postId]: false }));
      delete likeBounceTimerByPostIdRef.current[postId];
    }, 420);

    void toggleLike(postId);
  }, [likePendingIds, likedPostIds, toggleLike, viewerId]);

  const handleImageTapEnd = useCallback((postId: string, event: TouchEvent<HTMLImageElement>) => {
    if (pinchPostIdRef.current === postId || event.touches.length > 0) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const now = Date.now();
    const previousTap = lastTapByPostIdRef.current[postId];
    const isDoubleTap =
      Boolean(previousTap) &&
      now - previousTap.time <= DOUBLE_TAP_MAX_DELAY_MS &&
      Math.hypot(previousTap.x - touch.clientX, previousTap.y - touch.clientY) <= DOUBLE_TAP_MAX_DISTANCE_PX;

    lastTapByPostIdRef.current[postId] = {
      time: now,
      x: touch.clientX,
      y: touch.clientY,
    };

    if (!isDoubleTap) {
      return;
    }

    delete lastTapByPostIdRef.current[postId];
    triggerDoubleTapLike(postId);
  }, [triggerDoubleTapLike]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    if (feedRefreshTick === 0 && initialHomeFeedCache) {
      const cacheAge = Date.now() - initialHomeFeedCache.cachedAt;
      if (cacheAge <= HOME_FEED_CACHE_TTL_MS) {
        if (!hasCompletedInitialFeedLoadRef.current) {
          hasCompletedInitialFeedLoadRef.current = true;
          (window as Window & { __ssHomeInitialFeedReady?: boolean }).__ssHomeInitialFeedReady = true;
          window.dispatchEvent(new Event(HOME_INITIAL_FEED_READY_EVENT));
        }
        return;
      }
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
        setViewerId(null);
        setLoading(false);
        return;
      }

      const viewerId = userData.user.id;
      setViewerId(viewerId);

      const { data: viewerProfileData } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", viewerId)
        .maybeSingle();
      if (!mounted) {
        return;
      }
      const metadata = userData.user.user_metadata ?? {};
      const metadataUsername = typeof metadata.username === "string" ? metadata.username.trim() : "";
      setViewerUsername(((viewerProfileData?.username as string | null) ?? metadataUsername) || null);
      setViewerAvatarUrl((viewerProfileData?.avatar_url as string | null) ?? null);

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
      if (!hasCompletedInitialFeedLoadRef.current) {
        hasCompletedInitialFeedLoadRef.current = true;
        (window as Window & { __ssHomeInitialFeedReady?: boolean }).__ssHomeInitialFeedReady = true;
        window.dispatchEvent(new Event(HOME_INITIAL_FEED_READY_EVENT));
      }
    };

    loadFeed();

    return () => {
      mounted = false;
    };
  }, [feedRefreshTick, initialHomeFeedCache]);

  useEffect(() => {
    if (loading || error || !viewerId) {
      return;
    }

    homeFeedCacheSnapshot = {
      cachedAt: Date.now(),
      posts,
      likedPostIds,
      viewerId,
      viewerUsername,
      viewerAvatarUrl,
    };
  }, [error, likedPostIds, loading, posts, viewerAvatarUrl, viewerId, viewerUsername]);

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
    if (!openCommentsPostId) {
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
  }, [closeComments, openCommentsPostId]);

  useEffect(() => {
    return () => {
      clearCommentLongPressTimeout();
    };
  }, [clearCommentLongPressTimeout]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(".page-wrap");
    if (!scrollEl) return;

    const onTouchStart = (event: globalThis.TouchEvent) => {
      if (!hasSupabaseEnv || isRefreshingFeed || openCommentsPostId) {
        return;
      }
      if (event.touches.length !== 1) {
        return;
      }
      if (scrollEl.scrollTop > 0) {
        return;
      }
      pullActiveRef.current = true;
      pullStartYRef.current = event.touches[0]?.clientY ?? 0;
      setIsPullingFeed(false);
    };

    const onTouchMove = (event: globalThis.TouchEvent) => {
      if (!pullActiveRef.current || isRefreshingFeed) {
        return;
      }
      if (event.touches.length !== 1) {
        return;
      }
      if (scrollEl.scrollTop > 0) {
        pullActiveRef.current = false;
        setIsPullingFeed(false);
        setPullDistance(0);
        return;
      }

      const currentY = event.touches[0]?.clientY ?? pullStartYRef.current;
      const rawDistance = currentY - pullStartYRef.current;
      if (rawDistance <= 0) {
        setIsPullingFeed(false);
        setPullDistance(0);
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      setIsPullingFeed(true);
      const resistedDistance = Math.min(
        MAX_PULL_DISTANCE,
        rawDistance <= PULL_RESIST_START
          ? rawDistance
          : PULL_RESIST_START + (rawDistance - PULL_RESIST_START) * PULL_RESIST_FACTOR,
      );

      if (resistedDistance >= PULL_TRIGGER_DISTANCE) {
        triggerFeedRefresh(resistedDistance);
        return;
      }

      setPullDistance(resistedDistance);
    };

    const onTouchEnd = () => {
      if (!pullActiveRef.current && !isPullingFeed) {
        return;
      }

      pullActiveRef.current = false;
      const shouldRefresh = pullDistanceRef.current >= PULL_TRIGGER_DISTANCE;

      if (!shouldRefresh) {
        setIsPullingFeed(false);
        setPullDistance(0);
        return;
      }

      triggerFeedRefresh(pullDistanceRef.current);
    };

    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollEl.addEventListener("touchend", onTouchEnd);
    scrollEl.addEventListener("touchcancel", onTouchEnd);

    return () => {
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove);
      scrollEl.removeEventListener("touchend", onTouchEnd);
      scrollEl.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isPullingFeed, isRefreshingFeed, openCommentsPostId, triggerFeedRefresh]);

  useEffect(() => {
    if (!isRefreshingFeed) {
      return;
    }

    if (loading) {
      return;
    }

    const elapsedMs = refreshStartedAtRef.current ? Date.now() - refreshStartedAtRef.current : 0;
    const remainingAnimationMs = Math.max(0, 420 - elapsedMs);
    const cleanupTimer = window.setTimeout(() => {
      setIsRefreshingFeed(false);
      setIsPullingFeed(false);
      setPullDistance(0);
      refreshStartedAtRef.current = null;
    }, remainingAnimationMs);

    return () => {
      window.clearTimeout(cleanupTimer);
    };
  }, [isRefreshingFeed, loading]);

  useEffect(() => {
    const onHomeTabReselect = () => {
      const scrollEl = document.querySelector<HTMLElement>(".page-wrap");
      if (!scrollEl || scrollEl.scrollTop <= 0) {
        return;
      }

      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
      if (hasSupabaseEnv) {
        triggerFeedRefresh();
      }
    };

    window.addEventListener(HOME_TAB_RESELECT_EVENT, onHomeTabReselect);

    return () => {
      window.removeEventListener(HOME_TAB_RESELECT_EVENT, onHomeTabReselect);
    };
  }, [triggerFeedRefresh]);

  useEffect(() => {
    const overlayTimersRef = doubleTapOverlayTimerByPostIdRef;
    const bounceTimersRef = likeBounceTimerByPostIdRef;

    return () => {
      for (const timerId of Object.values(overlayTimersRef.current)) {
        window.clearTimeout(timerId);
      }
      for (const timerId of Object.values(bounceTimersRef.current)) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const pullProgress = isRefreshingFeed
    ? 1
    : Math.max(0, Math.min(1, pullDistance / PULL_TRIGGER_DISTANCE));

  const content = useMemo(() => {
    if (!hasSupabaseEnv) {
      return <p>Supabase env vars are missing.</p>;
    }
    if (loading && posts.length === 0) {
      return (
        <div aria-live="polite" className="feed-loading" role="status">
          <span aria-hidden="true" className="loading-spinner" />
          <span className="visually-hidden">Loading feed...</span>
        </div>
      );
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
          const isOwnPost = Boolean(viewerId && viewerId === post.user_id);
          const isPostMenuOpen = postOwnerMenuId === post.id;
          const isPostDeletePending = postDeletePendingId === post.id;

          return (
            <article className="feed-post" key={post.id}>
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
                      aria-expanded={isPostMenuOpen}
                      aria-haspopup="menu"
                      aria-label="Post options"
                      className="post-owner-menu-button"
                      onClick={() => {
                        setPostOwnerMenuId((current) => (current === post.id ? null : post.id));
                      }}
                      type="button"
                    >
                      <MoreIcon />
                    </button>
                    {isPostMenuOpen ? (
                      <div className="post-owner-menu-dropdown" role="menu">
                        <button
                          className="post-owner-menu-item"
                          disabled={isPostDeletePending}
                          onClick={() => {
                            void deletePost(post);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          {isPostDeletePending ? "Deleting..." : "Delete photo"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </header>

            <div className="feed-image-wrap">
              <img
                alt={post.caption ?? "Post image"}
                className="feed-image"
                onDoubleClick={() => triggerDoubleTapLike(post.id)}
                onTouchCancel={(event) => handleImagePinchEnd(post.id, event)}
                onTouchEnd={(event) => {
                  handleImageTapEnd(post.id, event);
                  handleImagePinchEnd(post.id, event);
                }}
                onTouchMove={(event) => handleImagePinchMove(post.id, event)}
                onTouchStart={(event) => handleImagePinchStart(post.id, event)}
                src={post.image_url}
                style={{ transform: `scale(${pinchScaleByPostId[post.id] ?? IMAGE_ZOOM_MIN_SCALE})` }}
              />
              <span
                aria-hidden="true"
                className={`feed-double-like-overlay ${doubleTapLikeOverlayByPostId[post.id] ? "is-visible" : ""}`}
              >
                <span className="feed-double-like-heart">
                  <HeartIcon filled />
                </span>
              </span>
            </div>

            <div className="feed-actions">
              <button
                aria-label={liked ? "Unlike post" : "Like post"}
                className={`feed-action-button ${liked ? "is-liked" : ""} ${likeBounceByPostId[post.id] ? "is-like-bounce" : ""}`}
                disabled={likePending}
                onClick={() => toggleLike(post.id)}
                type="button"
              >
                <HeartIcon filled={liked} />
                <span className="feed-action-count">{displayedLikeCount}</span>
              </button>
              <button
                aria-label="Comment"
                className="feed-action-button feed-action-button-comment"
                onClick={() => openComments(post.id)}
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
          );
        })}
      </div>
    );
  }, [
    avatarVersion,
    error,
    handleImageTapEnd,
    handleImagePinchEnd,
    handleImagePinchMove,
    handleImagePinchStart,
    likeBounceByPostId,
    likePendingIds,
    postDeletePendingId,
    postOwnerMenuId,
    doubleTapLikeOverlayByPostId,
    likedPostIds,
    loading,
    openComments,
    deletePost,
    pinchScaleByPostId,
    posts,
    triggerDoubleTapLike,
    toggleLike,
    viewerId,
  ]);

  const openCommentsPost = openCommentsPostId
    ? posts.find((post) => post.id === openCommentsPostId) ?? null
    : null;
  const visibleComments = openCommentsPostId ? commentsByPostId[openCommentsPostId] ?? [] : [];
  const commentsLoading = openCommentsPostId ? commentsLoadingPostId === openCommentsPostId : false;
  const commentDraft = openCommentsPostId ? commentDraftByPostId[openCommentsPostId] ?? "" : "";
  const commentSubmitPending = openCommentsPostId ? Boolean(commentSubmitPendingByPostId[openCommentsPostId]) : false;
  const pullRefreshRingStyle = { "--pull-progress": `${pullProgress}` } as CSSProperties;

  const feedContentStyle = { transform: `translateY(${pullDistance}px)` } as CSSProperties;

  return (
    <section className="home-page">
      <div
        aria-hidden={!(isPullingFeed || isRefreshingFeed)}
        aria-live="polite"
        className={`pull-refresh-indicator ${isPullingFeed || isRefreshingFeed ? "is-visible" : ""}`}
        role="status"
      >
        <span
          aria-hidden="true"
          className={`pull-refresh-ring ${isRefreshingFeed ? "is-refreshing" : ""}`}
          style={pullRefreshRingStyle}
        />
        <span className="visually-hidden">
          {isRefreshingFeed ? "Refreshing feed..." : "Pull down to refresh"}
        </span>
      </div>
      <div
        className={`home-feed-content ${isPullingFeed ? "is-pulling" : ""}`}
        style={feedContentStyle}
      >
        {content}
      </div>
      <div
        aria-hidden={!openCommentsPostId}
        className={`comments-sheet-backdrop ${openCommentsPostId ? "is-open" : ""}`}
        onClick={closeComments}
      />
      <section
        aria-label="Comments"
        aria-hidden={!openCommentsPostId}
        aria-modal="true"
        className={`comments-sheet ${openCommentsPostId ? "is-open" : ""}`}
        role="dialog"
      >
        <header className="comments-sheet-header">
          <h2>Comments</h2>
          <button aria-label="Close comments" className="comments-close-button" onClick={closeComments} type="button">
            ×
          </button>
        </header>
        {openCommentsPost ? (
          <p className="comments-post-caption">{openCommentsPost.caption ?? "Post comments"}</p>
        ) : null}
        {commentsLoading ? (
          <div aria-live="polite" className="comments-loading" role="status">
            <span aria-hidden="true" className="loading-spinner" />
            <span className="visually-hidden">Loading comments...</span>
          </div>
        ) : null}
        {!commentsLoading && commentsError ? <p className="comments-empty-state">{commentsError}</p> : null}
        {!commentsLoading && !commentsError && visibleComments.length === 0 ? (
          <p className="comments-empty-state">No comments yet.</p>
        ) : null}
        {!commentsLoading && !commentsError && visibleComments.length > 0 ? (
          <div className="comments-list">
            {visibleComments.map((comment) => {
              const liked = Boolean(likedCommentIds[comment.id]);
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
                    aria-label={liked ? "Unlike comment" : "Like comment"}
                    className={`comment-like-button ${liked ? "is-liked" : ""}`}
                    disabled={pending}
                    onClick={() => toggleCommentLike(comment.id, comment.post_id)}
                    type="button"
                  >
                    <HeartIcon filled={liked} />
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
              if (!openCommentsPostId) {
                return;
              }
              const nextValue = event.target.value;
              setCommentDraftByPostId((current) => ({
                ...current,
                [openCommentsPostId]: nextValue,
              }));
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
