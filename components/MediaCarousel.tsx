import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { PlayIcon } from './Icons';
import { publicUrl } from '@/lib/supabase';
import type { PostMedia } from '@/lib/types';

function VideoItem({
  url,
  width,
  height,
}: {
  url: string;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) player.pause();
    else player.play();
    setPlaying(!playing);
  };

  return (
    <View style={{ width, height }}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        onPress={toggle}
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(233,233,237,0.3)',
          backgroundColor: 'rgba(14,15,24,0.65)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {playing ? (
          <Text style={{ color: '#e9e9ed', fontSize: 12, fontWeight: '700' }}>❚❚</Text>
        ) : (
          <PlayIcon size={14} />
        )}
      </Pressable>
    </View>
  );
}

export function MediaCarousel({
  media,
  width,
  onIndexChange,
  countBadge = true,
}: {
  media: PostMedia[];
  width: number;
  onIndexChange?: (index: number) => void;
  countBadge?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const ratio = Number(media[0]?.aspect_ratio) || 1;
  const height = Math.round(width / ratio);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) {
      setIndex(i);
      onIndexChange?.(i);
    }
  };

  if (media.length === 0) return null;

  return (
    <View style={{ width, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEnabled={media.length > 1}
      >
        {media.map((m) =>
          m.media_type === 'video' ? (
            <VideoItem key={m.id} url={publicUrl('media', m.storage_path)} width={width} height={height} />
          ) : (
            <Image
              key={m.id}
              source={{ uri: publicUrl('media', m.storage_path) }}
              style={{ width, height, backgroundColor: '#101018' }}
              contentFit="cover"
              transition={120}
            />
          )
        )}
      </ScrollView>
      {countBadge && media.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(14,15,24,0.65)',
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#e9e9ed', fontSize: 11, fontWeight: '600' }}>
            {index + 1}/{media.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
