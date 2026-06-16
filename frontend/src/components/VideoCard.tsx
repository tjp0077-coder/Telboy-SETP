import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing } from "@/src/theme";

type Props = {
  source: string;
  poster?: string;
  style?: ViewStyle;
};

/**
 * Self-hosted vertical (9:16) video card with autoplay-muted, sound toggle,
 * and tap-to-play/pause overlay. Built on expo-video.
 */
export default function VideoCard({ source, poster, style }: Props) {
  const [muted, setMuted] = useState(true);
  const [overlayHidden, setOverlayHidden] = useState(false);

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Keep player.muted in sync with local state
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  // Track playing state for icon
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  // Auto-hide tap-to-play overlay shortly after first play
  useEffect(() => {
    if (isPlaying && !overlayHidden) {
      const t = setTimeout(() => setOverlayHidden(true), 1400);
      return () => clearTimeout(t);
    }
  }, [isPlaying, overlayHidden]);

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
    setOverlayHidden(false); // show overlay briefly on tap
  };

  return (
    <View style={[styles.card, shadow.card, style]} testID="schedule-video-card">
      <View style={styles.frame}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen
          allowsPictureInPicture
        />

        {/* Tap-anywhere to play/pause + central play icon when paused */}
        <Pressable
          onPress={togglePlay}
          style={StyleSheet.absoluteFill}
          testID="video-tap-area"
        >
          {(!isPlaying || !overlayHidden) ? (
            <View style={styles.centerOverlay} pointerEvents="none">
              <View style={styles.playPill}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={30}
                  color="#fff"
                  style={!isPlaying ? { marginLeft: 3 } : undefined}
                />
              </View>
            </View>
          ) : null}
        </Pressable>

        {/* Sound toggle (top-right) */}
        <Pressable
          onPress={() => setMuted((m) => !m)}
          style={styles.soundBtn}
          hitSlop={10}
          testID="video-sound-toggle"
        >
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  frame: {
    aspectRatio: 9 / 16,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  centerOverlay: {
    flex: 1, alignItems: "center", justifyContent: "center",
  },
  playPill: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.85)",
  },
  soundBtn: {
    position: "absolute", top: spacing.md, right: spacing.md,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
});
