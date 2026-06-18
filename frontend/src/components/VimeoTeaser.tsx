import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

// Conditionally require WebView so the web bundle doesn't crash.
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch {
    WebView = null;
  }
}

const VIMEO_ID = "1202537119";
const VIMEO_PLAYER_URL = `https://player.vimeo.com/video/${VIMEO_ID}?autoplay=0&title=0&byline=0&portrait=0&dnt=1&playsinline=1`;
const VIMEO_OEMBED_URL = `https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F${VIMEO_ID}`;

// Video's natural aspect ratio (portrait 2:3 from oEmbed)
const ASPECT_W = 240;
const ASPECT_H = 360;
const ASPECT = ASPECT_W / ASPECT_H; // 0.666...

type Props = {
  /** Height reserved for the bottom tab bar so the thumbnail floats above it. */
  bottomOffset?: number;
  /** Caption shown over the thumbnail. */
  caption?: string;
  /** Approx pixels reserved above the thumbnail (hero + chips + top inset).
   *  When provided + `large` is true, the thumbnail expands to fill the gap
   *  between this top edge and the tab bar (maintaining 2:3 aspect ratio). */
  topReservedPx?: number;
  /** Expand the thumbnail to fill the bottom area (above the tab bar). */
  large?: boolean;
  /** Render inline in the normal flex flow (no absolute positioning).
   *  The thumbnail sizes itself to fit the parent container while
   *  maintaining its 2:3 aspect ratio. */
  inline?: boolean;
};

export default function VimeoTeaser({
  bottomOffset = 0,
  caption = "Watch the SETP 2026 teaser",
  topReservedPx = 0,
  large = false,
  inline = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [poster, setPoster] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  // Animation shared values for the expand/shrink transition
  const progress = useSharedValue(0); // 0 = thumbnail, 1 = fullscreen

  // Dimensions
  const { width: winW, height: winH } = Dimensions.get("window");

  // Track inline container size so the thumb can fill the flex parent.
  const [inlineBox, setInlineBox] = useState<{ w: number; h: number } | null>(null);

  // Thumbnail size: maintain 2:3 aspect ratio.
  //   - Inline mode: fit inside the parent's measured box (height-constrained).
  //   - Small mode: capped at ~32% of screen height (above the tab bar).
  //   - Large mode: fill the gap from below the hero/chips down to the tab bar.
  const { thumbWidth, thumbHeight } = useMemo(() => {
    if (inline) {
      if (!inlineBox) return { thumbWidth: 0, thumbHeight: 0 };
      const { w, h } = inlineBox;
      let height = h;
      let width = height * ASPECT;
      if (width > w) {
        width = w;
        height = width / ASPECT;
      }
      return { thumbWidth: Math.max(120, width), thumbHeight: Math.max(180, height) };
    }
    const availH = large
      ? Math.max(0, winH - bottomOffset - topReservedPx - 24)
      : winH * 0.32;
    const maxByWidth = winW - 24;
    let h = availH;
    if (h * ASPECT > maxByWidth) h = maxByWidth / ASPECT;
    h = Math.max(120, h);
    return { thumbWidth: h * ASPECT, thumbHeight: h };
  }, [inline, inlineBox, large, winH, winW, bottomOffset, topReservedPx]);

  // Fetch Vimeo poster frame from oEmbed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(VIMEO_OEMBED_URL);
        const data = await res.json();
        // Strip the size suffix to get a bigger thumbnail
        let url: string = data?.thumbnail_url || "";
        if (url) {
          url = url.replace(/_\d+x\d+(?=\?|$)/, "_640");
          if (!cancelled) setPoster(url);
        }
      } catch {
        // silent fail — keep dark placeholder
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fullscreen video size: fit inside safe-area window, maintain aspect ratio.
  const fsAvailW = winW - 24; // small margin on the sides
  const fsAvailH = winH - insets.top - insets.bottom - 24;
  // Pick the largest size that fits both
  let fsHeight = fsAvailH;
  let fsWidth = fsHeight * ASPECT;
  if (fsWidth > fsAvailW) {
    fsWidth = fsAvailW;
    fsHeight = fsWidth / ASPECT;
  }

  const openVideo = () => {
    setOpen(true);
    setPlayerReady(false);
    progress.value = withTiming(1, {
      duration: 250,
      easing: Easing.inOut(Easing.ease),
    });
  };

  const closeVideo = () => {
    progress.value = withTiming(
      0,
      { duration: 250, easing: Easing.inOut(Easing.ease) },
      (finished) => {
        if (finished) runOnJS(setOpen)(false);
      }
    );
  };

  // Animated styles: scale + translate from thumbnail position to centered fullscreen
  // The thumbnail sits anchored above the tab bar — compute its on-screen
  // center so the video appears to originate from there.
  const thumbBottom = bottomOffset + 12; // matches thumbWrap.bottom
  const thumbCenterY = winH - thumbBottom - thumbHeight / 2;
  const screenCenterY = winH / 2;
  const startTranslateY = thumbCenterY - screenCenterY;

  const playerAnimStyle = useAnimatedStyle(() => {
    const w = thumbWidth + (fsWidth - thumbWidth) * progress.value;
    const h = thumbHeight + (fsHeight - thumbHeight) * progress.value;
    const ty = startTranslateY * (1 - progress.value);
    return {
      width: w,
      height: h,
      transform: [{ translateY: ty }],
    };
  });

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // ─── Inline (thumbnail) rendering ─────────────────────────────────────────
  const ThumbInner = (
    <Pressable
      onPress={openVideo}
      accessibilityRole="button"
      accessibilityLabel="Play teaser video"
      style={[styles.thumb, { width: thumbWidth, height: thumbHeight }]}
      testID="vimeo-teaser-thumb"
    >
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.posterFallback]}>
          <ActivityIndicator color="#F2C265" />
        </View>
      )}

      {/* Play button overlay */}
      <View style={styles.playOverlay} pointerEvents="none">
        <View style={styles.playRing}>
          <Ionicons name="play" size={36} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </View>
      </View>
    </Pressable>
  );

  return (
    <>
      {inline ? (
        <View
          style={styles.inlineWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setInlineBox({ w: width, h: height });
          }}
        >
          {thumbWidth > 0 ? ThumbInner : null}
        </View>
      ) : (
        <View
          pointerEvents="box-none"
          style={[styles.thumbWrap, { bottom: bottomOffset + 12 }]}
        >
          {ThumbInner}
        </View>
      )}

      {/* ─── Fullscreen modal player ─────────────────────────────────── */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeVideo}
      >
        <View style={styles.modalRoot}>
          {/* Dimmed backdrop */}
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropAnimStyle]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeVideo} />
          </Animated.View>

          {/* Centered video container */}
          <View style={styles.modalCenter} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.videoBox,
                playerAnimStyle,
              ]}
            >
              {Platform.OS === "web" ? (
                // @ts-ignore - native DOM element via react-native-web
                <iframe
                  src={VIMEO_PLAYER_URL}
                  style={{ width: "100%", height: "100%", border: 0, borderRadius: 14 }}
                  allow="fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                  title="SETP 2026 Teaser"
                />
              ) : WebView ? (
                <>
                  <WebView
                    source={{ uri: VIMEO_PLAYER_URL }}
                    style={{ flex: 1, backgroundColor: "#000", borderRadius: 14 }}
                    javaScriptEnabled
                    domStorageEnabled
                    allowsFullscreenVideo
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={true}
                    onLoadEnd={() => setPlayerReady(true)}
                  />
                  {!playerReady && (
                    <View style={styles.videoLoading} pointerEvents="none">
                      <ActivityIndicator color="#F2C265" size="large" />
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.videoLoading}>
                  <Text style={{ color: "#fff" }}>Player unavailable</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Shrink-back button (top-right) */}
          <Pressable
            onPress={closeVideo}
            hitSlop={12}
            style={[styles.shrinkBtn, { top: insets.top + 12 }]}
            accessibilityRole="button"
            accessibilityLabel="Close video"
            testID="vimeo-shrink-btn"
          >
            <Ionicons name="contract" size={18} color="#1A2841" />
            <Text style={styles.shrinkBtnText}>Shrink Back</Text>
          </Pressable>

          {Platform.OS === "android" && open ? (
            <StatusBar hidden={false} translucent backgroundColor="rgba(0,0,0,0.85)" />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Thumbnail container — anchored absolutely above the tab bar
  thumbWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  // Inline (flex) layout — fills the parent flex space
  inlineWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0F1A2E",
    borderWidth: 1,
    borderColor: "rgba(242, 194, 101, 0.45)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  posterFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F1A2E",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#3C284C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 7,
  },
  captionPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(15, 26, 46, 0.78)",
  },
  captionText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  // Modal
  modalRoot: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0, 0, 0, 0.85)" },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBox: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 12,
  },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F1A2E",
  },
  shrinkBtn: {
    position: "absolute",
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F2C265",
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  shrinkBtnText: {
    color: "#1A2841",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
