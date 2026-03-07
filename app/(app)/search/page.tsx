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
  display_name?: string | null;
};

type ViewerContext = {
  id: string | null;
  fullName: string;
  username: string;
  emailPrefix: string;
};

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildDisplayName(profile: SearchProfile, viewer: ViewerContext) {
  const fullName = profile.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const displayName = profile.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const name = profile.name?.trim();
  if (name) {
    return name;
  }

  const isOwnProfile = Boolean(viewer.id && profile.id === viewer.id);
  if (isOwnProfile && viewer.fullName) {
    return viewer.fullName;
  }

  if (profile.username) {
    return profile.username;
  }

  if (isOwnProfile && viewer.username) {
    return viewer.username;
  }

  if (isOwnProfile && viewer.emailPrefix) {
    return viewer.emailPrefix;
  }

  return "User";
}

function profileMatchesQuery(profile: SearchProfile, viewer: ViewerContext, query: string) {
  const needle = normalizeSearchTerm(query);
  if (!needle) return true;

  const username = normalizeSearchTerm(profile.username ?? "");
  const displayName = normalizeSearchTerm(buildDisplayName(profile, viewer));
  const fullName = normalizeSearchTerm(profile.full_name ?? "");
  const profileDisplayName = normalizeSearchTerm(profile.display_name ?? "");
  const name = normalizeSearchTerm(profile.name ?? "");
  return (
    username.includes(needle) ||
    displayName.includes(needle) ||
    fullName.includes(needle) ||
    profileDisplayName.includes(needle) ||
    name.includes(needle)
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [viewerContext, setViewerContext] = useState<ViewerContext>({
    id: null,
    fullName: "",
    username: "",
    emailPrefix: "",
  });

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
    const loadViewerContext = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!mounted || userError || !data.user) {
        return;
      }

      const metadata = data.user.user_metadata ?? {};
      const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const username = typeof metadata.username === "string" ? metadata.username.trim() : "";
      const emailPrefix = data.user.email?.split("@")[0]?.trim() ?? "";

      setViewerContext({
        id: data.user.id,
        fullName,
        username,
        emailPrefix,
      });
    };

    void loadViewerContext();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    const trimmed = query.trim();
    const trimmedWithoutAt = trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
    if (!trimmedWithoutAt) {
      return;
    }

    let mounted = true;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const wildcard = `%${trimmedWithoutAt}%`;
      const rawWildcard = `%${trimmed}%`;
      const isMissingColumnError = (message: string, columnName: string) =>
        message.includes(columnName) && (message.includes("column") || message.includes("schema cache"));
      const attemptSearch = async (nameColumns: Array<"full_name" | "name" | "display_name">) => {
        const usernameFilters =
          trimmedWithoutAt === trimmed
            ? [`username.ilike.${wildcard}`]
            : [`username.ilike.${wildcard}`, `username.ilike.${rawWildcard}`];

        if (nameColumns.length === 0) {
          return supabase
            .from("profiles")
            .select("id,username,avatar_url")
            .or(usernameFilters.join(","))
            .order("username", { ascending: true })
            .limit(SEARCH_LIMIT);
        }

        const selectFields = `id,username,avatar_url,${nameColumns.join(",")}`;
        const nameFilters = nameColumns.map((columnName) => `${columnName}.ilike.${wildcard}`);
        const filters = [...usernameFilters, ...nameFilters].join(",");
        return supabase
          .from("profiles")
          .select(selectFields)
          .or(filters)
          .order("username", { ascending: true })
          .limit(SEARCH_LIMIT);
      };

      const attempts: Array<Array<"full_name" | "name" | "display_name">> = [
        ["full_name", "name", "display_name"],
        ["full_name", "display_name"],
        ["name", "display_name"],
        ["full_name", "name"],
        ["full_name"],
        ["name"],
        ["display_name"],
        [],
      ];

      for (const attemptColumns of attempts) {
        const response = await attemptSearch(attemptColumns);

        if (!mounted) {
          return;
        }

        if (!response.error) {
          const needle = trimmedWithoutAt || trimmed;
          setProfiles(
            ((response.data as SearchProfile[]) ?? []).filter(
              (profile) => Boolean(profile.username) && profileMatchesQuery(profile, viewerContext, needle),
            ),
          );
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
  }, [query, viewerContext]);

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

            const displayName = buildDisplayName(profile, viewerContext);
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
