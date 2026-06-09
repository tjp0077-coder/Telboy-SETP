import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, ViewStyle } from "react-native";

// Sunset over the Forth — navy → twilight purple → ember orange.
export const SUNSET_COLORS = ["#0F1A2E", "#2A2547", "#5B2D54", "#A1463A", "#D77A3A"];
export const SUNSET_LOCATIONS = [0, 0.3, 0.55, 0.8, 1];

export function ScreenBg({ style }: { style?: ViewStyle }) {
  return (
    <LinearGradient
      colors={SUNSET_COLORS}
      locations={SUNSET_LOCATIONS}
      style={[StyleSheet.absoluteFillObject, style]}
    />
  );
}

// Text colors readable on the sunset gradient
export const onSunset = {
  primary: "#F5F0E6",
  secondary: "rgba(245, 240, 230, 0.78)",
  faint: "rgba(245, 240, 230, 0.55)",
};
