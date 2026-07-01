import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ContactItem, ContactThreadMessage } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";
import AdminFooterNav from "@/src/components/AdminFooterNav";

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

  const sortThreads = useCallback((threads: ContactItem[]) => {
    return [...threads].sort(
      (left, right) => (right.updated_at || right.created_at || "").localeCompare(left.updated_at || left.created_at || "")
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.listContact();
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

  useFocusEffect(
    useCallback(() => {
      if (auth.username) {
        load();
      }
      return () => {};
    }, [auth.username, load])
  );

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
      const result = await api.replyContact(item.id, { message: draft });
      setReplyDrafts((prev) => ({ ...prev, [item.id]: "" }));
      setReplyingId(null);
      setReplySuccessId(item.id);
      setItems((prev) => sortThreads(prev.map((thread) => {
        if (thread.id !== item.id) return thread;
        const messages = sortMessages([...(thread.messages || []), result.message]);
        return {
          ...thread,
          updated_at: result.message.created_at,
          read: true,
          messages,
        };
      })));
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
        <View style={styles.topRight}>
          <Pressable onPress={() => router.push("/deleted-inbox")} hitSlop={10} testID="inbox-archived-link">
            <Ionicons name="archive-outline" size={22} color={colors.onSurface} />
          </Pressable>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
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
            const threadMessages = sortMessages(item.messages || []);
            const latestMessage = threadMessages[threadMessages.length - 1] || buildFallbackMessage(item);
            return (
              <View
                style={[styles.card, shadow.card, !item.read && styles.cardUnread]}
              >
                <Pressable onPress={() => toggleExpand(item)} testID={`inbox-item-${item.id}`}>
                  <View style={styles.cardHead}>
                    {!item.read ? <View style={styles.dot} /> : null}
                    <Text style={styles.cardSubject} numberOfLines={1}>
                      {latestMessage.subject || item.subject}
                    </Text>
                    <Text style={styles.cardWhen}>{formatDate(item.updated_at || latestMessage.created_at || item.created_at)}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Ionicons name="person" size={13} color={colors.onSurfaceMuted} />
                    <Text style={styles.cardMetaText}>{item.name}</Text>
                    <Text style={styles.dotSep}>·</Text>
                    <Text style={styles.cardMetaText}>{threadMessages.length} {threadMessages.length === 1 ? "message" : "messages"}</Text>
                    {item.email ? (
                      <>
                        <Text style={styles.dotSep}>·</Text>
                        <Text style={styles.cardEmail}>{item.email}</Text>
                      </>
                    ) : null}
                  </View>

                  {!expanded ? (
                    <Text style={styles.cardPreview} numberOfLines={2}>{latestMessage.message}</Text>
                  ) : null}
                </Pressable>

                {item.event_title && item.event_id ? (
                  <Pressable
                    onPress={() => router.push(`/event/${item.event_id}`)}
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
                          <Text style={styles.actionPrimaryText}>{replyOpen ? "Close reply" : "Reply by email"}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => del(item.id)}
                        style={[styles.actionBtn, styles.actionGhost]}
                        testID={`inbox-delete-${item.id}`}
                      >
                        <Ionicons name="archive-outline" size={14} color={colors.error} />
                        <Text style={styles.actionGhostText}>Archive</Text>
                      </Pressable>
                    </View>
                    {replySuccessId === item.id ? (
                      <Text style={styles.replySuccess} testID={`inbox-reply-success-${item.id}`}>
                        Reply sent.
                      </Text>
                    ) : null}
                    {replyOpen ? (
                      <View style={styles.replyComposer} testID={`inbox-reply-composer-${item.id}`}>
                        <View style={styles.replyLabelRow}>
                          <Text style={styles.replyLabel}>Reply {item.name || "<Delegate>"}</Text>
                          <Text style={styles.replyHint}>To/From is prepopulated in the email response.</Text>
                        </View>
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
                ) : null}
              </View>
            );
          }}
        />
      )}
      <AdminFooterNav />
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
  topRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 54, justifyContent: "flex-end" },
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
  threadWrap: { marginTop: spacing.md, gap: spacing.sm },
  threadBubble: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  threadBubbleDelegate: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  threadBubbleAdmin: {
    backgroundColor: "#E8ECF2",
    borderWidth: 1,
    borderColor: "#D6DEE9",
  },
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
  replyComposer: { marginTop: spacing.md, gap: spacing.sm },
  replyLabelRow: { gap: 4 },
  replyLabel: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted },
  replyHint: { fontSize: 11, color: colors.onSurfaceMuted },
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

function sortMessages(messages: ContactThreadMessage[]) {
  return [...messages].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function buildFallbackMessage(item: ContactItem): ContactThreadMessage {
  return {
    id: `${item.id}-fallback`,
    sender_role: "delegate",
    sender_name: item.name,
    sender_email: item.email || null,
    subject: item.subject,
    message: item.message,
    created_at: item.created_at,
  };
}
