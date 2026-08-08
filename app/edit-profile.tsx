import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { updateProfile, uploadAvatar } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function EditProfile() {
  const { theme } = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  if (!session || !profile) return null;

  const changeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const path = await uploadAvatar(session.user.id, result.assets[0].uri);
      await updateProfile(session.user.id, { avatar_url: path });
      await refreshProfile();
    } catch {
      Alert.alert('Avatar', 'Could not upload that image.');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(session.user.id, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      await refreshProfile();
      router.back();
    } catch {
      Alert.alert('Profile', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    color: theme.ink,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    fontSize: 13,
  } as const;

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
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.ink2, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontWeight: '600', fontSize: 15, flex: 1, textAlign: 'center', color: theme.ink }}>
          Edit profile
        </Text>
        <Pressable onPress={save} disabled={saving}>
          <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '600' }}>
            {saving ? 'Saving…' : 'Done'}
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Avatar profile={profile} size={84} />
          <Pressable onPress={changeAvatar}>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>
              Change profile photo
            </Text>
          </Pressable>
        </View>
        <View>
          <Text style={{ fontSize: 12, color: theme.ink2, marginBottom: 6 }}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme.ink3}
            style={inputStyle}
          />
        </View>
        <View>
          <Text style={{ fontSize: 12, color: theme.ink2, marginBottom: 6 }}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            placeholderTextColor={theme.ink3}
            multiline
            style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
