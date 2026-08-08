import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';
import { avatarColor } from '@/lib/format';
import { publicUrl } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export function Avatar({ profile, size = 30 }: { profile: Profile; size?: number }) {
  const radius = size / 2;
  if (profile.avatar_url) {
    return (
      <Image
        source={{ uri: publicUrl('avatars', profile.avatar_url) }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={80}
      />
    );
  }
  const initial = (profile.display_name || profile.username || '?').charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: avatarColor(profile.id),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#eceaf5', fontWeight: '600', fontSize: Math.max(10, size * 0.4) }}>
        {initial}
      </Text>
    </View>
  );
}
