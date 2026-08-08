import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRow } from '@/components/UserRow';
import { fetchFollowList, getProfileByUsername } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { FollowStatus, Profile } from '@/lib/types';

export default function Follows() {
  const { username, kind } = useLocalSearchParams<{ username: string; kind: string }>();
  const listKind = kind === 'following' ? 'following' : 'followers';
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [owner, setOwner] = useState<Profile | null>(null);
  const [list, setList] = useState<Profile[]>([]);
  const [statuses, setStatuses] = useState<Map<string, FollowStatus>>(new Map());

  useEffect(() => {
    if (!username || !session) return;
    (async () => {
      const p = await getProfileByUsername(String(username));
      if (!p) return;
      setOwner(p);
      const users = await fetchFollowList(p.id, listKind);
      const map = new Map<string, FollowStatus>();
      for (const u of users) map.set(u.id, u.id === session.user.id ? 'self' : 'none');
      if (users.length > 0) {
        const { data: rels } = await supabase
          .from('follows')
          .select('followee_id, status')
          .eq('follower_id', session.user.id)
          .in('followee_id', users.map((u) => u.id));
        for (const r of rels ?? []) {
          map.set(r.followee_id as string, r.status === 'accepted' ? 'accepted' : 'pending');
        }
      }
      setList(users);
      setStatuses(map);
    })();
  }, [username, listKind, session]);

  if (!session) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: theme.ink }}>
            {listKind === 'followers' ? 'Followers' : 'Following'}
          </Text>
          {owner ? (
            <Text style={{ fontSize: 11, color: theme.ink3 }}>{owner.username}</Text>
          ) : null}
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UserRow
            profile={item}
            viewerId={session.user.id}
            initialStatus={statuses.get(item.id) ?? 'none'}
            showButton={item.id !== session.user.id}
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: theme.ink2, fontSize: 13 }}>
              {listKind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
