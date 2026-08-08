import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinIcon, PlayIcon } from '@/components/Icons';
import { createPost, type ComposeItem } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

const RATIOS: { label: string; value: number }[] = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 0.8 },
  { label: '1.91:1', value: 1.91 },
];

export default function Compose() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<ComposeItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [ratio, setRatio] = useState(1);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [sharing, setSharing] = useState(false);

  if (!session) return null;

  const pick = async (kind: 'photo' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
      allowsMultipleSelection: kind === 'photo',
      selectionLimit: 10 - items.length,
      quality: 0.85,
    });
    if (result.canceled) return;
    const next: ComposeItem[] = result.assets.map((a) => ({
      uri: a.uri,
      media_type: kind,
      width: a.width ?? 1,
      height: a.height ?? 1,
    }));
    setItems((prev) => [...prev, ...next].slice(0, 10));
  };

  const share = async () => {
    if (items.length === 0 || sharing) return;
    setSharing(true);
    try {
      await createPost(session.user.id, items, caption, location, ratio);
      router.back();
    } catch (err) {
      Alert.alert('Share failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const previewWidth = Math.min(width, 500) - 32;
  const previewHeight = Math.round(previewWidth / ratio);
  const current = items[selected];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom']}>
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
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.ink2, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontWeight: '600', fontSize: 15, flex: 1, textAlign: 'center', color: theme.ink }}>
          New post
        </Text>
        <Pressable onPress={share} disabled={items.length === 0 || sharing}>
          <Text
            style={{
              color: items.length > 0 && !sharing ? theme.accent : theme.ink3,
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            {sharing ? 'Sharing…' : 'Share'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: theme.ink3,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Media
          </Text>

          <View
            style={{
              width: previewWidth,
              height: previewHeight,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: theme.chip,
              marginBottom: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {current ? (
              current.media_type === 'video' ? (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <PlayIcon size={28} color={theme.ink2} />
                  <Text style={{ color: theme.ink2, fontSize: 12 }}>Video selected</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: current.uri }}
                  style={{ width: previewWidth, height: previewHeight }}
                  contentFit="cover"
                />
              )
            ) : (
              <Text style={{ color: theme.ink3, fontSize: 13 }}>Pick a photo or video below</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {RATIOS.map((r) => (
              <Pressable
                key={r.label}
                onPress={() => setRatio(r.value)}
                style={{
                  borderWidth: 1,
                  borderColor: ratio === r.value ? theme.accent : theme.line,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    color: ratio === r.value ? theme.accent : theme.ink2,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
            <Text style={{ fontSize: 11.5, color: theme.ink3 }}>Aspect ratio</Text>
          </View>

          {items.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {items.map((item, i) => (
                  <View key={`${item.uri}-${i}`}>
                    <Pressable onPress={() => setSelected(i)}>
                      {item.media_type === 'video' ? (
                        <View
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 8,
                            backgroundColor: theme.chip,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: selected === i ? 2 : 0,
                            borderColor: theme.accent,
                          }}
                        >
                          <PlayIcon size={16} color={theme.ink2} />
                        </View>
                      ) : (
                        <Image
                          source={{ uri: item.uri }}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 8,
                            borderWidth: selected === i ? 2 : 0,
                            borderColor: theme.accent,
                          }}
                          contentFit="cover"
                        />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setItems((prev) => prev.filter((_, j) => j !== i));
                        setSelected(0);
                      }}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.line,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: theme.ink3, fontSize: 11, fontWeight: '700', lineHeight: 13 }}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <Pressable
              onPress={() => pick('photo')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.accent,
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>+ Photos</Text>
            </Pressable>
            <Pressable
              onPress={() => pick('video')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.accent,
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>+ Video</Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: theme.surface,
              borderRadius: 8,
              paddingHorizontal: 13,
              marginBottom: 10,
            }}
          >
            <PinIcon color={theme.ink3} />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Add location"
              placeholderTextColor={theme.ink3}
              style={{ flex: 1, color: theme.ink, paddingVertical: 11, fontSize: 13 }}
            />
          </View>

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption… use @ to tag people"
            placeholderTextColor={theme.ink3}
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: theme.surface,
              color: theme.ink,
              borderRadius: 8,
              paddingHorizontal: 13,
              paddingVertical: 11,
              fontSize: 13,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
