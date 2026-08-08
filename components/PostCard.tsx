import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Avatar } from './Avatar';
import { HeartIcon, CommentIcon } from './Icons';
import { MediaCarousel } from './MediaCarousel';
import { RichCaption } from './RichCaption';
import { deletePost, setPostLiked } from '@/lib/api';
import { likesLabel, timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Post } from '@/lib/types';

export function PostCard({
  post,
  viewerId,
  onDeleted,
}: {
  post: Post;
  viewerId: string;
  onDeleted?: (postId: string) => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [dotIndex, setDotIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTap = useRef(0);
  const pop = useRef(new Animated.Value(0)).current;
  const [showPop, setShowPop] = useState(false);

  const isOwn = post.author_id === viewerId;
  const mediaWidth = Math.min(width, 500);

  const applyLike = async (next: boolean) => {
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      await setPostLiked(post.id, viewerId, next);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  const runPop = () => {
    setShowPop(true);
    pop.setValue(0);
    Animated.timing(pop, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setShowPop(false));
  };

  const onMediaPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      runPop();
      if (!liked) applyLike(true);
    } else {
      lastTap.current = now;
    }
  };

  const openAuthor = () => router.push(`/user/${post.author.username}`);
  const openDetail = () => router.push(`/post/${post.id}`);

  const metaLine = [timeAgo(post.created_at), post.location].filter(Boolean).join(' · ');

  const popScale = pop.interpolate({
    inputRange: [0, 0.25, 0.6, 0.8, 1],
    outputRange: [0.3, 1.15, 0.95, 1, 1],
  });
  const popOpacity = pop.interpolate({ inputRange: [0, 0.25, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.line, paddingBottom: 12, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Pressable onPress={openAuthor}>
          <Avatar profile={post.author} size={30} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable onPress={openAuthor}>
            <Text style={{ fontWeight: '600', fontSize: 13, color: theme.ink }}>
              {post.author.username}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: theme.ink3 }}>{metaLine}</Text>
        </View>
        {isOwn ? (
          <Pressable onPress={() => setMenuOpen(true)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
            <Text style={{ color: theme.ink2, fontSize: 16, lineHeight: 16 }}>⋯</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable onPress={onMediaPress}>
        <View style={{ alignSelf: 'center' }}>
          <MediaCarousel media={post.post_media} width={mediaWidth} onIndexChange={setDotIndex} />
          {showPop ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: popOpacity,
                transform: [{ scale: popScale }],
              }}
            >
              <HeartIcon size={86} filled color={theme.accent} outline={theme.accent} />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 14,
          paddingTop: 9,
          paddingBottom: 2,
        }}
      >
        <Pressable onPress={() => applyLike(!liked)}>
          <HeartIcon filled={liked} color={theme.accent} outline={theme.ink} />
        </Pressable>
        <Pressable onPress={openDetail}>
          <CommentIcon color={theme.ink} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {post.post_media.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              flexDirection: 'row',
              gap: 4,
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            {post.post_media.map((m, i) => (
              <View
                key={m.id}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === dotIndex ? theme.accent : theme.chip,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 14, paddingVertical: 2 }}>
        <Text style={{ fontWeight: '600', fontSize: 13, color: theme.ink }}>
          {likesLabel(likeCount)}
        </Text>
      </View>

      {post.caption ? (
        <View style={{ paddingHorizontal: 14, paddingVertical: 2 }}>
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.ink }}>
            <Text onPress={openAuthor} style={{ fontWeight: '600' }}>
              {post.author.username}
            </Text>{' '}
            <RichCaption text={post.caption} />
          </Text>
        </View>
      ) : null}

      {post.comment_count > 0 ? (
        <Pressable onPress={openDetail} style={{ paddingHorizontal: 14, paddingTop: 4 }}>
          <Text style={{ fontSize: 13, color: theme.ink3 }}>
            View {post.comment_count === 1 ? '1 comment' : `all ${post.comment_count} comments`}
          </Text>
        </Pressable>
      ) : null}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 40 }}
          onPress={() => setMenuOpen(false)}
        >
          <View style={{ backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.line }}>
            <Pressable
              onPress={async () => {
                setMenuOpen(false);
                try {
                  await deletePost(post.id);
                  onDeleted?.(post.id);
                } catch {}
              }}
              style={{ padding: 14 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.accent }}>Delete post</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={{ padding: 14, borderTopWidth: 1, borderTopColor: theme.line }}
            >
              <Text style={{ fontSize: 13, color: theme.ink2 }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
