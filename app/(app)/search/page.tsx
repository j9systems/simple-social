"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { ProfileRecord } from "@/lib/types";

const SEARCH_LIMIT = 30;

type SearchProfile = ProfileRecord & {
  full_name?: string | null;
  name?: string | null;
};

function buildDisplayName(profile: SearchProfile) {
  const fullName = profile.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const name = profile.name?.trim();
  if (name) {
    return name;
  }

  if (profile.username) {
    return profile.username;
  }

  return "User";
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);

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

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let mounted = true;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const wildcard = `%${trimmed}%`;
      const isMissingColumnError = (message: string, columnName: string) =>
        message.includes(columnName) && (message.includes("column") || message.includes("schema cache"));

      const primaryResponse = await supabase
        .from("profiles")
        .select("id,username,avatar_url,full_name")
        .or(`username.ilike.${wildcard},full_name.ilike.${wildcard}`)
        .order("username", { ascending: true })
        .limit(SEARCH_LIMIT);

      if (!mounted) {
        return;
      }

      if (!primaryResponse.error) {
        setProfiles(((primaryResponse.data as SearchProfile[]) ?? []).filter((profile) => Boolean(profile.username)));
        setLoading(false);
        return;
      }

      const primaryErrorMessage = primaryResponse.error.message;
      if (!isMissingColumnError(primaryErrorMessage.toLowerCase(), "full_name")) {
        setProfiles([]);
        setLoading(false);
        setError(primaryErrorMessage);
        return;
      }

      const nameResponse = await supabase
        .from("profiles")
        .select("id,username,avatar_url,name")
        .or(`username.ilike.${wildcard},name.ilike.${wildcard}`)
        .order("username", { ascending: true })
        .limit(SEARCH_LIMIT);

      if (!mounted) {
        return;
      }

      if (!nameResponse.error) {
        setProfiles(((nameResponse.data as SearchProfile[]) ?? []).filter((profile) => Boolean(profile.username)));
        setLoading(false);
        return;
      }

      const nameErrorMessage = nameResponse.error.message;
      if (!isMissingColumnError(nameErrorMessage.toLowerCase(), "name")) {
        setProfiles([]);
        setLoading(false);
        setError(nameErrorMessage);
        return;
      }

      const usernameOnlyResponse = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .ilike("username", wildcard)
        .order("username", { ascending: true })
        .limit(SEARCH_LIMIT);

      if (!mounted) {
        return;
      }

      if (usernameOnlyResponse.error) {
        setProfiles([]);
        setError(usernameOnlyResponse.error.message);
      } else {
        setProfiles(((usernameOnlyResponse.data as SearchProfile[]) ?? []).filter((profile) => Boolean(profile.username)));
      }
      setLoading(false);
    }, 220);

    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setProfiles([]);
      setLoading(false);
      setError(null);
    }
  };

  const trimmedQuery = query.trim();
  const emptyMessage = useMemo(() => {
    if (!trimmedQuery || loading || error) {
      return null;
    }
    if (profiles.length === 0) {
      return "No users found.";
    }
    return null;
  }, [error, loading, profiles.length, trimmedQuery]);

  return (
    <section className="search-page">
      <h1>Search</h1>
      <p>Find users by name or username.</p>

      <div className="search-input-wrap">
        <input
          aria-label="Search users by name or username"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name or username"
          type="search"
          value={query}
        />
      </div>

      {!hasSupabaseEnv ? <p>Supabase env vars are missing.</p> : null}
      {loading ? <p>Searching...</p> : null}
      {error ? <p>{error}</p> : null}
      {emptyMessage ? <p>{emptyMessage}</p> : null}

      {profiles.length > 0 ? (
        <ul className="search-results">
          {profiles.map((profile) => {
            if (!profile.username) {
              return null;
            }

            const displayName = buildDisplayName(profile);
            const showUsername = displayName.toLowerCase() !== profile.username.toLowerCase();
            return (
              <li key={profile.id}>
                <Link className="search-result-link" href={`/u/${profile.username}`}>
                  <img
                    alt={`${displayName} avatar`}
                    className="avatar"
                    src={buildAvatarSrc(profile.avatar_url, avatarVersion)}
                  />
                  <span className="search-result-copy">
                    <strong>{displayName}</strong>
                    {showUsername ? <span>@{profile.username}</span> : null}
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
