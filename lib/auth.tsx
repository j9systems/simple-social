import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) loadProfile(next.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Sign in with a username or an email address. */
export async function signInWithUsernameOrEmail(identifier: string, password: string) {
  let email = identifier.trim();
  if (!email.includes('@')) {
    const { data, error } = await supabase.rpc('get_email_for_username', {
      p_username: email,
    });
    if (error || !data) throw new Error('No account found with that username.');
    email = data as string;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUpWithEmail(
  email: string,
  username: string,
  password: string,
  displayName?: string
) {
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9._]{3,30}$/.test(clean)) {
    throw new Error('Usernames are 3–30 characters: lowercase letters, numbers, dots, underscores.');
  }
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', clean)
    .maybeSingle();
  if (taken) throw new Error('That username is taken.');
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: clean, display_name: displayName?.trim() || null } },
  });
  if (error) throw new Error(error.message);
}
