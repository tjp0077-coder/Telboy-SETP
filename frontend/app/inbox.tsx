import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ContactItem } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const [items, setItems] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  const [replySuccessId, setReplySuccessId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listContact();
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

  const toggleExpand = async (item: ContactItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      if (replyingId === item.id) setReplyingId(null);
      return;
    }
    setExpandedId(item.id);
    setReplySuccessId(null);
    if (!item.read) {
      try {
        await api.markContactRead(item.id);
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, read: true } : i));
      } catch {}
    }
  };

  const del = async (id: string) => {
    try {
      await api.deleteContact(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {}
  };

  const sendReply = async (item: ContactItem) => {
    const draft = (replyDrafts[item.id] || "").trim();
    if (!draft) {
      setReplyErrors((prev) => ({ ...prev, [item.id]: "Reply message is required." }));
      return;
    }
    setReplyBusyId(item.id);
    setReplyErrors((prev) => ({ ...prev, [item.id]: "" }));
    setReplySuccessId(null);
    try {
      await api.replyContact(item.id, { message: draft });
      setReplyDrafts((prev) => ({ ...prev, [item.id]: "" }));
      setReplyingId(null);
      setReplySuccessId(item.id);
    } catch {
      setReplyErrors((prev) => ({ ...prev, [item.id]: "Couldn't send reply. Please try again." }));
    } finally {
      setReplyBusyId(null);
    }
  };

  const unread = items.filter((i) => !i.read).length;

  if (auth.loading || (!auth.username && !auth.loading)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="inbox-screen">
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
          hitSlop={10}
          testID="inbox-back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Inbox</Text>
        {unread > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unread}</Text>
          </View>
        ) : (
          <View style={{ width: 26 }} />
        )}
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
              <Ionicons name="mail-open-outline" size={48} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptyHint}>
                Delegate contact form submissions will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            const replyOpen = replyingId === item.id;
            const replyDraft = replyDrafts[item.id] || "";
            const replyError = replyErrors[item.id];
            const replyBusy = replyBusyId === item.id;
            return (
              <Pressable
                onPress={() => toggleExpand(item)}
                style={[styles.card, shadow.card, !item.read && styles.cardUnread]}
                testID={`inbox-item-${item.id}`}
              >
                <View style={styles.cardHead}>
                  {!item.read ? <View style={styles.dot} /> : null}
                  <Text style={styles.cardSubject} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <Text style={styles.cardWhen}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Ionicons name="person" size={13} color={colors.onSurfaceMuted} />
                  <Text style={styles.cardMetaText}>{item.name}</Text>
                  {item.email ? (
                    <>
                      <Text style={styles.dotSep}>·</Text>
                      <Text style={styles.cardEmail}>{item.email}</Text>
                    </>
                  ) : null}
                </View>

                {item.event_title && item.event_id ? (
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); router.push(`/event/${item.event_id}`); }}
                    style={styles.sessionChip}
                    testID={`inbox-jump-${item.id}`}
                  >
                    <Ionicons name="calendar" size={12} color={colors.brand} />
                    <Text style={styles.sessionChipText} numberOfLines={1}>
                      Re: {item.event_title}
                    </Text>
                    <Ionicons name="arrow-forward-circle" size={14} color={colors.brand} />
                  </Pressable>
                ) : null}

                {!expanded ? (
                  <Text style={styles.cardPreview} numberOfLines={2}>{item.message}</Text>
                ) : (
                  <>
                    <Text style={styles.cardMessage}>{item.message}</Text>
                    <View style={styles.actions}>
                      {item.email ? (
                        <Pressable
                          onPress={() => {
                            setReplyingId(replyOpen ? null : item.id);
                            setReplyErrors((prev) => ({ ...prev, [item.id]: "" }));
                            setReplySuccessId(null);
                          }}
                          style={[styles.actionBtn, styles.actionPrimary]}
                          testID={`inbox-reply-${item.id}`}
                        >
                          <Ionicons name="mail" size={14} color="#fff" />
                          <Text style={styles.actionPrimaryText}>{replyOpen ? "Close reply" : "Reply in app"}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => del(item.id)}
                        style={[styles.actionBtn, styles.actionGhost]}
                        testID={`inbox-delete-${item.id}`}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                        <Text style={styles.actionGhostText}>Delete</Text>
                      </Pressable>
                    </View>
                    {replySuccessId === item.id ? (
                      <Text style={styles.replySuccess} testID={`inbox-reply-success-${item.id}`}>
                        Reply sent.
                      </Text>
                    ) : null}
                    {replyOpen ? (
                      <View style={styles.replyComposer} testID={`inbox-reply-composer-${item.id}`}>
                        <Text style={styles.replyLabel}>Reply to {item.name}</Text>
                        <TextInput
                          style={styles.replyInput}
                          multiline
                          placeholder="Type your reply here..."
                          placeholderTextColor={colors.onSurfaceMuted}
                          value={replyDraft}
                          onChangeText={(text) => setReplyDrafts((prev) => ({ ...prev, [item.id]: text }))}
                          testID={`inbox-reply-input-${item.id}`}
                        />
                        {replyError ? <Text style={styles.replyError}>{replyError}</Text> : null}
                        <View style={styles.replyActions}>
                          <Pressable
                            onPress={() => setReplyingId(null)}
                            style={[styles.actionBtn, styles.actionGhost]}
                            testID={`inbox-reply-cancel-${item.id}`}
                          >
                            <Text style={styles.actionGhostText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => sendReply(item)}
                            disabled={replyBusy}
                            style={[styles.actionBtn, styles.actionPrimary, replyBusy && { opacity: 0.5 }]}
                            testID={`inbox-reply-send-${item.id}`}
                          >
                            {replyBusy ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="send" size={14} color="#fff" />
                                <Text style={styles.actionPrimaryText}>Send reply</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
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
    return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  } catch { return iso; }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  unreadBadge: {
    minWidth: 24, height: 22, paddingHorizontal: 8, borderRadius: 11,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: spacing.sm },
  emptyHint: { color: colors.onSurfaceMuted, fontSize: 12, textAlign: "center" },

  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.brandTertiary },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandTertiary },
  cardSubject: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  cardWhen: { fontSize: 11, color: colors.onSurfaceMuted },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardMetaText: { fontSize: 12, color: colors.onSurfaceMuted },
  dotSep: { color: colors.onSurfaceMuted, marginHorizontal: 4 },
  cardEmail: { fontSize: 12, color: colors.brand },
  cardPreview: { fontSize: 13, color: colors.onSurfaceMuted, marginTop: 6, lineHeight: 18 },
  cardMessage: { fontSize: 14, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 20 },

  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  actionPrimary: { backgroundColor: colors.brand },
  actionPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionGhostText: { color: colors.error, fontWeight: "700", fontSize: 13 },
  replyComposer: { marginTop: spacing.md, gap: spacing.sm },
  replyLabel: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted },
  replyInput: {
    minHeight: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  replyActions: { flexDirection: "row", gap: spacing.sm },
  replyError: { color: colors.error, fontSize: 12 },
  replySuccess: { color: colors.success, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },

  sessionChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#E8ECF2", borderRadius: radius.pill, marginTop: spacing.sm,
    maxWidth: "100%",
  },
  sessionChipText: { fontSize: 12, fontWeight: "700", color: colors.brand, flexShrink: 1 },
});
