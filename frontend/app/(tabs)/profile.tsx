import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, SessionItem } from "@/src/api";
import { useFavorites } from "@/src/useFavorites";
import { useAuth } from "@/src/AuthContext";
import WhatsAppGroupButton from "@/src/components/WhatsAppGroupButton";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { auth, logout } = useAuth();
  const { favorites, toggle } = useFavorites();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnreadInbox, setHasUnreadInbox] = useState(false);
  const [hasUnreviewedQuestions, setHasUnreviewedQuestions] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listSchedule();
      setItems(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshAdminNotificationState = useCallback(async () => {
    if (!auth.username) {
      setHasUnreadInbox(false);
      setHasUnreviewedQuestions(false);
      return;
    }
    try {
      const [contactThreads, questions] = await Promise.all([
        api.listContact(),
        api.listQuestions(),
      ]);
      setHasUnreadInbox(contactThreads.some((thread) => !thread.read));
      setHasUnreviewedQuestions(questions.some((question) => !question.reviewed));
    } catch {
      // Keep previous indicator state if a refresh fails.
    }
  }, [auth.username]);

  useEffect(() => {
    refreshAdminNotificationState();
  }, [refreshAdminNotificationState]);

  useFocusEffect(
    useCallback(() => {
      refreshAdminNotificationState();
      return () => {};
    }, [refreshAdminNotificationState])
  );

  useEffect(() => {
    if (!auth.username) return;
    const intervalId = setInterval(refreshAdminNotificationState, 30000);
    return () => clearInterval(intervalId);
  }, [auth.username, refreshAdminNotificationState]);

  const saved = items.filter((i) => favorites.has(i.id));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="profile-screen">
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl }}
        showsVerticalScrollIndicator={false}
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
            You can post live messages, edit the schedule, and read delegate inquiries and speaker questions.
          </Text>
          <Pressable
            onPress={() => router.push("/inbox")}
            style={styles.inboxBtn}
            testID="open-inbox-btn"
          >
            <View style={styles.notifyIconWrap}>
              <Ionicons name={hasUnreadInbox ? "mail" : "mail-open"} size={22} color={colors.brand} />
              {hasUnreadInbox ? <View style={styles.notifyDot} testID="profile-inbox-unread-dot" /> : null}
            </View>
            <Text style={styles.inboxBtnText}>Open inbox</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/chair-questions")}
            style={styles.inboxBtn}
            testID="open-chair-questions-btn"
          >
            <View style={styles.notifyIconWrap}>
              <Ionicons name="help-buoy" size={22} color={colors.brand} />
              {hasUnreviewedQuestions ? <View style={styles.notifyDot} testID="profile-questions-unread-dot" /> : null}
            </View>
            <Text style={styles.inboxBtnText}>Speaker questions</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/admins")}
            style={styles.inboxBtn}
            testID="open-admins-btn"
          >
            <Ionicons name="people" size={22} color={colors.brand} />
            <Text style={styles.inboxBtnText}>Manage committee</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/committee-bios")}
            style={styles.inboxBtn}
            testID="open-committee-bios-btn"
          >
            <Ionicons name="people-circle" size={22} color={colors.brand} />
            <Text style={styles.inboxBtnText}>Committee Bio's</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
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
            <Ionicons name="key" size={24} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.loginTitle}>Admin sign-in</Text>
            <Text style={styles.loginSub}>For symposium staff only</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.onSurfaceMuted} />
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
          <Ionicons name="mail" size={24} color={colors.brandTertiary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.loginTitle}>Contact the committee</Text>
          <Text style={styles.loginSub}>Send a question or report an issue</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.onSurfaceMuted} />
      </Pressable>

      {auth.username ? (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <WhatsAppGroupButton
            variant="card"
            showBadge
            testID="profile-admin-whatsapp-btn"
          />
        </View>
      ) : null}

      <View style={styles.footerWrap}>
        <Image
          source={require("@/assets/images/brand/setpx.png")}
          style={styles.footerMark}
          contentFit="contain"
        />
        <Text style={styles.footnote}>
          EDI SETP 2026{"\n"}
          Built by Zeneagles for delegates with ❤
        </Text>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  brandBadge: { width: 72, height: 72 },
  name: { fontSize: 22, fontWeight: "700", color: onSunset.primary, fontFamily: "Georgia" },
  role: { fontSize: 13, color: onSunset.secondary, marginTop: 2 },

  sectionTitle: {
    fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: onSunset.primary,
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
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#E8ECF2",
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
  notifyIconWrap: {
    position: "relative",
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  notifyDot: {
    position: "absolute",
    right: -2,
    top: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E63946",
    borderWidth: 1,
    borderColor: "#E8ECF2",
  },
  inboxBtnText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md,
    paddingVertical: 10,
  },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 14 },

  footerWrap: { alignItems: "center", marginTop: spacing.xxl },
  footerMark: { width: 36, height: 36, opacity: 0.65, marginBottom: spacing.sm },
  footnote: {
    textAlign: "center", fontSize: 11, color: onSunset.secondary,
    lineHeight: 17,
  },
});
