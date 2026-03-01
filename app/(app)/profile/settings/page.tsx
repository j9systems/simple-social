"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_UPDATED_EVENT, AVATAR_VERSION_KEY, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { isMissingFullNameColumnError } from "@/lib/supabase-errors";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { ProfileRecord } from "@/lib/types";

const avatarBucket = "avatars";

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarCacheBuster, setAvatarCacheBuster] = useState<number>(() => readAvatarVersion());
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [supportsFullNameColumn, setSupportsFullNameColumn] = useState(true);

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
      const primaryProfileResponse = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .eq("id", data.user.id)
        .maybeSingle();
      let profileData = primaryProfileResponse.data;
      let profileError = primaryProfileResponse.error;

      if (isMissingFullNameColumnError(profileError)) {
        setSupportsFullNameColumn(false);
        const fallbackProfileResponse = await supabase
          .from("profiles")
          .select("id,username,avatar_url,full_name")
          .eq("id", data.user.id)
          .maybeSingle();
        profileData = fallbackProfileResponse.data;
        profileError = fallbackProfileResponse.error;
      }

      if (!mounted) {
        return;
      }

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      const profile = profileData as ProfileRecord | null;
      const profileUsername = profile?.username ?? "";
      setFullName(profile?.full_name?.trim() || profileUsername);
      setUsername(profile?.username ?? "");
      setCurrentAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSupabaseEnv || !userId) {
      return;
    }

    const nextUsername = username.trim();
    const nextFullName = fullName.trim() || nextUsername;
    if (!nextUsername) {
      setMessage("Username is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data: takenData, error: takenError } = await supabase
      .from("profiles")
      .select("id,username,avatar_url,full_name")
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
      const avatarPath = `${userId}/avatar.jpeg`;

      const { error: uploadError } = await supabase.storage
        .from(avatarBucket)
        .upload(avatarPath, avatarFile, { contentType: avatarFile.type, upsert: true });

      if (uploadError) {
        setSaving(false);
        setMessage(uploadError.message);
        return;
      }

      const { data: avatarPublicUrl } = supabase.storage.from(avatarBucket).getPublicUrl(avatarPath);
      avatarUrl = avatarPublicUrl.publicUrl;
    }

    const profileUpdatePayload: { username: string; avatar_url: string | null; full_name?: string } = {
      username: nextUsername,
      avatar_url: avatarUrl,
    };
    if (supportsFullNameColumn) {
      profileUpdatePayload.full_name = nextFullName;
    }

    let updateResponse = await supabase
      .from("profiles")
      .update(profileUpdatePayload)
      .eq("id", userId)
      .select("id,username,avatar_url,full_name")
      .maybeSingle();

    if (
      updateResponse.error &&
      supportsFullNameColumn &&
      isMissingFullNameColumnError(updateResponse.error)
    ) {
      setSupportsFullNameColumn(false);
      updateResponse = await supabase
        .from("profiles")
        .update({
          username: nextUsername,
          avatar_url: avatarUrl,
        })
        .eq("id", userId)
        .select("id,username,avatar_url,full_name")
        .maybeSingle();
    }

    const { data: updatedProfile, error: updateError } = updateResponse;

    if (updateError) {
      setSaving(false);
      setMessage(updateError.message);
      return;
    }

    if (!updatedProfile) {
      setSaving(false);
      setMessage("Profile not found.");
      return;
    }

    await supabase.auth.updateUser({
      data: {
        full_name: nextFullName,
        username: nextUsername,
        avatar_url: avatarUrl,
      },
    });

    setCurrentAvatarUrl(avatarUrl);
    if (avatarFile) {
      const nextAvatarVersion = Date.now();
      setAvatarCacheBuster(nextAvatarVersion);
      window.localStorage.setItem(AVATAR_VERSION_KEY, String(nextAvatarVersion));
      window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
    }
    setAvatarPreviewUrl(null);
    setAvatarFile(null);
    setSaving(false);
    setMessage("Profile updated.");
  };

  const displayedAvatarUrl = avatarPreviewUrl
    ? avatarPreviewUrl
    : currentAvatarUrl
      ? buildAvatarSrc(currentAvatarUrl, avatarCacheBuster)
      : null;

  return (
    <section>
      <h1>Settings</h1>
      {!hasSupabaseEnv ? <p>Supabase env vars are missing.</p> : null}
      {loading ? <p>Loading settings...</p> : null}

      {!loading && hasSupabaseEnv ? (
        <form className="card settings-form" onSubmit={saveProfile}>
          <label htmlFor="full-name">Name</label>
          <input
            id="full-name"
            maxLength={80}
            onChange={(event) => setFullName(event.target.value)}
            type="text"
            value={fullName}
          />

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
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setAvatarFile(nextFile);
              if (nextFile) {
                setAvatarPreviewUrl(URL.createObjectURL(nextFile));
                return;
              }

              setAvatarPreviewUrl(null);
            }}
            type="file"
          />

          {displayedAvatarUrl ? (
            <img alt="Current avatar" className="avatar settings-avatar" src={displayedAvatarUrl} />
          ) : null}

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
