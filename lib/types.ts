export type FeedPost = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
  like_count: number;
  comment_count: number;
};

export type FeedComment = {
  id: string;
  post_id: string;
  user_id: string | null;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
  text: string;
  like_count: number;
};

export type ProfileRecord = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name: string | null;
};

export type NotificationType = "follow" | "post_like" | "comment" | "comment_like";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  recipient_profile_id: string;
  actor_profile_id: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  post_id: string | null;
  post_image_url: string | null;
  comment_id: string | null;
  created_at: string;
  read_at: string | null;
};
