"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { ProfileRecord } from "@/lib/types";

const SEARCH_LIMIT = 30;

type SearchProfile = ProfileRecord & {
  full_name?: string | null;
};

function buildName(profile: SearchProfile) {
  const fullName = profile.full_name?.trim();
  return fullName || null;
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

      const canFallbackToUsernameOnly =
        primaryResponse.error.message.includes("full_name") ||
        primaryResponse.error.message.includes("column");

      if (!canFallbackToUsernameOnly) {
        setProfiles([]);
        setLoading(false);
        setError(primaryResponse.error.message);
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

            const name = buildName(profile);
            const title = name ?? `@${profile.username}`;
            return (
              <li key={profile.id}>
                <Link className="search-result-link" href={`/u/${profile.username}`}>
                  <img
                    alt={`${name ?? profile.username} avatar`}
                    className="avatar"
                    src={buildAvatarSrc(profile.avatar_url, avatarVersion)}
                  />
                  <span className="search-result-copy">
                    <strong>{title}</strong>
                    {name ? <span>@{profile.username}</span> : null}
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
