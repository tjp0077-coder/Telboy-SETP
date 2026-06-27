import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, FeedItem } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";

const PRIORITY_STYLE: Record<string, { bg: string; tint: string; label: string }> = {
  info: { bg: "#E8ECF2", tint: colors.info, label: "INFO" },
  important: { bg: "#FAEDD8", tint: "#8B5A1B", label: "IMPORTANT" },
  urgent: { bg: "#F8DEDA", tint: colors.error, label: "URGENT" },
};

export default function DeletedFeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { auth } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listDeletedFeed();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.username && !auth.loading) {
      router.replace("/login");
      return;
    }
    if (auth.username) load();
  }, [auth.username, auth.loading, load, router]);

  const restore = async (item: FeedItem) => {
    setBusyId(item.id);
    try {
      if (item.kind === "announcement") {
        await api.restoreMessage(item.id);
      } else if (item.event_id) {
        await api.restoreEventNote(item.event_id, item.id);
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch {
    } finally {
      setBusyId(null);
    }
  };

  const permanentlyDelete = async (item: FeedItem) => {
    setBusyId(item.id);
    try {
      if (item.kind === "announcement") {
        await api.permanentDeleteMessage(item.id);
      } else if (item.event_id) {
        await api.permanentDeleteEventNote(item.event_id, item.id);
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch {
    } finally {
      setBusyId(null);
    }
  };

  if (auth.loading || (!auth.username && !auth.loading)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="deleted-feed-screen">
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/messages")} hitSlop={10} testID="deleted-feed-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Archived Feed</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="archive-outline" size={48} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyText}>No archived announcements or session notes</Text>
            </View>
          }
          renderItem={({ item }) => {
            const when = formatDate(item.created_at);
            const archivedWhen = formatDate(item.deleted_at || item.created_at);
            const busy = busyId === item.id;
            if (item.kind === "announcement") {
              const p = PRIORITY_STYLE[item.priority || "info"];
              return (
                <View style={[styles.msg, shadow.card]} testID={`deleted-feed-announcement-${item.id}`}>
                  <View style={styles.msgHeader}>
                    <View style={[styles.badge, { backgroundColor: p.bg }]}>
                      <Text style={[styles.badgeText, { color: p.tint }]}>{p.label}</Text>
                    </View>
                    <Text style={styles.msgWhen}>{when}</Text>
                  </View>
                  {item.title ? <Text style={styles.msgTitle}>{item.title}</Text> : null}
                  <Text style={styles.msgText}>{item.text}</Text>
                  <Text style={styles.archivedMeta}>Archived {archivedWhen}{item.deleted_by ? ` by ${item.deleted_by}` : ""}</Text>
                  <View style={styles.msgFoot}>
                    <Ionicons name="person-circle" size={16} color={colors.onSurfaceMuted} />
                    <Text style={styles.msgAuthor}>{item.author}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable onPress={() => restore(item)} disabled={busy} style={[styles.actionBtn, styles.actionPrimary, busy && { opacity: 0.6 }]} testID={`deleted-feed-restore-${item.id}`}>
                      {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="refresh" size={14} color="#fff" /><Text style={styles.actionPrimaryText}>Restore</Text></>}
                    </Pressable>
                    <Pressable onPress={() => permanentlyDelete(item)} disabled={busy} style={[styles.actionBtn, styles.actionGhost, busy && { opacity: 0.6 }]} testID={`deleted-feed-permanent-${item.id}`}>
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                      <Text style={styles.actionGhostText}>Permanent delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            return (
              <Pressable
                onPress={() => item.event_id && router.push(`/event/${item.event_id}`)}
                style={[styles.msg, styles.noteMsg, shadow.card]}
                testID={`deleted-feed-event-note-${item.id}`}
              >
                <View style={styles.msgHeader}>
                  <View style={[styles.badge, { backgroundColor: "#E8EFEA" }]}>
                    <Ionicons name="bookmark" size={10} color={colors.success} />
                    <Text style={[styles.badgeText, { color: colors.success, marginLeft: 4 }]}>SESSION NOTE</Text>
                  </View>
                  <Text style={styles.msgWhen}>{when}</Text>
                </View>
                {item.event_title ? (
                  <View style={styles.eventLink}>
                    <Ionicons name="link" size={13} color={colors.brand} />
                    <Text style={styles.eventLinkText} numberOfLines={1}>{item.event_title}</Text>
                  </View>
                ) : null}
                <Text style={styles.msgText}>{item.text}</Text>
                <Text style={styles.archivedMeta}>Archived {archivedWhen}{item.deleted_by ? ` by ${item.deleted_by}` : ""}</Text>
                <View style={styles.msgFoot}>
                  <Ionicons name="person-circle" size={16} color={colors.onSurfaceMuted} />
                  <Text style={styles.msgAuthor}>{item.author}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={(e) => { e.stopPropagation?.(); restore(item); }} disabled={busy} style={[styles.actionBtn, styles.actionPrimary, busy && { opacity: 0.6 }]} testID={`deleted-feed-restore-${item.id}`}>
                    {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="refresh" size={14} color="#fff" /><Text style={styles.actionPrimaryText}>Restore</Text></>}
                  </Pressable>
                  <Pressable onPress={(e) => { e.stopPropagation?.(); permanentlyDelete(item); }} disabled={busy} style={[styles.actionBtn, styles.actionGhost, busy && { opacity: 0.6 }]} testID={`deleted-feed-permanent-${item.id}`}>
                    <Ionicons name="trash-outline" size={14} color={colors.error} />
                    <Text style={styles.actionGhostText}>Permanent delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  } catch { return iso; }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontSize: 24, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.onSurfaceMuted, textAlign: "center" },
  msg: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md },
  noteMsg: { borderLeftWidth: 3, borderLeftColor: colors.success },
  msgHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  msgWhen: { fontSize: 11, color: colors.onSurfaceMuted },
  msgTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface, marginBottom: 4, fontFamily: "Georgia" },
  msgText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  archivedMeta: { fontSize: 12, color: colors.brand, marginTop: spacing.sm, fontWeight: "700" },
  msgFoot: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: 4 },
  msgAuthor: { fontSize: 12, color: colors.onSurfaceMuted },
  eventLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  eventLinkText: { fontSize: 13, fontWeight: "700", color: colors.brand, fontFamily: "Georgia", flex: 1 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  actionPrimary: { backgroundColor: colors.brand },
  actionPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionGhostText: { color: colors.error, fontWeight: "700", fontSize: 13 },
});