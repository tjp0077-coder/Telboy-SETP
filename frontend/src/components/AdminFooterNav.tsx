import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/theme";

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: "home", href: "/", match: (pathname) => pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/index" },
  { label: "Schedule", icon: "calendar", href: "/(tabs)/schedule", match: (pathname) => pathname.includes("/schedule") },
  { label: "Messages", icon: "megaphone", href: "/(tabs)/messages", match: (pathname) => pathname.includes("/messages") || pathname.includes("/feed") },
  { label: "City", icon: "map", href: "/(tabs)/city", match: (pathname) => pathname.includes("/city") },
  { label: "Profile", icon: "person-circle", href: "/(tabs)/profile", match: (pathname) => pathname.includes("/profile") || pathname.includes("/admins") || pathname.includes("/inbox") || pathname.includes("/prototypes") || pathname.includes("/questions") },
];

export default function AdminFooterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 14);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.bar}>
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable
              key={item.label}
              onPress={() => router.replace(item.href)}
              style={styles.item}
              testID={`admin-footer-${item.label.toLowerCase()}`}
            >
              <Ionicons name={item.icon} size={22} color={active ? colors.brand : colors.onSurfaceMuted} />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.onSurfaceMuted,
  },
  labelActive: {
    color: colors.brand,
  },
});
