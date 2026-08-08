import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_PREFS,
  fetchNotificationPrefs,
  registerForPush,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/push';
import { useTheme } from '@/lib/theme';

export default function Settings() {
  const { theme, mode, toggle } = useTheme();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [usernameDraft, setUsernameDraft] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({ ...DEFAULT_PREFS });

  const userId = session?.user.id;
  useEffect(() => {
    if (userId) fetchNotificationPrefs(userId).then(setPrefs).catch(() => {});
  }, [userId]);

  if (!session || !profile) return null;

  const setPref = async (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await saveNotificationPrefs(session.user.id, next);
      if (key === 'push_enabled' && value) {
        // re-request OS permission / re-register this device if needed
        const ok = await registerForPush(session.user.id);
        if (!ok) {
          Alert.alert(
            'Notifications',
            'Notifications are turned off for Simple Social in your device Settings. Enable them there to receive pushes.'
          );
        }
      }
    } catch {
      setPrefs(prefs);
    }
  };

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

        <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: theme.ink3,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Notifications
          </Text>
        </View>

        <View style={[rowStyle, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>
              Push notifications
            </Text>
            <Text style={{ fontSize: 12, color: theme.ink2 }}>
              Get notified on this device
            </Text>
          </View>
          <Switch
            value={prefs.push_enabled}
            onValueChange={(v) => setPref('push_enabled', v)}
            trackColor={{ true: theme.accent, false: theme.chip }}
            thumbColor="#e9e9ed"
          />
        </View>

        {(
          [
            ['likes', 'Likes', 'When someone likes your posts or comments'],
            ['comments', 'Comments', 'Comments on your posts and replies to you'],
            ['follows', 'Follows', 'New followers and follow requests'],
            ['mentions', 'Mentions', 'When someone @mentions you'],
          ] as const
        ).map(([key, label, description]) => (
          <View
            key={key}
            style={[
              rowStyle,
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: prefs.push_enabled ? 1 : 0.45,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.ink }}>{label}</Text>
              <Text style={{ fontSize: 12, color: theme.ink2 }}>{description}</Text>
            </View>
            <Switch
              value={prefs[key]}
              onValueChange={(v) => setPref(key, v)}
              disabled={!prefs.push_enabled}
              trackColor={{ true: theme.accent, false: theme.chip }}
              thumbColor="#e9e9ed"
            />
          </View>
        ))}

        <Pressable onPress={logOut} style={rowStyle}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.accent }}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
