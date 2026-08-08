import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type NotificationPrefs = {
  push_enabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
};

/** Show notifications while the app is foregrounded. */
export function configureNotificationHandling() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask for permission (the OS prompt appears only on first ask) and register
 * this device's Expo push token so the backend can reach it.
 */
export async function registerForPush(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? 'cf4ca129-fe96-43cc-b649-b9b80c5078f6';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'token' }
      );
    return true;
  } catch {
    return false;
  }
}

export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await supabase
    .from('notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_PREFS };
  return {
    push_enabled: data.push_enabled,
    likes: data.likes,
    comments: data.comments,
    follows: data.follows,
    mentions: data.mentions,
  };
}

export async function saveNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  await supabase.from('notification_prefs').upsert({
    user_id: userId,
    ...prefs,
    updated_at: new Date().toISOString(),
  });
}
