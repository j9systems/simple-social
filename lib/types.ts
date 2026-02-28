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

export type ProfileRecord = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name?: string | null;
};
