import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { LockIcon, PlayIcon } from './Icons';
import { fetchUserPosts, getFollowStatus, getProfileStats } from '@/lib/api';
import { publicUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { FollowStatus, Post, Profile } from '@/lib/types';

export function ProfileView({
  profile,
  viewerId,
  isOwn,
  headerRight,
}: {
  profile: Profile;
  viewerId: string;
  isOwn: boolean;
  headerRight?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [status, setStatus] = useState<FollowStatus>(isOwn ? 'self' : 'none');
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const canView = isOwn || !profile.is_private || status === 'accepted';

  const load = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        getProfileStats(profile.id),
        isOwn ? Promise.resolve<FollowStatus>('self') : getFollowStatus(viewerId, profile.id),
      ]);
      setStats(s);
      setStatus(st);
      if (isOwn || !profile.is_private || st === 'accepted') {
        const p = await fetchUserPosts(profile.id, viewerId);
        setPosts(p);
      } else {
        setPosts([]);
      }
    } catch {}
    setLoaded(true);
  }, [profile.id, profile.is_private, viewerId, isOwn]);

  React.useEffect(() => {
    load();
  }, [load]);

  const cell = Math.floor(Math.min(width, 500) / 3);

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 }}>
        <Avatar profile={profile} size={72} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontWeight: '600', fontSize: 16, color: theme.ink }}>{stats.posts}</Text>
            <Text style={{ fontSize: 12, color: theme.ink2 }}>Posts</Text>
          </View>
          <Pressable
            style={{ alignItems: 'center' }}
            onPress={() => canView && router.push(`/user/${profile.username}/follows?kind=followers`)}
          >
            <Text style={{ fontWeight: '600', fontSize: 16, color: theme.ink }}>{stats.followers}</Text>
            <Text style={{ fontSize: 12, color: theme.ink2 }}>Followers</Text>
          </Pressable>
          <Pressable
            style={{ alignItems: 'center' }}
            onPress={() => canView && router.push(`/user/${profile.username}/follows?kind=following`)}
          >
            <Text style={{ fontWeight: '600', fontSize: 16, color: theme.ink }}>{stats.following}</Text>
            <Text style={{ fontSize: 12, color: theme.ink2 }}>Following</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 4 }}>
        {profile.display_name ? (
          <Text style={{ fontWeight: '600', fontSize: 13.5, color: theme.ink }}>{profile.display_name}</Text>
        ) : null}
        {profile.bio ? <Text style={{ fontSize: 13, color: theme.ink2 }}>{profile.bio}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14 }}>
        {isOwn ? (
          <>
            <Pressable
              onPress={() => router.push('/edit-profile')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.ink }}>Edit profile</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.ink }}>Settings</Text>
            </Pressable>
          </>
        ) : (
          <FollowButton
            viewerId={viewerId}
            target={profile}
            status={status}
            compact={false}
            onChange={(next) => {
              setStatus(next);
              load();
            }}
          />
        )}
      </View>
      {!canView && loaded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.line, paddingVertical: 44, paddingHorizontal: 40, alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 1.5,
              borderColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <LockIcon color={theme.accent} />
          </View>
          <Text style={{ fontWeight: '600', fontSize: 14, color: theme.ink, marginBottom: 4 }}>
            This account is private
          </Text>
          <Text style={{ fontSize: 13, color: theme.ink2, textAlign: 'center' }}>
            Follow this account to see their photos and videos.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={canView ? posts.filter((p) => p.post_media.length > 0) : []}
      keyExtractor={(p) => p.id}
      numColumns={3}
      columnWrapperStyle={{ gap: 2 }}
      contentContainerStyle={{ gap: 2, paddingBottom: 24 }}
      ListHeaderComponent={
        <View>
          {headerRight}
          {header}
          {canView ? <View style={{ borderTopWidth: 1, borderTopColor: theme.line }} /> : null}
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={theme.accent}
        />
      }
      renderItem={({ item }) => {
        const first = item.post_media[0];
        return (
          <Pressable onPress={() => router.push(`/post/${item.id}`)}>
            <View style={{ width: cell, height: cell }}>
              <Image
                source={{ uri: publicUrl('media', first.storage_path) }}
                style={{ width: cell, height: cell, backgroundColor: theme.chip }}
                contentFit="cover"
              />
              {first.media_type === 'video' ? (
                <View style={{ position: 'absolute', top: 6, right: 7 }}>
                  <PlayIcon size={12} />
                </View>
              ) : item.post_media.length > 1 ? (
                <Text style={{ position: 'absolute', top: 4, right: 7, color: '#e9e9ed', fontSize: 11 }}>
                  ❐
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
