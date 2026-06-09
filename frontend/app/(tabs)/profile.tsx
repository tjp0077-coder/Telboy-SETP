import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, SessionItem } from "@/src/api";
import { useFavorites } from "@/src/useFavorites";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { auth, logout } = useAuth();
  const { favorites, toggle } = useFavorites();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.listSchedule();
      setItems(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saved = items.filter((i) => favorites.has(i.id));

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 140 }}
      testID="profile-screen"
    >
      <View style={styles.headerWrap}>
        <Image
          source={require("@/assets/images/brand/badge.png")}
          style={styles.brandBadge}
          contentFit="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {auth.name ? auth.name : "Delegate"}
          </Text>
          <Text style={styles.role}>
            {auth.username ? "EDI SETP 2026 · Admin" : "EDI SETP 2026"}
          </Text>
        </View>
      </View>

      {/* Saved Sessions */}
      <Text style={styles.sectionTitle}>My Agenda</Text>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} />
      ) : saved.length === 0 ? (
        <View style={[styles.emptyCard, shadow.card]} testID="agenda-empty">
          <Ionicons name="bookmark-outline" size={28} color={colors.onSurfaceMuted} />
          <Text style={styles.emptyTitle}>No saved sessions yet</Text>
          <Text style={styles.emptyText}>
            Tap the bookmark icon on any session in the Schedule tab to add it to your personal agenda.
          </Text>
        </View>
      ) : (
        saved.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/event/${s.id}`)}
            style={[styles.savedCard, shadow.card]}
            testID={`saved-${s.id}`}
          >
            <View style={styles.savedTimeCol}>
              <Text style={styles.savedDay}>
                {s.day_label.split(" ")[0]}
              </Text>
              <Text style={styles.savedTime}>{s.time}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>{s.title}</Text>
              <Text style={styles.savedLoc}>{s.location}</Text>
            </View>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); toggle(s.id); }}
              hitSlop={10}
              testID={`saved-remove-${s.id}`}
            >
              <Ionicons name="bookmark" size={22} color={colors.brandTertiary} />
            </Pressable>
          </Pressable>
        ))
      )}

      {/* Admin section */}
      <Text style={styles.sectionTitle}>Admin</Text>
      {auth.username ? (
        <View style={[styles.adminCard, shadow.card]}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
            <Text style={styles.adminBadgeText}>Signed in as admin</Text>
          </View>
          <Text style={styles.adminText}>
            You can post live messages, edit the schedule, and read delegate inquiries.
          </Text>
          <Pressable
            onPress={() => router.push("/inbox")}
            style={styles.inboxBtn}
            testID="open-inbox-btn"
          >
            <Ionicons name="mail-open" size={18} color={colors.brand} />
            <Text style={styles.inboxBtnText}>Open inbox</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
          </Pressable>
          <Pressable onPress={logout} style={styles.logoutBtn} testID="logout-btn">
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push("/login")}
          style={[styles.loginCard, shadow.card]}
          testID="admin-login-btn"
        >
          <View style={styles.loginIcon}>
            <Ionicons name="key" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.loginTitle}>Admin sign-in</Text>
            <Text style={styles.loginSub}>For symposium staff only</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} />
        </Pressable>
      )}

      {/* Help */}
      <Text style={styles.sectionTitle}>Help</Text>
      <Pressable
        onPress={() => router.push("/contact")}
        style={[styles.loginCard, shadow.card]}
        testID="contact-admin-btn"
      >
        <View style={[styles.loginIcon, { backgroundColor: "#FBF1E5" }]}>
          <Ionicons name="mail" size={20} color={colors.brandTertiary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.loginTitle}>Contact organisers</Text>
          <Text style={styles.loginSub}>Send a question or report an issue</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} />
      </Pressable>

      <View style={styles.footerWrap}>
        <Image
          source={require("@/assets/images/brand/setpx.png")}
          style={styles.footerMark}
          contentFit="contain"
        />
        <Text style={styles.footnote}>
          EDI SETP 2026 · v1.0{"\n"}
          Built for American delegates with ❤
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  headerWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  brandBadge: { width: 72, height: 72 },
  name: { fontSize: 22, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  role: { fontSize: 13, color: colors.onSurfaceMuted, marginTop: 2 },

  sectionTitle: {
    fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: colors.onSurfaceMuted,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },

  emptyCard: {
    marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", gap: spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  emptyText: { fontSize: 12, color: colors.onSurfaceMuted, textAlign: "center", lineHeight: 17 },

  savedCard: {
    flexDirection: "row", marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.md, alignItems: "center", gap: spacing.sm,
  },
  savedTimeCol: { width: 56 },
  savedDay: { fontSize: 10, fontWeight: "800", color: colors.brandTertiary, letterSpacing: 0.8 },
  savedTime: { fontSize: 15, fontWeight: "700", color: colors.brand, fontFamily: "Georgia" },
  savedTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  savedLoc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },

  loginCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  loginIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center",
  },
  loginTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  loginSub: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },

  adminCard: {
    marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "#E6F2EC", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  adminBadgeText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  adminText: { fontSize: 13, color: colors.onSurfaceMuted, marginTop: spacing.sm, lineHeight: 18 },
  inboxBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md,
    backgroundColor: "#E8ECF2",
  },
  inboxBtnText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md,
    paddingVertical: 10,
  },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 14 },

  footerWrap: { alignItems: "center", marginTop: spacing.xxl },
  footerMark: { width: 36, height: 36, opacity: 0.55, marginBottom: spacing.sm },
  footnote: {
    textAlign: "center", fontSize: 11, color: colors.onSurfaceMuted,
    lineHeight: 17,
  },
});
