"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { ProfileRecord } from "@/lib/types";

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET ?? "avatars";

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (!data.user) {
        setLoading(false);
        return;
      }

      setUserId(data.user.id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      const profile = profileData as ProfileRecord | null;
      setUsername(profile?.username ?? "");
      setCurrentAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSupabaseEnv || !userId) {
      return;
    }

    const nextUsername = username.trim();
    if (!nextUsername) {
      setMessage("Username is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data: takenData, error: takenError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", nextUsername)
      .neq("id", userId)
      .limit(1);

    if (takenError) {
      setSaving(false);
      setMessage(takenError.message);
      return;
    }

    if (takenData && takenData.length > 0) {
      setSaving(false);
      setMessage("Username is already taken.");
      return;
    }

    let avatarUrl = currentAvatarUrl;

    if (avatarFile) {
      const avatarPath = `${userId}/${Date.now()}-${avatarFile.name.replace(/\s+/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(avatarPath, avatarFile, { contentType: avatarFile.type, upsert: false });

      if (uploadError) {
        setSaving(false);
        setMessage(uploadError.message);
        return;
      }

      const { data: avatarPublicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
      avatarUrl = avatarPublicUrl.publicUrl;
    }

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        username: nextUsername,
        avatar_url: avatarUrl,
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      setSaving(false);
      setMessage(upsertError.message);
      return;
    }

    await supabase.auth.updateUser({
      data: {
        username: nextUsername,
        avatar_url: avatarUrl,
      },
    });

    setCurrentAvatarUrl(avatarUrl);
    setAvatarFile(null);
    setSaving(false);
    setMessage("Profile updated.");
  };

  return (
    <section>
      <h1>Settings</h1>
      {!hasSupabaseEnv ? <p>Supabase env vars are missing.</p> : null}
      {loading ? <p>Loading settings...</p> : null}

      {!loading && hasSupabaseEnv ? (
        <form className="card settings-form" onSubmit={saveProfile}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            maxLength={40}
            onChange={(event) => setUsername(event.target.value)}
            required
            type="text"
            value={username}
          />

          <label htmlFor="avatar">Profile photo</label>
          <input
            accept="image/*"
            id="avatar"
            onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            type="file"
          />

          {currentAvatarUrl ? <img alt="Current avatar" className="avatar settings-avatar" src={currentAvatarUrl} /> : null}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Saving..." : "Save changes"}
          </button>

          <button
            className="secondary-button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            type="button"
          >
            Log out
          </button>

          {message ? <p className="auth-message">{message}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
