import { Redirect, Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Avatar } from '@/components/Avatar';
import { BellIcon, ComposeIcon, HomeIcon, SearchIcon } from '@/components/Icons';
import { unreadCount } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { profile, session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [unread, setUnread] = useState(0);

  const activeIndex = state.index;
  const routeName = state.routes[activeIndex]?.name;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const n = await unreadCount(session.user.id);
        if (!cancelled) setUnread(n);
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session, routeName]);

  const go = (name: string) => {
    const target = state.routes.find((r) => r.name === name);
    if (!target) return;
    navigation.navigate(name as never);
  };

  const iconColor = (name: string) => (routeName === name ? theme.accent : theme.ink2);

  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: theme.line,
        backgroundColor: theme.surface,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <Pressable onPress={() => go('index')} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
        <HomeIcon active={routeName === 'index'} color={iconColor('index')} />
      </Pressable>
      <Pressable onPress={() => go('search')} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
        <SearchIcon active={routeName === 'search'} color={iconColor('search')} />
      </Pressable>
      <Pressable
        onPress={() => router.push('/compose')}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
      >
        <ComposeIcon color={theme.ink2} />
      </Pressable>
      <Pressable
        onPress={() => go('activity')}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
      >
        <View>
          <BellIcon active={routeName === 'activity'} color={iconColor('activity')} />
          {unread > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -10,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: theme.accent,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                borderWidth: 2,
                borderColor: theme.surface,
              }}
            >
              <Text style={{ color: '#f4f2fc', fontSize: 9.5, fontWeight: '700' }}>{unread}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={() => go('profile')} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
        {profile ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: routeName === 'profile' ? 2 : 0,
              borderColor: theme.accent,
              padding: routeName === 'profile' ? 1 : 3,
            }}
          >
            <Avatar profile={profile} size={24} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { session, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
