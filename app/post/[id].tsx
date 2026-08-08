import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { HeartIcon } from '@/components/Icons';
import { PostCard } from '@/components/PostCard';
import { RichCaption } from '@/components/RichCaption';
import { addComment, fetchComments, fetchPost, setCommentLiked } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { CommentRow, Post } from '@/lib/types';

function Comment({
  comment,
  viewerId,
  onReply,
  depth = 0,
}: {
  comment: CommentRow;
  viewerId: string;
  onReply: (c: CommentRow) => void;
  depth?: number;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const [liked, setLiked] = useState(comment.liked_by_me);
  const [likeCount, setLikeCount] = useState(comment.like_count);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      await setCommentLiked(comment.id, viewerId, next);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  const openAuthor = () => router.push(`/user/${comment.author.username}`);

  return (
    <View style={{ paddingTop: 11, paddingHorizontal: 14, marginLeft: depth > 0 ? 35 : 0 }}>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Pressable onPress={openAuthor}>
          <Avatar profile={comment.author} size={depth > 0 ? 22 : 26} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.ink }}>
            <Text onPress={openAuthor} style={{ fontWeight: '600' }}>
              {comment.author.username}
            </Text>{' '}
            <RichCaption text={comment.body} />
          </Text>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 3 }}>
            <Text style={{ fontSize: 11.5, color: theme.ink3 }}>{timeAgo(comment.created_at)}</Text>
            {depth === 0 ? (
              <Pressable onPress={() => onReply(comment)}>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: theme.ink3 }}>Reply</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable onPress={toggleLike} style={{ alignItems: 'center', gap: 1, paddingTop: 2 }}>
          <HeartIcon size={depth > 0 ? 13 : 14} filled={liked} color={theme.accent} outline={theme.ink3} />
          {likeCount > 0 ? (
            <Text style={{ fontSize: 10, color: theme.ink3 }}>{likeCount}</Text>
          ) : null}
        </Pressable>
      </View>
      {comment.replies.map((r) => (
        <Comment key={r.id} comment={r} viewerId={viewerId} onReply={onReply} depth={1} />
      ))}
    </View>
  );
}

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { session, profile } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!session || !id) return;
    try {
      const [p, c] = await Promise.all([
        fetchPost(String(id), session.user.id),
        fetchComments(String(id), session.user.id),
      ]);
      setPost(p);
      setComments(c);
    } catch {}
    setLoaded(true);
  }, [id, session]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session) return null;

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await addComment(String(id), session.user.id, body, replyTo?.id ?? null);
      setDraft('');
      setReplyTo(null);
      await load();
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.line,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4 }}>
          <Text style={{ color: theme.ink, fontSize: 22, lineHeight: 24 }}>‹</Text>
        </Pressable>
        <Text style={{ fontWeight: '600', fontSize: 15, color: theme.ink }}>Post</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {post ? (
          <>
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              ListHeaderComponent={
                <PostCard
                  post={post}
                  viewerId={session.user.id}
                  onDeleted={() => router.back()}
                />
              }
              renderItem={({ item }) => (
                <Comment
                  comment={item}
                  viewerId={session.user.id}
                  onReply={(c) => setReplyTo(c)}
                />
              )}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
            <View style={{ borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.surface }}>
              {replyTo ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    paddingTop: 7,
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.ink2 }}>
                    Replying to {replyTo.author.username}
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} style={{ paddingHorizontal: 4 }}>
                    <Text style={{ color: theme.ink2, fontWeight: '700' }}>×</Text>
                  </Pressable>
                </View>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 9,
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                }}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={
                    replyTo
                      ? `Reply to ${replyTo.author.username}…`
                      : `Comment as ${profile?.username ?? 'you'}…`
                  }
                  placeholderTextColor={theme.ink3}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: theme.line,
                    backgroundColor: theme.bg,
                    color: theme.ink,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    fontSize: 13,
                  }}
                />
                <Pressable onPress={submit} disabled={!draft.trim() || posting}>
                  <Text
                    style={{
                      color: draft.trim() ? theme.accent : theme.ink3,
                      fontWeight: '600',
                      fontSize: 13,
                      paddingHorizontal: 2,
                    }}
                  >
                    Post
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : loaded ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: theme.ink2, fontSize: 13 }}>Post not found.</Text>
          </View>
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
