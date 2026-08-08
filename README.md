# Simple Social

Photos and videos, in the order they happened. An iOS / Android / web app built with
Expo (React Native + TypeScript), expo-router, and Supabase.

## Stack

- **App**: Expo SDK 54, React Native, TypeScript, expo-router
- **Backend**: Supabase (Postgres + Auth + Storage) — project `juijqekwczzpmtxsismj`
  in the Simple Social organization. All access is enforced with row-level security;
  the app talks to Supabase directly with the publishable key.
- **Web hosting**: Vercel (`npx expo export -p web`, served from `dist/` — see `vercel.json`)
- **Native builds**: EAS Build → TestFlight / Play Console

## Local development

```bash
npm install
cp .env.example .env      # values are already filled in
npx expo start            # press i for iOS simulator, a for Android, w for web
```

## Environment variables

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Vercel, EAS, `.env` | `https://juijqekwczzpmtxsismj.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Vercel, EAS, `.env` | the `sb_publishable_…` key (safe to expose; RLS protects data) |

Both are baked into `eas.json` build profiles and set on the Vercel project.
No server-side secrets are required — the service-role/secret key stays out of
the app entirely.

## Database

Schema lives in the Supabase project as tracked migrations
(`core_tables`, `functions_and_triggers`, `rls_and_storage`):

- `profiles`, `posts`, `post_media`, `follows` (with `pending`/`accepted` for
  private accounts), `post_likes`, `comments` (threaded), `comment_likes`,
  `saved_posts`, `blocked_users`, `notifications`
- Triggers create profiles on signup, route follow requests, and fan out
  notifications (likes, comments, replies, mentions, follows, request accepts)
- Storage buckets: `media` (post photos/videos), `avatars`
- `get_email_for_username()` RPC enables logging in with a username

## Building for the stores

```bash
npm install -g eas-cli
eas login                      # your Expo account
eas build:configure            # links the project (one time)

# iOS → TestFlight
eas build --platform ios --profile production
eas submit --platform ios --latest

# Android → Play Console
eas build --platform android --profile production
eas submit --platform android --latest
```

Bundle IDs: `com.j9systems.simplesocial` (both platforms).

## Web deploy (Vercel)

Vercel builds with `npx expo export -p web` and serves `dist/` as a single-page
app (`vercel.json`). Connect this repo to the Vercel project and pushes to the
production branch will deploy automatically.
