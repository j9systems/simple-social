import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { follow, unfollow } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import type { FollowStatus, Profile } from '@/lib/types';

export function FollowButton({
  viewerId,
  target,
  status,
  onChange,
  compact = true,
}: {
  viewerId: string;
  target: Profile;
  status: FollowStatus;
  onChange: (next: FollowStatus) => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  if (status === 'self') return null;

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (status === 'none') {
        await follow(viewerId, target.id);
        onChange(target.is_private ? 'pending' : 'accepted');
      } else {
        await unfollow(viewerId, target.id);
        onChange('none');
      }
    } finally {
      setBusy(false);
    }
  };

  const pad = compact
    ? { paddingVertical: 6, paddingHorizontal: 12 }
    : { paddingVertical: 8, paddingHorizontal: 0, flex: 1 as const, alignItems: 'center' as const };

  if (status === 'none') {
    return (
      <Pressable onPress={press} style={compact ? undefined : { flex: 1 }}>
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, pad]}
        >
          <Text style={styles.gradLabel}>Follow</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={press}
      style={[styles.btn, pad, { borderWidth: 1, borderColor: theme.line }, compact ? undefined : { flex: 1 }]}
    >
      <Text style={{ color: theme.ink2, fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
        {status === 'pending' ? 'Requested' : 'Following'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gradLabel: { color: '#f4f2fc', fontWeight: '600', fontSize: 12, textAlign: 'center' },
});
