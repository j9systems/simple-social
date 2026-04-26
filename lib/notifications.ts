import { supabase } from "@/lib/supabase";
import { isMissingTableError } from "@/lib/supabase-errors";
import type { NotificationItem, NotificationType } from "@/lib/types";

type PushPayload = {
  recipientUserId: string;
  actorUserId: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
};

async function sendPushForNotification({ type, recipientUserId, actorUserId, postId, commentId }: PushPayload) {
  try {
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", actorUserId)
      .maybeSingle();

    const actorName = actorProfile?.username ? `@${actorProfile.username}` : "Someone";

    const messages: Record<NotificationType, string> = {
      follow: `${actorName} followed you`,
      follow_request: `${actorName} requested to follow you`,
      post_like: `${actorName} liked your post`,
      comment: `${actorName} commented on your post`,
      comment_like: `${actorName} liked your comment`,
    };

    const urlMap: Record<NotificationType, string> = {
      follow: actorProfile?.username ? `/u/${actorProfile.username}` : "/",
      follow_request: actorProfile?.username ? `/u/${actorProfile.username}` : "/",
      post_like: postId ? `/p/${postId}` : "/",
      comment: postId ? `/p/${postId}` : "/",
      comment_like: postId ? `/p/${postId}` : "/",
    };

    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientUserId,
        title: "Simple Social",
        body: messages[type],
        url: urlMap[type],
        tag: `${type}:${postId ?? commentId ?? actorUserId}`,
      }),
    });
  } catch {
    // Push delivery should never block core actions
    console.error("Failed to send push notification");
  }
}

type CreateNotificationInput = {
  type: NotificationType;
  recipientUserId: string;
  actorUserId: string;
  postId?: string | null;
  commentId?: string | null;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  recipient_profile_id: string;
  actor_profile_id: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type PostRow = {
  id: string;
  image_url: string | null;
};

type FollowRequestRow = {
  requester_id: string | null;
  target_id: string | null;
  status: "pending" | "accepted" | "declined" | "canceled" | null;
  created_at: string;
};

export type ListNotificationsResult = {
  items: NotificationItem[];
  errorMessage: string | null;
};

const NOTIFICATION_SELECT =
  "id,type,recipient_profile_id,actor_profile_id,post_id,comment_id,is_read,created_at,read_at";

export async function createNotification({
  type,
  recipientUserId,
  actorUserId,
  postId = null,
  commentId = null,
}: CreateNotificationInput) {
  if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
    return;
  }

  // DB triggers (notify_on_follow, notify_on_post_like, notify_on_comment,
  // notify_on_comment_like) already create the notification row server-side.
  // The insert below is a fallback for any type without a trigger; if the
  // trigger already created the row, the duplicate insert error is expected.
  const { error } = await supabase.from("notifications").insert({
    type,
    recipient_profile_id: recipientUserId,
    actor_profile_id: actorUserId,
    post_id: postId,
    comment_id: commentId,
  });

  if (error) {
    // Expected when a DB trigger already created the notification row.
    console.warn("Notification insert skipped (likely created by DB trigger)", error.message);
  }

  // Always attempt push delivery — the notification row exists via the DB trigger
  // even when the client-side insert above was a no-op.
  void sendPushForNotification({ type, recipientUserId, actorUserId, postId, commentId });
}

export async function listNotifications(recipientUserId: string, limit = 40): Promise<ListNotificationsResult> {
  const debugIssues: string[] = [];
  const notificationsResponse = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_profile_id", recipientUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  let rows: NotificationRow[] = [];
  if (notificationsResponse.error) {
    const message = `Failed to load notifications: ${notificationsResponse.error.message}`;
    console.error(message);
    debugIssues.push(message);
  } else {
    rows = (notificationsResponse.data as unknown as NotificationRow[] | null) ?? [];
  }

  const followRequestsResponse = await supabase
    .from("follow_requests")
    .select("requester_id,target_id,status,created_at")
    .eq("target_id", recipientUserId)
    .eq("status", "pending");

  if (followRequestsResponse.error && !isMissingTableError(followRequestsResponse.error, "follow_requests")) {
    const message = `Follow request lookup failed: ${followRequestsResponse.error.message}`;
    console.error(message);
    debugIssues.push(message);
  }

  const followRequests = ((followRequestsResponse.data as FollowRequestRow[] | null) ?? []).filter(
    (row): row is FollowRequestRow & { requester_id: string; target_id: string; status: "pending" } =>
      Boolean(row.requester_id) && Boolean(row.target_id) && row.status === "pending",
  );
  const existingFollowRequestKeys = new Set(
    rows
      .filter((row) => row.type === "follow_request" && Boolean(row.actor_profile_id))
      .map((row) => `${row.actor_profile_id}:${row.recipient_profile_id}`),
  );

  const actorIds = Array.from(
    new Set([
      ...rows.map((row) => row.actor_profile_id).filter(Boolean),
      ...followRequests.map((row) => row.requester_id),
    ]),
  ) as string[];
  const postIds = Array.from(new Set(rows.map((row) => row.post_id).filter(Boolean))) as string[];

  const [profilesResponse, postsResponse] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id,username,avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from("posts").select("id,image_url").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResponse.error) {
    const message = `Profile lookup failed: ${profilesResponse.error.message}`;
    console.error(message);
    debugIssues.push(message);
  }
  if (postsResponse.error) {
    const message = `Post lookup failed: ${postsResponse.error.message}`;
    console.error(message);
    debugIssues.push(message);
  }

  const profileById = new Map<string, ProfileRow>();
  for (const profile of (profilesResponse.data as ProfileRow[] | null) ?? []) {
    if (profile.id) {
      profileById.set(profile.id, profile);
    }
  }

  const postById = new Map<string, PostRow>();
  for (const post of (postsResponse.data as PostRow[] | null) ?? []) {
    if (post.id) {
      postById.set(post.id, post);
    }
  }

  const items = rows.map((row) => {
    const actorProfile = row.actor_profile_id ? profileById.get(row.actor_profile_id) : null;
    const post = row.post_id ? postById.get(row.post_id) : null;
    const resolvedReadAt = row.read_at ?? (row.is_read ? row.created_at : null);

    return {
      id: row.id,
      type: row.type,
      recipient_profile_id: row.recipient_profile_id,
      actor_profile_id: row.actor_profile_id ?? null,
      actor_username: actorProfile?.username ?? null,
      actor_avatar_url: actorProfile?.avatar_url ?? null,
      post_id: row.post_id ?? null,
      post_image_url: post?.image_url ?? null,
      comment_id: row.comment_id ?? null,
      created_at: row.created_at,
      read_at: resolvedReadAt,
    };
  });

  const followRequestItems = followRequests
    .filter((request) => !existingFollowRequestKeys.has(`${request.requester_id}:${request.target_id}`))
    .map((request) => {
      const actorProfile = profileById.get(request.requester_id);
      return {
        id: `follow_request:${request.requester_id}:${request.target_id}`,
        type: "follow_request" as NotificationType,
        recipient_profile_id: request.target_id,
        actor_profile_id: request.requester_id,
        actor_username: actorProfile?.username ?? null,
        actor_avatar_url: actorProfile?.avatar_url ?? null,
        post_id: null,
        post_image_url: null,
        comment_id: null,
        created_at: request.created_at,
        read_at: null,
      };
    });

  const mergedItems = [...items, ...followRequestItems];
  mergedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    items: mergedItems,
    errorMessage: debugIssues.length > 0 ? debugIssues.join(" | ") : null,
  };
}

export async function markNotificationAsRead(notificationId: string, recipientUserId: string) {
  const nowIso = new Date().toISOString();
  const response = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: nowIso })
    .eq("id", Number(notificationId))
    .eq("recipient_profile_id", recipientUserId)
    .select("id");

  if (response.error) {
    console.error("Failed to mark notification as read", response.error.message);
    return;
  }

  if (!response.data || response.data.length === 0) {
    console.warn(
      "markNotificationAsRead: update matched 0 rows",
      { notificationId, recipientUserId },
    );
  }
}
