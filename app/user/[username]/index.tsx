import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileView } from '@/components/ProfileView';
import { getProfileByUsername } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { theme } = useTheme();
  const { session, profile: me } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!username) return;
    getProfileByUsername(String(username))
      .then(setProfile)
      .finally(() => setLoaded(true));
  }, [username]);

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
        <Text style={{ fontWeight: '600', fontSize: 15, flex: 1, color: theme.ink }}>
          {profile?.username ?? String(username)}
        </Text>
        {profile?.is_private ? (
          <Text
            style={{
              fontSize: 11,
              color: theme.ink3,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 8,
              paddingHorizontal: 9,
              paddingVertical: 3,
              overflow: 'hidden',
            }}
          >
            Private
          </Text>
        ) : null}
      </View>
      {profile ? (
        <ProfileView
          profile={profile}
          viewerId={session.user.id}
          isOwn={me?.id === profile.id}
        />
      ) : loaded ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: theme.ink2, fontSize: 13 }}>User not found.</Text>
        </View>
      ) : (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}
