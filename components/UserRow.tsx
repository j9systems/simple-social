import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { useTheme } from '@/lib/theme';
import type { FollowStatus, Profile } from '@/lib/types';

export function UserRow({
  profile,
  viewerId,
  initialStatus,
  showButton = true,
}: {
  profile: Profile;
  viewerId: string;
  initialStatus: FollowStatus;
  showButton?: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<FollowStatus>(initialStatus);

  const open = () => router.push(`/user/${profile.username}`);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.line,
      }}
    >
      <Pressable onPress={open}>
        <Avatar profile={profile} size={38} />
      </Pressable>
      <Pressable onPress={open} style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '600', fontSize: 13, color: theme.ink }}>
            {profile.username}
          </Text>
          {profile.is_private ? (
            <Text
              style={{
                fontSize: 10,
                color: theme.ink3,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 8,
                paddingHorizontal: 7,
                paddingVertical: 1,
                overflow: 'hidden',
              }}
            >
              Private
            </Text>
          ) : null}
        </View>
        {profile.display_name ? (
          <Text style={{ fontSize: 12, color: theme.ink2 }}>{profile.display_name}</Text>
        ) : null}
      </Pressable>
      {showButton && status !== 'self' ? (
        <FollowButton viewerId={viewerId} target={profile} status={status} onChange={setStatus} />
      ) : null}
    </View>
  );
}
