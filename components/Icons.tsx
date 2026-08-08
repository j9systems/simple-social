import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export function LogoMark({ size = 24, color = '#9184d9' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={1.1}>
        <Rect x="5.7" y="2.7" width="15.6" height="15.6" rx="4.5" />
        <Rect x="2.7" y="5.7" width="15.6" height="15.6" rx="4.5" />
        <Path d="M16.2 12L14.1 15.64L9.9 15.64L7.8 12L9.9 8.36L14.1 8.36Z" />
        <Path d="M16.2 12L18.3 8.36M14.1 15.64L18.3 15.64M9.9 15.64L11.44 18.3M7.8 12L5.7 15.64M9.9 8.36L5.7 8.36M14.1 8.36L12.57 5.7" />
      </G>
    </Svg>
  );
}

export function HeartIcon({
  size = 22,
  filled,
  color,
  outline,
}: {
  size?: number;
  filled: boolean;
  color: string;
  outline: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={filled ? color : 'none'}
        stroke={filled ? color : outline}
        strokeWidth={1.7}
      />
    </Svg>
  );
}

export function CommentIcon({ size = 21, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.5c-4.97 0-9 3.36-9 7.5 0 1.86.82 3.56 2.17 4.87L4.5 20.5l4.13-1.65c1.03.3 2.16.47 3.37.47 4.97 0 9-3.36 9-7.5s-4.03-8.32-9-8.32z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HomeIcon({ size = 23, active, color }: { size?: number; active: boolean; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({ size = 23, active, color }: { size?: number; active: boolean; color: string }) {
  const w = active ? 2.4 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke={color} strokeWidth={w} />
      <Path d="M15.5 15.5L21 21" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </Svg>
  );
}

export function ComposeIcon({ size = 23, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.5" y="3.5" width="17" height="17" rx="6" fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M12 8.5v7M8.5 12h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ size = 23, active, color }: { size?: number; active: boolean; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3a6 6 0 0 0-6 6v3.3c0 .8-.3 1.6-.9 2.2L4 15.6c-.6.6-.2 1.9.7 1.9h14.6c.9 0 1.3-1.3.7-1.9l-1.1-1.1a3.1 3.1 0 0 1-.9-2.2V9a6 6 0 0 0-6-6z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M9.8 20a2.3 2.3 0 0 0 4.4 0" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function PinIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
      />
      <Circle cx="12" cy="10" r="2.6" fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

export function PlayIcon({ size = 13, color = '#e9e9ed' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5v13l11-6.5z" fill={color} />
    </Svg>
  );
}

export function LockIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="10.5" width="14" height="9.5" rx="2" fill="none" stroke={color} strokeWidth={1.6} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}
