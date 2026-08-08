import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileView } from '@/components/ProfileView';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function MyProfile() {
  const { theme } = useTheme();
  const { session, profile } = useAuth();
  if (!session || !profile) return null;
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
        <Text style={{ fontWeight: '600', fontSize: 15, flex: 1, color: theme.ink }}>
          {profile.username}
        </Text>
        {profile.is_private ? (
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
      <ProfileView profile={profile} viewerId={session.user.id} isOwn />
    </SafeAreaView>
  );
}
