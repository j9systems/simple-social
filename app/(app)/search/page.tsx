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
      const attemptSearch = async (nameColumns: Array<"full_name" | "name">) => {
        if (nameColumns.length === 0) {
          return supabase
            .from("profiles")
            .select("id,username,avatar_url")
            .ilike("username", wildcard)
            .order("username", { ascending: true })
            .limit(SEARCH_LIMIT);
        }

        const selectFields = `id,username,avatar_url,${nameColumns.join(",")}`;
        const filters = ["username", ...nameColumns].map((columnName) => `${columnName}.ilike.${wildcard}`).join(",");
        return supabase
          .from("profiles")
          .select(selectFields)
          .or(filters)
          .order("username", { ascending: true })
          .limit(SEARCH_LIMIT);
      };

      const attempts: Array<Array<"full_name" | "name">> = [["full_name", "name"], ["full_name"], ["name"], []];

      for (const attemptColumns of attempts) {
        const response = await attemptSearch(attemptColumns);

        if (!mounted) {
          return;
        }

        if (!response.error) {
          setProfiles(((response.data as SearchProfile[]) ?? []).filter((profile) => Boolean(profile.username)));
          setLoading(false);
          return;
        }

        const errorMessage = response.error.message;
        const lowered = errorMessage.toLowerCase();
        const isOnlyMissingColumnIssue =
          attemptColumns.length > 0 && attemptColumns.some((columnName) => isMissingColumnError(lowered, columnName));

        if (!isOnlyMissingColumnIssue) {
          setProfiles([]);
          setLoading(false);
          setError(errorMessage);
          return;
        }
      }

      setProfiles([]);
      setLoading(false);
      setError("Search is unavailable right now.");
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
                    <span>@{profile.username}</span>
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
