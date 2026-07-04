import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Text,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
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

const HOME_BG = require("@/assets/images/brand/home_bg.png");

const VIMEO_ID = "1204657737";
const VIMEO_PLAYER_URL = `https://player.vimeo.com/video/${VIMEO_ID}?autoplay=0&title=0&byline=0&portrait=0&dnt=1&playsinline=1`;
const ASPECT = 240 / 360; // portrait 2:3

/**
 * Welcome / Home screen.
 *  - Full-bleed background image (the new SETP Edinburgh poster)
 *  - Single floating play button centred on the screen
 *  - Tapping the play button opens the portrait full-screen modal player
 *  - Fixed layout, no scroll
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const progress = useSharedValue(0);

  const { width: winW, height: winH } = Dimensions.get("window");

  // Fullscreen video target size (portrait, fits within safe-area window)
  const fsAvailW = winW - 24;
  const fsAvailH = winH - insets.top - insets.bottom - 24;
  let fsHeight = fsAvailH;
  let fsWidth = fsHeight * ASPECT;
  if (fsWidth > fsAvailW) {
    fsWidth = fsAvailW;
    fsHeight = fsWidth / ASPECT;
  }

  // Starting size for the expanding-from-button effect (small circle)
  const startSize = 72;

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

  const playerAnimStyle = useAnimatedStyle(() => {
    const w = startSize + (fsWidth - startSize) * progress.value;
    const h = startSize + (fsHeight - startSize) * progress.value;
    const radius = 42 - 42 * progress.value + 14 * progress.value;
    return {
      width: w,
      height: h,
      borderRadius: radius,
    };
  });

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={styles.screen} testID="home-welcome-screen">
      {/* Full-bleed background image */}
      <Image
        source={HOME_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        transition={150}
      />

      {/* Single floating play button — centred on the screen */}
      <View style={styles.center} pointerEvents="box-none">
        <Pressable
          onPress={openVideo}
          accessibilityRole="button"
          accessibilityLabel="Play SETP 2026 teaser video"
          style={styles.playRing}
          testID="home-play-btn"
          hitSlop={12}
        >
          <Ionicons name="play" size={32} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      {/* Small share link under the poster badge area */}
      <Pressable
        onPress={() => router.push("/(tabs)/share")}
        accessibilityRole="button"
        accessibilityLabel="Open app share QR"
        style={[
          styles.shareLink,
          {
            bottom: Platform.OS === "web" ? 74 : insets.bottom + 70,
          },
        ]}
        testID="home-share-link"
      >
        <Ionicons name="share-social-outline" size={14} color="#F5F0E6" />
        <Text style={styles.shareLinkText}>Share App</Text>
      </Pressable>

      {/* ─── Fullscreen modal player ─────────────────────────────────── */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeVideo}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropAnimStyle]}
          >
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeVideo} />
          </Animated.View>

          <View style={styles.modalCenter} pointerEvents="box-none">
            <Animated.View style={[styles.videoBox, playerAnimStyle]}>
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

          <Pressable
            onPress={closeVideo}
            hitSlop={12}
            style={[styles.shrinkBtn, { top: insets.top + 12 }]}
            accessibilityRole="button"
            accessibilityLabel="Close video"
            testID="home-shrink-btn"
          >
            <Ionicons name="contract" size={18} color="#1A2841" />
            <Text style={styles.shrinkBtnText}>Shrink Back</Text>
          </Pressable>

          {Platform.OS === "android" && open ? (
            <StatusBar hidden={false} translucent backgroundColor="rgba(0,0,0,0.85)" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F1A2E",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3C284C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },
  shareLink: {
    position: "absolute",
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(15, 26, 46, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(245,240,230,0.35)",
  },
  shareLinkText: {
    color: "#F5F0E6",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
