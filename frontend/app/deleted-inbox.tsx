import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ContactItem, ContactThreadMessage } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function DeletedInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const [items, setItems] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const sortThreads = useCallback((threads: ContactItem[]) => {
    return [...threads].sort(
      (left, right) => (right.deleted_at || right.updated_at || right.created_at || "").localeCompare(left.deleted_at || left.updated_at || left.created_at || "")
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.listDeletedContact();
      setItems(sortThreads(data));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortThreads]);

  useEffect(() => {
    if (!auth.username && !auth.loading) {
      router.replace("/login");
      return;
    }
    if (auth.username) load();
  }, [auth.username, auth.loading, load, router]);

  const toggleExpand = (item: ContactItem) => {
    setExpandedId((current) => current === item.id ? null : item.id);
  };

  const restore = async (id: string) => {
    setBusyActionId(id);
    try {
      await api.restoreContact(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
    } finally {
      setBusyActionId(null);
    }
  };

  const permanentlyDelete = async (id: string) => {
    setBusyActionId(id);
    try {
      await api.permanentDeleteContact(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
    } finally {
      setBusyActionId(null);
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
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="deleted-inbox-screen">
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/inbox")}
          hitSlop={10}
          testID="deleted-inbox-back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Archived Messages</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
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
              <Text style={styles.emptyText}>No archived messages</Text>
              <Text style={styles.emptyHint}>
                Archived contact threads will appear here until they are restored or permanently deleted.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            const threadMessages = sortMessages(item.messages || []);
            const latestMessage = threadMessages[threadMessages.length - 1] || buildFallbackMessage(item);
            const busy = busyActionId === item.id;
            return (
              <View style={[styles.card, shadow.card]}>
                <Pressable onPress={() => toggleExpand(item)} testID={`deleted-inbox-item-${item.id}`}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardSubject} numberOfLines={1}>
                      {latestMessage.subject || item.subject}
                    </Text>
                    <Text style={styles.cardWhen}>{formatDate(item.deleted_at || item.updated_at || item.created_at)}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Ionicons name="person" size={13} color={colors.onSurfaceMuted} />
                    <Text style={styles.cardMetaText}>{item.name}</Text>
                    <Text style={styles.dotSep}>·</Text>
                    <Text style={styles.cardMetaText}>{threadMessages.length} {threadMessages.length === 1 ? "message" : "messages"}</Text>
                  </View>
                  <Text style={styles.deletedMeta}>
                    Archived {formatDate(item.deleted_at || item.updated_at || item.created_at)}{item.deleted_by ? ` by ${item.deleted_by}` : ""}
                  </Text>
                  {!expanded ? (
                    <Text style={styles.cardPreview} numberOfLines={2}>{latestMessage.message}</Text>
                  ) : null}
                </Pressable>

                {item.event_title && item.event_id ? (
                  <Pressable
                    onPress={() => router.push(`/event/${item.event_id}`)}
                    style={styles.sessionChip}
                    testID={`deleted-inbox-jump-${item.id}`}
                  >
                    <Ionicons name="calendar" size={12} color={colors.brand} />
                    <Text style={styles.sessionChipText} numberOfLines={1}>
                      Re: {item.event_title}
                    </Text>
                    <Ionicons name="arrow-forward-circle" size={14} color={colors.brand} />
                  </Pressable>
                ) : null}

                {expanded ? (
                  <>
                    <View style={styles.threadWrap}>
                      {threadMessages.map((threadMessage) => {
                        const isAdmin = threadMessage.sender_role === "admin";
                        return (
                          <View
                            key={threadMessage.id}
                            style={[
                              styles.threadBubble,
                              isAdmin ? styles.threadBubbleAdmin : styles.threadBubbleDelegate,
                            ]}
                          >
                            <View style={styles.threadMetaRow}>
                              <Text style={styles.threadSender}>
                                {isAdmin ? "Admin Reply" : "Delegate Message"}
                              </Text>
                              <Text style={styles.threadTime}>{formatDate(threadMessage.created_at)}</Text>
                            </View>
                            <Text style={styles.threadAuthor}>{threadMessage.sender_name}</Text>
                            {threadMessage.subject ? (
                              <Text style={styles.threadSubject}>{threadMessage.subject}</Text>
                            ) : null}
                            <Text style={styles.threadMessage}>{threadMessage.message}</Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => restore(item.id)}
                        disabled={busy}
                        style={[styles.actionBtn, styles.actionPrimary, busy && { opacity: 0.6 }]}
                        testID={`deleted-inbox-restore-${item.id}`}
                      >
                        {busy ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="refresh" size={14} color="#fff" />
                            <Text style={styles.actionPrimaryText}>Restore</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => permanentlyDelete(item.id)}
                        disabled={busy}
                        style={[styles.actionBtn, styles.actionGhost, busy && { opacity: 0.6 }]}
                        testID={`deleted-inbox-permanent-${item.id}`}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                        <Text style={styles.actionGhostText}>Permanent delete</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
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
    return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  } catch { return iso; }
}

function sortMessages(messages: ContactThreadMessage[]) {
  return [...messages].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function buildFallbackMessage(item: ContactItem): ContactThreadMessage {
  return {
    id: `${item.id}-fallback`,
    sender_role: "delegate",
    sender_name: item.name,
    sender_email: item.email,
    subject: item.subject,
    message: item.message,
    created_at: item.created_at,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: spacing.sm },
  emptyHint: { color: colors.onSurfaceMuted, fontSize: 12, textAlign: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardSubject: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  cardWhen: { fontSize: 11, color: colors.onSurfaceMuted },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardMetaText: { fontSize: 12, color: colors.onSurfaceMuted },
  dotSep: { color: colors.onSurfaceMuted, marginHorizontal: 4 },
  deletedMeta: { fontSize: 12, color: colors.brand, marginTop: 6, fontWeight: "700" },
  cardPreview: { fontSize: 13, color: colors.onSurfaceMuted, marginTop: 6, lineHeight: 18 },
  threadWrap: { marginTop: spacing.md, gap: spacing.sm },
  threadBubble: { borderRadius: radius.md, padding: spacing.md },
  threadBubbleDelegate: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  threadBubbleAdmin: { backgroundColor: "#E8ECF2", borderWidth: 1, borderColor: "#D6DEE9" },
  threadMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  threadSender: { fontSize: 11, fontWeight: "800", color: colors.brandTertiary, textTransform: "uppercase" },
  threadTime: { fontSize: 11, color: colors.onSurfaceMuted },
  threadAuthor: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginTop: 4 },
  threadSubject: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  threadMessage: { fontSize: 14, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  actionPrimary: { backgroundColor: colors.brand },
  actionPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionGhostText: { color: colors.error, fontWeight: "700", fontSize: 13 },
  sessionChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#E8ECF2", borderRadius: radius.pill, marginTop: spacing.sm,
    maxWidth: "100%",
  },
  sessionChipText: { fontSize: 12, fontWeight: "700", color: colors.brand, flexShrink: 1 },
});