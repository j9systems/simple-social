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
import { signInWithUsernameOrEmail, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  const logIn = async () => {
    if (!identifier.trim() || !password) return;
    setBusy(true);
    try {
      await signInWithUsernameOrEmail(identifier, password);
    } catch (err) {
      Alert.alert('Log in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    let email = identifier.trim();
    if (!email) {
      Alert.alert('Forgot password', 'Enter your username or email first.');
      return;
    }
    if (!email.includes('@')) {
      const { data } = await supabase.rpc('get_email_for_username', { p_username: email });
      if (!data) {
        Alert.alert('Forgot password', 'No account found with that username.');
        return;
      }
      email = data as string;
    }
    await supabase.auth.resetPasswordForEmail(email);
    Alert.alert('Forgot password', 'If that account exists, a reset email is on its way.');
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
            <LogoMark size={88} color={theme.accent} />
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '500',
              letterSpacing: 0.5,
              textAlign: 'center',
              marginBottom: 4,
              color: theme.accent,
            }}
          >
            simple social
          </Text>
          <Text style={{ fontSize: 13, color: theme.ink2, marginBottom: 28, textAlign: 'center' }}>
            Photos and videos, in the order they happened.
          </Text>
          <View style={{ gap: 10 }}>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Username or email"
              placeholderTextColor={theme.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.ink3}
              secureTextEntry
              style={inputStyle}
            />
            <Pressable onPress={logIn} disabled={busy} style={{ marginTop: 4 }}>
              <LinearGradient
                colors={theme.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 8, paddingVertical: 11, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
              >
                <Text style={{ color: '#f4f2fc', fontSize: 13, fontWeight: '600' }}>
                  {busy ? 'Logging in…' : 'Log in'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
          <Pressable onPress={forgot}>
            <Text style={{ fontSize: 12, color: theme.ink3, textAlign: 'center', marginTop: 16 }}>
              Forgot password?
            </Text>
          </Pressable>
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
            Don&apos;t have an account?{' '}
            <Text
              style={{ color: theme.accent, fontWeight: '600' }}
              onPress={() => router.push('/signup')}
            >
              Sign up
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
