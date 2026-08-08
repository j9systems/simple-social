import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/Icons';
import { PostCard } from '@/components/PostCard';
import { fetchFeed } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import type { Post } from '@/lib/types';

export default function Feed() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const data = await fetchFeed(session.user.id);
      setPosts(data);
    } catch {}
    setLoaded(true);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!session) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.line,
        }}
      >
        <LogoMark size={24} color={theme.accent} />
        <Text style={{ fontSize: 17, fontWeight: '500', color: theme.ink, letterSpacing: -0.2 }}>
          simple social
        </Text>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            viewerId={session.user.id}
            onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          loaded ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.ink2, fontSize: 13, textAlign: 'center' }}>
                Your feed is empty. Find people to follow in Search, or share your first post.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
