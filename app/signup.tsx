import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/Icons';
import { signUpWithEmail, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Signup() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    if (!email.trim() || !username.trim() || password.length < 8) {
      Alert.alert('Sign up', 'Fill in email, username, and a password of at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const { loggedIn } = await signUpWithEmail(email, username, password, displayName);
      if (!loggedIn) {
        Alert.alert(
          'Almost there',
          'Check your email to confirm your account, then log in.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
      // when a session is returned the auth listener redirects into the app
    } catch (err) {
      Alert.alert('Sign up failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    color: theme.ink,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 34 }}>
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <LogoMark size={64} color={theme.accent} />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '500',
              textAlign: 'center',
              marginBottom: 24,
              color: theme.accent,
            }}
          >
            Create your account
          </Text>
          <View style={{ gap: 10 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={inputStyle}
            />
            <TextInput
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase())}
              placeholder="Username"
              placeholderTextColor={theme.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name (optional)"
              placeholderTextColor={theme.ink3}
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (8+ characters)"
              placeholderTextColor={theme.ink3}
              secureTextEntry
              style={inputStyle}
            />
            <Pressable onPress={submit} disabled={busy} style={{ marginTop: 4 }}>
              <LinearGradient
                colors={theme.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 8, paddingVertical: 11, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
              >
                <Text style={{ color: '#f4f2fc', fontSize: 13, fontWeight: '600' }}>
                  {busy ? 'Creating account…' : 'Sign up'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
        <View
          style={{
            paddingVertical: 18,
            borderTopWidth: 1,
            borderTopColor: theme.line,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 12.5, color: theme.ink2 }}>
            Already have an account?{' '}
            <Text style={{ color: theme.accent, fontWeight: '600' }} onPress={() => router.back()}>
              Log in
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
