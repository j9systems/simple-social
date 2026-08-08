import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import {
  acceptFollowRequest,
  declineFollowRequest,
  fetchFollowRequests,
  fetchNotifications,
  markNotificationsRead,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { publicUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { AppNotification, Profile } from '@/lib/types';

const LINES: Record<string, string> = {
  like: 'liked your post.',
  comment: 'commented on your post.',
  reply: 'replied to your comment.',
  comment_like: 'liked your comment.',
  follow: 'started following you.',
  follow_request: 'requested to follow you.',
  follow_accept: 'accepted your follow request.',
  mention: 'mentioned you.',
};

export default function Activity() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [requests, setRequests] = useState<Profile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [n, r] = await Promise.all([
        fetchNotifications(session.user.id),
        fetchFollowRequests(session.user.id),
      ]);
      setNotifs(n);
      setRequests(r);
      markNotificationsRead(session.user.id).catch(() => {});
    } catch {}
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return null;

  const onRequest = async (profile: Profile, accept: boolean) => {
    if (accept) await acceptFollowRequest(profile.id, session.user.id);
    else await declineFollowRequest(profile.id, session.user.id);
    setRequests((prev) => prev.filter((p) => p.id !== profile.id));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.line }}>
        <Text style={{ fontWeight: '600', fontSize: 15, color: theme.ink }}>Activity</Text>
      </View>
      <FlatList
        data={notifs.filter((n) => n.type !== 'follow_request')}
        keyExtractor={(n) => n.id}
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
        ListHeaderComponent={
          requests.length > 0 ? (
            <View
              style={{
                margin: 14,
                marginBottom: 4,
                borderWidth: 1,
                borderColor: theme.line,
                backgroundColor: theme.surface,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: theme.ink3,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Follow {requests.length === 1 ? 'request' : 'requests'}
              </Text>
              {requests.map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Pressable onPress={() => router.push(`/user/${r.username}`)}>
                    <Avatar profile={r} size={34} />
                  </Pressable>
                  <Text style={{ flex: 1, fontSize: 13, color: theme.ink }}>
                    <Text style={{ fontWeight: '600' }}>{r.username}</Text> wants to follow you
                  </Text>
                  <Pressable
                    onPress={() => onRequest(r, true)}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.accent,
                      borderRadius: 8,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Confirm</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onRequest(r, false)}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.line,
                      borderRadius: 8,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: theme.ink2, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.line,
            }}
          >
            <Pressable onPress={() => router.push(`/user/${item.actor.username}`)}>
              <Avatar profile={item.actor} size={34} />
            </Pressable>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.ink }}>
              <Text style={{ fontWeight: '600' }}>{item.actor.username}</Text>{' '}
              {LINES[item.type] ?? 'sent you a notification.'}{' '}
              <Text style={{ color: theme.ink3 }}>{timeAgo(item.created_at)}</Text>
            </Text>
            {item.post_thumb ? (
              <Pressable onPress={() => router.push(`/post/${item.post_id}`)}>
                <Image
                  source={{ uri: publicUrl('media', item.post_thumb) }}
                  style={{ width: 38, height: 38, borderRadius: 4, backgroundColor: theme.chip }}
                  contentFit="cover"
                />
              </Pressable>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          requests.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.ink2, fontSize: 13 }}>No activity yet.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
