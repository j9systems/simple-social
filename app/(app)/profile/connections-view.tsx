"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { isMissingFullNameColumnError } from "@/lib/supabase-errors";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { ProfileRecord } from "@/lib/types";

type ConnectionMode = "followers" | "following";

type ConnectionRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name?: string | null;
};

type ConnectionsViewProps = {
  mode: ConnectionMode;
  username?: string;
};

function buildDisplayName(profile: ConnectionRow) {
  const fullName = profile.full_name?.trim();
  if (fullName) {
    return fullName;
  }
  return profile.username ?? "User";
}

export default function ConnectionsView({ mode, username }: ConnectionsViewProps) {
  const [targetProfile, setTargetProfile] = useState<ProfileRecord | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncAvatarVersion = () => {
      setAvatarVersion(readAvatarVersion());
    };

    syncAvatarVersion();
    window.addEventListener(AVATAR_UPDATED_EVENT, syncAvatarVersion);

    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, syncAvatarVersion);
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadConnections = async () => {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!userData.user) {
        setError("You need to be logged in to view this list.");
        setLoading(false);
        return;
      }

      const profileQuery = supabase.from("profiles").select("id,username,avatar_url,full_name");
      let profileResponse = username
        ? await profileQuery.eq("username", username).maybeSingle()
        : await profileQuery.eq("id", userData.user.id).maybeSingle();

      if (isMissingFullNameColumnError(profileResponse.error)) {
        const fallbackProfileQuery = supabase.from("profiles").select("id,username,avatar_url");
        profileResponse = username
          ? await fallbackProfileQuery.eq("username", username).maybeSingle()
          : await fallbackProfileQuery.eq("id", userData.user.id).maybeSingle();
      }

      if (!mounted) {
        return;
      }

      if (profileResponse.error) {
        setError(profileResponse.error.message);
        setLoading(false);
        return;
      }

      const profile = profileResponse.data as ProfileRecord | null;
      if (!profile) {
        setError(username ? `Profile @${username} was not found.` : "Profile not found.");
        setLoading(false);
        return;
      }
      setTargetProfile(profile);

      const followRowsResponse =
        mode === "followers"
          ? await supabase.from("follows").select("follower_id").eq("following_id", profile.id)
          : await supabase.from("follows").select("following_id").eq("follower_id", profile.id);

      if (!mounted) {
        return;
      }

      if (followRowsResponse.error) {
        setError(followRowsResponse.error.message);
        setLoading(false);
        return;
      }

      const connectionIds = (followRowsResponse.data ?? [])
        .map((row) => ("follower_id" in row ? row.follower_id : row.following_id))
        .filter((id): id is string => Boolean(id));

      if (connectionIds.length === 0) {
        setConnections([]);
        setLoading(false);
        return;
      }

      let profilesData: ConnectionRow[] | null = null;
      const profilesResponse = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .in("id", connectionIds);

      if (isMissingFullNameColumnError(profilesResponse.error)) {
        const fallbackProfilesResponse = await supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .in("id", connectionIds);

        if (!mounted) {
          return;
        }

        if (fallbackProfilesResponse.error) {
          setError(fallbackProfilesResponse.error.message);
          setLoading(false);
          return;
        }

        profilesData = (fallbackProfilesResponse.data as ConnectionRow[] | null) ?? [];
      } else {
        if (profilesResponse.error) {
          setError(profilesResponse.error.message);
          setLoading(false);
          return;
        }

        profilesData = (profilesResponse.data as ConnectionRow[] | null) ?? [];
      }

      if (!mounted) {
        return;
      }

      const profileById = new Map<string, ConnectionRow>();
      for (const row of profilesData) {
        if (row.id) {
          profileById.set(row.id, row);
        }
      }

      setConnections(connectionIds.map((id) => profileById.get(id)).filter(Boolean) as ConnectionRow[]);
      setLoading(false);
    };

    void loadConnections();

    return () => {
      mounted = false;
    };
  }, [mode, username]);

  const title = mode === "followers" ? "Followers" : "Following";
  const profilePath = username && targetProfile?.username ? `/u/${targetProfile.username}` : "/profile";
  const emptyMessage = useMemo(() => {
    if (mode === "followers") {
      return "No followers yet.";
    }
    return "Not following anyone yet.";
  }, [mode]);

  if (!hasSupabaseEnv) {
    return (
      <section className="connections-page">
        <h1>{title}</h1>
        <p>Supabase env vars are missing.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="connections-page">
        <h1>{title}</h1>
        <div aria-live="polite" className="feed-loading" role="status">
          <span aria-hidden="true" className="loading-spinner" />
          <span className="visually-hidden">Loading connections...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="connections-page">
        <h1>{title}</h1>
        <p>{error}</p>
      </section>
    );
  }

  return (
    <section className="connections-page">
      <header className="connections-header">
        <h1>{title}</h1>
        <Link className="connections-back-link" href={profilePath}>
          Back to profile
        </Link>
      </header>

      {connections.length === 0 ? <p>{emptyMessage}</p> : null}

      {connections.length > 0 ? (
        <ul className="connections-list">
          {connections.map((connection) => {
            const displayName = buildDisplayName(connection);

            if (!connection.username) {
              return (
                <li className="connections-item" key={connection.id}>
                  <div className="connections-link is-disabled">
                    <img
                      alt={`${displayName} avatar`}
                      className="avatar"
                      src={buildAvatarSrc(connection.avatar_url, avatarVersion)}
                    />
                    <span className="connections-copy">
                      <strong>{displayName}</strong>
                      <span>@unknown</span>
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li className="connections-item" key={connection.id}>
                <Link className="connections-link" href={`/u/${connection.username}`}>
                  <img
                    alt={`${displayName} avatar`}
                    className="avatar"
                    src={buildAvatarSrc(connection.avatar_url, avatarVersion)}
                  />
                  <span className="connections-copy">
                    <strong>{displayName}</strong>
                    <span>@{connection.username}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
