import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type {
  AppNotification,
  CommentRow,
  FollowStatus,
  MediaType,
  Post,
  PostMedia,
  Profile,
} from './types';

const POST_SELECT =
  '*, author:profiles!posts_author_id_fkey(*), post_media(*), post_likes(count), comments(count)';

type RawPost = {
  id: string;
  author_id: string;
  caption: string | null;
  location: string | null;
  created_at: string;
  author: Profile;
  post_media: PostMedia[];
  post_likes: { count: number }[];
  comments: { count: number }[];
};

async function enrich(raw: RawPost[], viewerId: string): Promise<Post[]> {
  if (raw.length === 0) return [];
  const ids = raw.map((p) => p.id);
  const { data: mine } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', viewerId)
    .in('post_id', ids);
  const likedSet = new Set((mine ?? []).map((r) => r.post_id as string));
  return raw.map((p) => ({
    id: p.id,
    author_id: p.author_id,
    caption: p.caption,
    location: p.location,
    created_at: p.created_at,
    author: p.author,
    post_media: [...(p.post_media ?? [])].sort((a, b) => a.position - b.position),
    like_count: p.post_likes?.[0]?.count ?? 0,
    comment_count: p.comments?.[0]?.count ?? 0,
    liked_by_me: likedSet.has(p.id),
  }));
}

export async function fetchFeed(viewerId: string): Promise<Post[]> {
  const { data: follows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', viewerId)
    .eq('status', 'accepted');
  const authorIds = [viewerId, ...(follows ?? []).map((f) => f.followee_id as string)];
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .in('author_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return enrich((data ?? []) as unknown as RawPost[], viewerId);
}

export async function fetchExplore(viewerId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return enrich((data ?? []) as unknown as RawPost[], viewerId);
}

export async function fetchUserPosts(userId: string, viewerId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return enrich((data ?? []) as unknown as RawPost[], viewerId);
}

export async function fetchPost(postId: string, viewerId: string): Promise<Post | null> {
  const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).maybeSingle();
  if (!data) return null;
  const [post] = await enrich([data as unknown as RawPost], viewerId);
  return post;
}

export async function setPostLiked(postId: string, viewerId: string, liked: boolean) {
  if (liked) {
    await supabase.from('post_likes').upsert({ post_id: postId, user_id: viewerId });
  } else {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', viewerId);
  }
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

// ---------- comments ----------

type RawComment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  author: Profile;
  comment_likes: { count: number }[];
};

export async function fetchComments(postId: string, viewerId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_author_id_fkey(*), comment_likes(count)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const raw = (data ?? []) as unknown as RawComment[];
  const ids = raw.map((c) => c.id);
  let likedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: mine } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', viewerId)
      .in('comment_id', ids);
    likedSet = new Set((mine ?? []).map((r) => r.comment_id as string));
  }
  const toRow = (c: RawComment): CommentRow => ({
    id: c.id,
    post_id: c.post_id,
    author_id: c.author_id,
    parent_comment_id: c.parent_comment_id,
    body: c.body,
    created_at: c.created_at,
    author: c.author,
    like_count: c.comment_likes?.[0]?.count ?? 0,
    liked_by_me: likedSet.has(c.id),
    replies: [],
  });
  const top: CommentRow[] = [];
  const byId = new Map<string, CommentRow>();
  for (const c of raw) {
    const row = toRow(c);
    byId.set(row.id, row);
    if (!row.parent_comment_id) top.push(row);
  }
  for (const c of raw) {
    if (c.parent_comment_id) {
      const parent = byId.get(c.parent_comment_id);
      const row = byId.get(c.id);
      if (parent && row) parent.replies.push(row);
      else if (row) top.push(row);
    }
  }
  return top;
}

export async function addComment(
  postId: string,
  authorId: string,
  body: string,
  parentCommentId?: string | null
) {
  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    author_id: authorId,
    body,
    parent_comment_id: parentCommentId ?? null,
  });
  if (error) throw error;
}

export async function setCommentLiked(commentId: string, viewerId: string, liked: boolean) {
  if (liked) {
    await supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: viewerId });
  } else {
    await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', viewerId);
  }
}

// ---------- people / follows ----------

export async function searchUsers(query: string): Promise<Profile[]> {
  const q = query.trim().replace(/[%_]/g, '');
  if (!q) return [];
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(25);
  return (data ?? []) as Profile[];
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function getProfileStats(userId: string) {
  const [posts, followers, following] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('followee_id', userId)
      .eq('status', 'accepted'),
    supabase
      .from('follows')
      .select('followee_id', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .eq('status', 'accepted'),
  ]);
  return {
    posts: posts.count ?? 0,
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export async function getFollowStatus(viewerId: string, targetId: string): Promise<FollowStatus> {
  if (viewerId === targetId) return 'self';
  const { data } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', viewerId)
    .eq('followee_id', targetId)
    .maybeSingle();
  if (!data) return 'none';
  return data.status === 'accepted' ? 'accepted' : 'pending';
}

export async function follow(viewerId: string, targetId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: viewerId, followee_id: targetId });
  if (error && error.code !== '23505') throw error;
}

export async function unfollow(viewerId: string, targetId: string) {
  await supabase.from('follows').delete().eq('follower_id', viewerId).eq('followee_id', targetId);
}

export async function acceptFollowRequest(followerId: string, followeeId: string) {
  await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .eq('status', 'pending');
}

export async function declineFollowRequest(followerId: string, followeeId: string) {
  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .eq('status', 'pending');
}

export async function fetchFollowList(
  userId: string,
  kind: 'followers' | 'following'
): Promise<Profile[]> {
  if (kind === 'followers') {
    const { data } = await supabase
      .from('follows')
      .select('profile:profiles!follows_follower_id_fkey(*)')
      .eq('followee_id', userId)
      .eq('status', 'accepted');
    return ((data ?? []) as unknown as { profile: Profile }[]).map((r) => r.profile);
  }
  const { data } = await supabase
    .from('follows')
    .select('profile:profiles!follows_followee_id_fkey(*)')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  return ((data ?? []) as unknown as { profile: Profile }[]).map((r) => r.profile);
}

export async function fetchFollowRequests(viewerId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('follows')
    .select('profile:profiles!follows_follower_id_fkey(*)')
    .eq('followee_id', viewerId)
    .eq('status', 'pending');
  return ((data ?? []) as unknown as { profile: Profile }[]).map((r) => r.profile);
}

// ---------- notifications ----------

export async function fetchNotifications(viewerId: string): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(*)')
    .eq('recipient_id', viewerId)
    .order('created_at', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as unknown as (AppNotification & { post_thumb: never })[];
  const postIds = Array.from(new Set(rows.map((n) => n.post_id).filter(Boolean))) as string[];
  const thumbs = new Map<string, string>();
  if (postIds.length > 0) {
    const { data: media } = await supabase
      .from('post_media')
      .select('post_id, storage_path, position')
      .in('post_id', postIds)
      .eq('position', 0);
    for (const m of media ?? []) thumbs.set(m.post_id as string, m.storage_path as string);
  }
  return rows.map((n) => ({ ...n, post_thumb: n.post_id ? (thumbs.get(n.post_id) ?? null) : null }));
}

export async function markNotificationsRead(viewerId: string) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', viewerId)
    .eq('is_read', false);
}

export async function unreadCount(viewerId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', viewerId)
    .eq('is_read', false);
  return count ?? 0;
}

// ---------- posting / uploads ----------

export type ComposeItem = {
  uri: string;
  media_type: MediaType;
  width: number;
  height: number;
};

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
}

function extensionFor(item: ComposeItem): { ext: string; contentType: string } {
  if (item.media_type === 'video') return { ext: 'mp4', contentType: 'video/mp4' };
  const lower = item.uri.toLowerCase();
  if (lower.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

export async function createPost(
  authorId: string,
  items: ComposeItem[],
  caption: string,
  location: string,
  aspectRatio: number
): Promise<string> {
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      caption: caption.trim() || null,
      location: location.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  const postId = post.id as string;

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { ext, contentType } = extensionFor(item);
      const path = `${authorId}/${postId}/${i}.${ext}`;
      const buffer = await uriToArrayBuffer(item.uri);
      const { error: upErr } = await supabase.storage
        .from('media')
        .upload(path, buffer, { contentType, upsert: true });
      if (upErr) throw upErr;
      const { error: mediaErr } = await supabase.from('post_media').insert({
        post_id: postId,
        position: i,
        media_type: item.media_type,
        storage_path: path,
        aspect_ratio: Math.round(aspectRatio * 10000) / 10000,
      });
      if (mediaErr) throw mediaErr;
    }
  } catch (err) {
    await supabase.from('posts').delete().eq('id', postId);
    throw err;
  }
  return postId;
}

export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const buffer = await uriToArrayBuffer(uri);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function updateProfile(
  userId: string,
  fields: Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'avatar_url' | 'is_private'>>
) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  if (error) throw error;
}
