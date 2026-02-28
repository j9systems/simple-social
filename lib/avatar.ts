export const AVATAR_VERSION_KEY = "simple-social:avatar-version";
export const AVATAR_UPDATED_EVENT = "simple-social:avatar-updated";

export function buildAvatarSrc(avatarUrl: string | null | undefined, version: number) {
  if (!avatarUrl) {
    return "/next.svg";
  }

  const separator = avatarUrl.includes("?") ? "&" : "?";
  return `${avatarUrl}${separator}v=${version}`;
}

export function readAvatarVersion() {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedValue = window.localStorage.getItem(AVATAR_VERSION_KEY);
  if (!storedValue) {
    return 0;
  }

  const parsedValue = Number(storedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}
