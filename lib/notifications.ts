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
  recipient_user_id: string;
  actor_user_id: string;
  post_id?: string | null;
  comment_id?: string | null;
  created_at: string;
  read_at?: string | null;
  clicked_at?: string | null;
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

const NOTIFICATION_SELECT_CANDIDATES = [
  "id,type,recipient_user_id,actor_user_id,post_id,comment_id,created_at,read_at",
  "id,type,recipient_user_id,actor_user_id,post_id,comment_id,created_at,clicked_at",
  "id,type,recipient_user_id,actor_user_id,post_id,comment_id,created_at",
] as const;

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
    recipient_user_id: recipientUserId,
    actor_user_id: actorUserId,
    post_id: postId,
    comment_id: commentId,
  });

  // Notification delivery should never block core actions.
  if (error) {
    console.error("Failed to create notification", error.message);
  }
}

export async function listNotifications(recipientUserId: string, limit = 40): Promise<NotificationItem[]> {
  let rows: NotificationRow[] = [];
  let queryError: string | null = null;

  for (const selectColumns of NOTIFICATION_SELECT_CANDIDATES) {
    const response = await supabase
      .from("notifications")
      .select(selectColumns)
      .eq("recipient_user_id", recipientUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!response.error) {
      rows = (response.data as NotificationRow[] | null) ?? [];
      queryError = null;
      break;
    }

    queryError = response.error.message;
  }

  if (queryError) {
    console.error("Failed to load notifications", queryError);
    return [];
  }

  const actorIds = Array.from(new Set(rows.map((row) => row.actor_user_id).filter(Boolean)));
  const postIds = Array.from(new Set(rows.map((row) => row.post_id).filter(Boolean))) as string[];

  const [profilesResponse, postsResponse] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id,username,avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from("feed_posts").select("id,image_url").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResponse.error) {
    console.error("Failed to load notification profiles", profilesResponse.error.message);
  }
  if (postsResponse.error) {
    console.error("Failed to load notification posts", postsResponse.error.message);
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

  return rows.map((row) => {
    const actorProfile = profileById.get(row.actor_user_id);
    const post = row.post_id ? postById.get(row.post_id) : null;

    return {
      id: row.id,
      type: row.type,
      recipient_user_id: row.recipient_user_id,
      actor_user_id: row.actor_user_id,
      actor_username: actorProfile?.username ?? null,
      actor_avatar_url: actorProfile?.avatar_url ?? null,
      post_id: row.post_id ?? null,
      post_image_url: post?.image_url ?? null,
      comment_id: row.comment_id ?? null,
      created_at: row.created_at,
      read_at: row.read_at ?? row.clicked_at ?? null,
    };
  });
}

export async function markNotificationAsRead(notificationId: string, recipientUserId: string) {
  const now = new Date().toISOString();

  const readResponse = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", notificationId)
    .eq("recipient_user_id", recipientUserId);

  if (!readResponse.error) {
    return;
  }

  const clickedResponse = await supabase
    .from("notifications")
    .update({ clicked_at: now })
    .eq("id", notificationId)
    .eq("recipient_user_id", recipientUserId);

  if (clickedResponse.error) {
    console.error("Failed to mark notification as read", clickedResponse.error.message);
  }
}
