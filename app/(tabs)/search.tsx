import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlayIcon } from '@/components/Icons';
import { UserRow } from '@/components/UserRow';
import { fetchExplore, searchUsers } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { publicUrl, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { FollowStatus, Post, Profile } from '@/lib/types';

export default function Search() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [statuses, setStatuses] = useState<Map<string, FollowStatus>>(new Map());
  const [explore, setExplore] = useState<Post[]>([]);

  useEffect(() => {
    if (!session) return;
    fetchExplore(session.user.id).then(setExplore).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const users = await searchUsers(q);
        if (cancelled) return;
        const { data: rels } = await supabase
          .from('follows')
          .select('followee_id, status')
          .eq('follower_id', session.user.id)
          .in('followee_id', users.map((u) => u.id));
        const map = new Map<string, FollowStatus>();
        for (const u of users) {
          if (u.id === session.user.id) map.set(u.id, 'self');
          else map.set(u.id, 'none');
        }
        for (const r of rels ?? []) {
          map.set(r.followee_id as string, r.status === 'accepted' ? 'accepted' : 'pending');
        }
        setResults(users);
        setStatuses(map);
      } catch {}
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, session]);

  if (!session) return null;

  const cell = Math.floor(width / 3);
  const showExplore = query.trim().length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.line }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={theme.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: theme.line,
            backgroundColor: theme.surface,
            color: theme.ink,
            borderRadius: 8,
            paddingHorizontal: 13,
            paddingVertical: 9,
            fontSize: 13,
          }}
        />
      </View>

      {showExplore ? (
        <FlatList
          data={explore.filter((p) => p.post_media.length > 0)}
          keyExtractor={(p) => p.id}
          numColumns={3}
          columnWrapperStyle={{ gap: 2 }}
          contentContainerStyle={{ gap: 2, paddingBottom: 20 }}
          ListHeaderComponent={
            <Text
              style={{
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 8,
                fontSize: 11,
                fontWeight: '600',
                color: theme.ink3,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Explore
            </Text>
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
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <UserRow
              profile={item}
              viewerId={session.user.id}
              initialStatus={statuses.get(item.id) ?? 'none'}
            />
          )}
        />
      ) : (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: theme.ink2, fontSize: 13 }}>
            No people found for “{query.trim()}”
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
