"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_UPDATED_EVENT, AVATAR_VERSION_KEY, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { isMissingFullNameColumnError } from "@/lib/supabase-errors";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";
import type { ProfileRecord } from "@/lib/types";

const avatarBucket = "avatars";
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

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
  const [darkModeEnabled, setDarkModeEnabled] = useState(() => readStoredTheme() === "dark");
  const [initialUsername, setInitialUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

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

      const metadata = data.user.user_metadata ?? {};
      setUserId(data.user.id);
      setFullName(typeof metadata.full_name === "string" ? metadata.full_name : "");
      setUsername(typeof metadata.username === "string" ? metadata.username.toLowerCase() : "");
      setCurrentAvatarUrl(typeof metadata.avatar_url === "string" ? metadata.avatar_url : null);

      const normalizeProfile = (
        row: { id: string; username: string | null; avatar_url: string | null; full_name?: string | null } | null,
      ): ProfileRecord | null => {
        if (!row) {
          return null;
        }

        return {
          id: row.id,
          username: row.username,
          avatar_url: row.avatar_url,
          full_name: row.full_name ?? null,
        };
      };

      const primaryProfileResponse = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .eq("id", data.user.id)
        .maybeSingle();
      let profileData = normalizeProfile(primaryProfileResponse.data);
      let profileError = primaryProfileResponse.error;

      if (isMissingFullNameColumnError(profileError)) {
        setSupportsFullNameColumn(false);
        const fallbackProfileResponse = await supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .eq("id", data.user.id)
          .maybeSingle();
        profileData = normalizeProfile(fallbackProfileResponse.data);
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

      const profile = profileData;
      const profileUsername = profile?.username ?? "";
      const profileFullName = profile?.full_name?.trim() || "";
      const metadataFullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const metadataUsername = typeof metadata.username === "string" ? metadata.username.toLowerCase() : "";
      const metadataAvatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
      const resolvedUsername = (profile?.username ?? metadataUsername).toLowerCase();
      setFullName(profileFullName || metadataFullName || profileUsername);
      setUsername(resolvedUsername);
      setInitialUsername(resolvedUsername);
      setCurrentAvatarUrl(profile?.avatar_url ?? metadataAvatarUrl);
      setLoading(false);
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv || loading || !userId) {
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedInitialUsername = initialUsername.trim();
    if (!trimmedUsername || trimmedUsername === trimmedInitialUsername) {
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", trimmedUsername)
        .neq("id", userId)
        .limit(1);

      if (cancelled) {
        return;
      }

      if (error) {
        setUsernameStatus("error");
        return;
      }

      setUsernameStatus(data && data.length > 0 ? "taken" : "available");
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [initialUsername, loading, userId, username]);

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

    const nextUsername = username.trim().toLowerCase();
    const nextFullName = fullName.trim() || nextUsername;
    if (!nextUsername) {
      setMessage("Username is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data: takenData, error: takenError } = await supabase
      .from("profiles")
      .select("id,username")
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

    const selectFields = supportsFullNameColumn ? "id,username,avatar_url,full_name" : "id,username,avatar_url";
    const primaryUpdateResponse = await supabase
      .from("profiles")
      .update(profileUpdatePayload)
      .eq("id", userId)
      .select(selectFields)
      .maybeSingle();
    let updateError = primaryUpdateResponse.error;
    const primaryProfileRow = primaryUpdateResponse.data as
      | { id: string; username: string | null; avatar_url: string | null; full_name?: string | null }
      | null;
    let updatedProfile = primaryProfileRow
      ? {
          ...primaryProfileRow,
          full_name: primaryProfileRow.full_name ?? nextFullName,
        }
      : null;

    if (primaryUpdateResponse.error && isMissingFullNameColumnError(primaryUpdateResponse.error)) {
      setSupportsFullNameColumn(false);
      const fallbackUpdateResponse = await supabase
        .from("profiles")
        .update({
          username: nextUsername,
          avatar_url: avatarUrl,
        })
        .eq("id", userId)
        .select("id,username,avatar_url")
        .maybeSingle();
      updateError = fallbackUpdateResponse.error;
      updatedProfile = fallbackUpdateResponse.data
        ? { ...fallbackUpdateResponse.data, full_name: nextFullName }
        : null;
    }

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
    setInitialUsername(nextUsername);
    setUsernameStatus("idle");
    setSaving(false);
    router.push("/profile");
    router.refresh();
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
          <div className="handle-input-wrap">
            <span aria-hidden="true" className="handle-input-prefix">
              @
            </span>
            <input
              autoComplete="username"
              id="username"
              maxLength={40}
              onChange={(event) => {
                const nextUsername = event.target.value.toLowerCase();
                setUsername(nextUsername);
                setUsernameStatus(
                  nextUsername.trim() && nextUsername.trim() !== initialUsername.trim() ? "checking" : "idle",
                );
              }}
              required
              type="text"
              value={username}
            />
          </div>
          {username.trim() && username.trim() !== initialUsername.trim() ? (
            <p className="auth-message">
              {usernameStatus === "checking" ? "Checking username..." : null}
              {usernameStatus === "available" ? "Username is available." : null}
              {usernameStatus === "taken" ? "Username is already taken." : null}
              {usernameStatus === "error" ? "Could not check username availability." : null}
            </p>
          ) : null}

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

          <div className="settings-theme-row">
            <div>
              <p className="settings-theme-title">Dark mode</p>
              <p className="settings-theme-hint">Use a darker color theme across the app.</p>
            </div>
            <label className="theme-toggle" htmlFor="dark-mode-toggle">
              <input
                checked={darkModeEnabled}
                id="dark-mode-toggle"
                onChange={(event) => {
                  const nextTheme = event.target.checked ? "dark" : "light";
                  setDarkModeEnabled(event.target.checked);
                  applyTheme(nextTheme);
                  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
                }}
                type="checkbox"
              />
              <span aria-hidden="true" className="theme-toggle-track" />
              <span className="visually-hidden">Enable dark mode</span>
            </label>
          </div>

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
