import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, TextInput, KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, FeedItem } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";
import { useUnread } from "@/src/UnreadContext";

const PRIORITY_STYLE: Record<string, { bg: string; tint: string; label: string }> = {
  info: { bg: "#E8ECF2", tint: colors.info, label: "INFO" },
  important: { bg: "#FAEDD8", tint: "#8B5A1B", label: "IMPORTANT" },
  urgent: { bg: "#F8DEDA", tint: colors.error, label: "URGENT" },
};

type Filter = "all" | "announcements" | "events";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { auth } = useAuth();
  const { markAllRead } = useUnread();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<"info" | "important" | "urgent">("info");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listFeed();
      setItems(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); markAllRead(); }, [load, markAllRead]);

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.createMessage({ text: text.trim(), title: title.trim(), priority });
      setText(""); setTitle(""); setPriority("info");
      setComposeOpen(false);
      load();
      markAllRead();
    } catch {} finally { setPosting(false); }
  };

  const del = async (kind: string, id: string, eventId?: string | null) => {
    try {
      if (kind === "announcement") {
        await api.deleteMessage(id);
      } else if (kind === "event_note" && eventId) {
        await api.deleteEventNote(eventId, id);
      }
      load();
    } catch {}
  };

  const filtered = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "announcements") return it.kind === "announcement";
    return it.kind === "event_note";
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="messages-screen">
      <ScreenBg />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comms Feed</Text>
        <Text style={styles.headerSub}>
          Live announcements + session-specific updates
        </Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {([
          { key: "all", label: "All" },
          { key: "announcements", label: "Announcements" },
          { key: "events", label: "Session notes" },
        ] as { key: Filter; label: string }[]).map((f) => {
          const sel = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, sel && styles.filterChipActive]}
              testID={`feed-filter-${f.key}`}
            >
              <Text style={[styles.filterChipText, sel && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => `${m.kind}-${m.id}`}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyText}>Nothing here yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const when = formatDate(item.created_at);
            if (item.kind === "announcement") {
              const p = PRIORITY_STYLE[item.priority || "info"];
              return (
                <View style={[styles.msg, shadow.card]} testID={`feed-announcement-${item.id}`}>
                  <View style={styles.msgHeader}>
                    <View style={[styles.badge, { backgroundColor: p.bg }]}>
                      <Text style={[styles.badgeText, { color: p.tint }]}>{p.label}</Text>
                    </View>
                    <Text style={styles.msgWhen}>{when}</Text>
                  </View>
                  {item.title ? <Text style={styles.msgTitle}>{item.title}</Text> : null}
                  <Text style={styles.msgText}>{item.text}</Text>
                  <View style={styles.msgFoot}>
                    <Ionicons name="person-circle" size={16} color={colors.onSurfaceMuted} />
                    <Text style={styles.msgAuthor}>{item.author}</Text>
                    {auth.username ? (
                      <Pressable
                        onPress={() => del(item.kind, item.id)}
                        style={styles.delBtn}
                        hitSlop={8}
                        testID={`feed-del-${item.id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            }

            // event_note row — pressable to open the event
            return (
              <Pressable
                onPress={() => item.event_id && router.push(`/event/${item.event_id}`)}
                style={[styles.msg, styles.noteMsg, shadow.card]}
                testID={`feed-event-note-${item.id}`}
              >
                <View style={styles.msgHeader}>
                  <View style={[styles.badge, { backgroundColor: "#E8EFEA" }]}>
                    <Ionicons name="bookmark" size={10} color={colors.success} />
                    <Text style={[styles.badgeText, { color: colors.success, marginLeft: 4 }]}>
                      SESSION NOTE
                    </Text>
                  </View>
                  <Text style={styles.msgWhen}>{when}</Text>
                </View>
                {item.event_title ? (
                  <View style={styles.eventLink}>
                    <Ionicons name="link" size={13} color={colors.brand} />
                    <Text style={styles.eventLinkText} numberOfLines={1}>
                      {item.event_title}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.msgText}>{item.text}</Text>
                <View style={styles.msgFoot}>
                  <Ionicons name="person-circle" size={16} color={colors.onSurfaceMuted} />
                  <Text style={styles.msgAuthor}>{item.author}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.onSurfaceMuted}
                    style={{ marginLeft: "auto" }}
                  />
                  {auth.username ? (
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); del(item.kind, item.id, item.event_id); }}
                      style={styles.delBtn}
                      hitSlop={8}
                      testID={`feed-del-${item.id}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {auth.username ? (
        <Pressable
          onPress={() => setComposeOpen(true)}
          style={[styles.fab, { bottom: insets.bottom + 90 }]}
          testID="messages-compose-fab"
        >
          <Ionicons name="create" size={24} color="#fff" />
          <Text style={styles.fabText}>Post</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={composeOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposeOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Announcement</Text>

            <TextInput
              style={styles.input}
              placeholder="Title (optional)"
              placeholderTextColor={colors.onSurfaceMuted}
              value={title}
              onChangeText={setTitle}
              testID="message-title-input"
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Message…"
              placeholderTextColor={colors.onSurfaceMuted}
              value={text}
              onChangeText={setText}
              multiline
              testID="message-text-input"
            />

            <View style={styles.priorityRow}>
              {(["info", "important", "urgent"] as const).map((p) => {
                const ps = PRIORITY_STYLE[p];
                const sel = priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[styles.priorityChip, sel && { backgroundColor: ps.bg, borderColor: ps.tint }]}
                    testID={`priority-${p}`}
                  >
                    <Text style={[styles.priorityText, sel && { color: ps.tint }]}>{ps.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setComposeOpen(false)}
                style={[styles.btn, styles.btnGhost]}
                testID="message-cancel"
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={post}
                disabled={posting || !text.trim()}
                style={[styles.btn, styles.btnPrimary, (!text.trim() || posting) && { opacity: 0.5 }]}
                testID="message-post"
              >
                <Text style={styles.btnPrimaryText}>{posting ? "Posting…" : "Post"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { fontSize: 28, fontWeight: "700", color: onSunset.primary, fontFamily: "Georgia" },
  headerSub: { fontSize: 13, color: onSunset.secondary, marginTop: 4 },

  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: "rgba(245,240,230,0.12)", borderWidth: 1, borderColor: "rgba(245,240,230,0.18)",
  },
  filterChipActive: { backgroundColor: "#F2C265", borderColor: "#F2C265" },
  filterChipText: { fontSize: 12, fontWeight: "700", color: onSunset.secondary },
  filterChipTextActive: { color: "#1A2841" },

  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: onSunset.secondary },

  msg: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.md },
  noteMsg: { borderLeftWidth: 3, borderLeftColor: colors.success },
  msgHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  msgWhen: { fontSize: 11, color: colors.onSurfaceMuted },
  msgTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface, marginBottom: 4, fontFamily: "Georgia" },
  msgText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  msgFoot: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: 4 },
  msgAuthor: { fontSize: 12, color: colors.onSurfaceMuted },
  delBtn: { padding: 4, marginLeft: 4 },

  eventLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  eventLinkText: { fontSize: 13, fontWeight: "700", color: colors.brand, fontFamily: "Georgia", flex: 1 },

  fab: {
    position: "absolute", right: spacing.lg, paddingHorizontal: 16, height: 48, borderRadius: 24,
    backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", gap: 6,
    ...shadow.raised,
  },
  fabText: { color: "#fff", fontWeight: "700" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: 22, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: "Georgia" },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, color: colors.onSurface, fontSize: 15,
  },
  inputMulti: { minHeight: 100, textAlignVertical: "top" },
  priorityRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  priorityChip: {
    flex: 1, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", backgroundColor: colors.surface,
  },
  priorityText: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceMuted, letterSpacing: 0.8 },
  modalActions: { flexDirection: "row", gap: spacing.md },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.onSurface, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
