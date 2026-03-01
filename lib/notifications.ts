import { supabase } from "@/lib/supabase";
import type { NotificationItem, NotificationType } from "@/lib/types";

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

  const { error } = await supabase.from("notifications").insert({
    type,
    recipient_profile_id: recipientUserId,
    actor_profile_id: actorUserId,
    post_id: postId,
    comment_id: commentId,
  });

  // Notification delivery should never block core actions.
  if (error) {
    console.error("Failed to create notification", error.message);
  }
}

export async function listNotifications(recipientUserId: string, limit = 40): Promise<ListNotificationsResult> {
  const response = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_profile_id", recipientUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (response.error) {
    const message = `Failed to load notifications: ${response.error.message}`;
    console.error(message);
    return {
      items: [],
      errorMessage: message,
    };
  }

  const rows = (response.data as unknown as NotificationRow[] | null) ?? [];
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_profile_id).filter(Boolean))) as string[];
  const postIds = Array.from(new Set(rows.map((row) => row.post_id).filter(Boolean))) as string[];

  const [profilesResponse, postsResponse] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id,username,avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from("posts").select("id,image_url").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const debugIssues: string[] = [];
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
      read_at: row.read_at ?? null,
    };
  });

  return {
    items,
    errorMessage: debugIssues.length > 0 ? debugIssues.join(" | ") : null,
  };
}

export async function markNotificationAsRead(notificationId: string, recipientUserId: string) {
  const response = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("recipient_profile_id", recipientUserId);

  if (response.error) {
    console.error("Failed to mark notification as read", response.error.message);
  }
}
