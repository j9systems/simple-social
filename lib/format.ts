export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(weeks / 52)}y`;
}

export function likesLabel(count: number): string {
  return count === 1 ? '1 like' : `${count} likes`;
}

/** Deterministic avatar background color from a user id. */
const AVATAR_COLORS = [
  '#6d5f92', '#8a6a5e', '#5e7a8a', '#5e8a6e', '#8a5e7f',
  '#7a8a5e', '#5e6a8a', '#8a815e', '#815e8a', '#5e8a85',
];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
