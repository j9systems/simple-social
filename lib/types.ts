export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
  created_at: string;
};

export type MediaType = 'photo' | 'video';

export type PostMedia = {
  id: string;
  post_id: string;
  position: number;
  media_type: MediaType;
  storage_path: string;
  aspect_ratio: number;
};

export type Post = {
  id: string;
  author_id: string;
  caption: string | null;
  location: string | null;
  created_at: string;
  author: Profile;
  post_media: PostMedia[];
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  author: Profile;
  like_count: number;
  liked_by_me: boolean;
  replies: CommentRow[];
};

export type FollowStatus = 'none' | 'pending' | 'accepted' | 'self';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'reply'
  | 'comment_like'
  | 'follow'
  | 'follow_request'
  | 'follow_accept'
  | 'mention';

export type AppNotification = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor: Profile;
  post_thumb: string | null;
};
