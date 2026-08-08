import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/lib/theme';

/** Renders text with tappable @mentions. Must be nested inside a <Text>. */
export function RichCaption({ text }: { text: string }) {
  const { theme } = useTheme();
  const router = useRouter();
  const parts = text.split(/(@[a-z0-9._]{3,30})/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^@[a-z0-9._]{3,30}$/i.test(part) ? (
          <Text
            key={i}
            style={{ color: theme.accent }}
            onPress={() => router.push(`/user/${part.slice(1).toLowerCase()}`)}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </>
  );
}
