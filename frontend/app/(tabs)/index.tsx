import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VimeoTeaser from "@/src/components/VimeoTeaser";

const HERO = require("@/assets/images/brand/hero.jpg");
const SETP_LOGO = require("@/assets/images/brand/setpx.png");

/**
 * Welcome / Home screen.
 *  - Full-bleed scenic hero filling roughly the top two-thirds of the screen
 *  - Gold SETP "X" logo centred between hero and video
 *  - Landscape-cropped Vimeo thumbnail above the tab bar (fixed, no scroll)
 *  - Tapping the thumbnail opens the portrait full-screen modal player
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 72 + Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 14);

  return (
    <View style={styles.screen} testID="home-welcome-screen">
      {/* Hero — full-bleed, fills the top section of the screen */}
      <View style={[styles.hero]}>
        <Image
          source={HERO}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
        />
        {/* Soft dark gradient at the bottom edge of the hero for a smooth blend */}
        <LinearGradient
          colors={["transparent", "rgba(15,26,46,0.0)", "rgba(15,26,46,0.85)"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      {/* SETP X logo — sits across the hero/video boundary */}
      <View pointerEvents="none" style={[styles.logoWrap, { top: insets.top + 0 }]}>
        <View style={styles.logoSlot}>
          <Image
            source={SETP_LOGO}
            style={styles.logoImg}
            contentFit="contain"
            transition={200}
          />
        </View>
      </View>

      {/* Bottom area — landscape video thumbnail just above the tab bar */}
      <View
        style={[
          styles.bottomArea,
          { paddingBottom: tabBarHeight + 14, paddingTop: 12 },
        ]}
      >
        <VimeoTeaser inline landscapeThumb />
      </View>

      {/* Tartan decorative strip just above the tab bar */}
      <View
        pointerEvents="none"
        style={[styles.tartanBand, { bottom: tabBarHeight - 6 }]}
      >
        <LinearGradient
          colors={["#1A2841", "#2E1A33", "#5C2A2A", "#2E1A33", "#1A2841"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F1A2E",
  },
  hero: {
    // Hero fills roughly the top half of the screen, edge-to-edge.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "58%",
    backgroundColor: "#0F1A2E",
  },
  logoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    // We let the logo sit roughly at the hero/video boundary.
    // Use a flex container the height of the upper section.
    height: "62%",
    justifyContent: "flex-end",
  },
  logoSlot: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -28, // overlap into the video area
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  logoImg: {
    width: "100%",
    height: "100%",
  },
  bottomArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: "58%",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tartanBand: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    opacity: 0.85,
  },
});
