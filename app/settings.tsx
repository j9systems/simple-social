import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Settings() {
  const { theme, mode, toggle } = useTheme();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [usernameDraft, setUsernameDraft] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);

  if (!session || !profile) return null;

  const usernameDirty = usernameDraft.trim().toLowerCase() !== profile.username;

  const saveUsername = async () => {
    const clean = usernameDraft.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(clean)) {
      Alert.alert(
        'Username',
        'Usernames are 3–30 characters: lowercase letters, numbers, dots, underscores.'
      );
      return;
    }
    setSaving(true);
    try {
      await updateProfile(session.user.id, { username: clean });
      await refreshProfile();
      Alert.alert('Username', 'Username updated.');
    } catch {
      Alert.alert('Username', 'That username is taken.');
    } finally {
      setSaving(false);
    }
  };

  const togglePrivate = async (next: boolean) => {
    setIsPrivate(next);
    try {
      await updateProfile(session.user.id, { is_private: next });
      await refreshProfile();
    } catch {
      setIsPrivate(!next);
    }
  };

  const logOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const rowStyle = {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
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
        <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4 }}>
          <Text style={{ color: theme.ink, fontSize: 22, lineHeight: 24 }}>‹</Text>
        </Pressable>
        <Text style={{ fontWeight: '600', fontSize: 15, color: theme.ink }}>Settings</Text>
      </View>
      <ScrollView>
        <View style={rowStyle}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink, marginBottom: 2 }}>
            Username
          </Text>
          <Text style={{ fontSize: 12, color: theme.ink2, marginBottom: 8 }}>
            How you appear across Simple Social
          </Text>
          <TextInput
            value={usernameDraft}
            onChangeText={(v) => setUsernameDraft(v.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: theme.surface,
              color: theme.ink,
              borderRadius: 8,
              paddingHorizontal: 13,
              paddingVertical: 9,
              fontSize: 13,
            }}
          />
          {usernameDirty ? (
            <Pressable
              onPress={saveUsername}
              disabled={saving}
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: theme.accent,
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 7,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>
                {saving ? 'Saving…' : 'Save username'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[rowStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>Private account</Text>
            <Text style={{ fontSize: 12, color: theme.ink2 }}>
              Only followers you approve can see your posts
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={togglePrivate}
            trackColor={{ true: theme.accent, false: theme.chip }}
            thumbColor="#e9e9ed"
          />
        </View>

        <View style={[rowStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>Dark mode</Text>
            <Text style={{ fontSize: 12, color: theme.ink2 }}>Switch the app appearance</Text>
          </View>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggle}
            trackColor={{ true: theme.accent, false: theme.chip }}
            thumbColor="#e9e9ed"
          />
        </View>

        <Pressable onPress={logOut} style={rowStyle}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.accent }}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
