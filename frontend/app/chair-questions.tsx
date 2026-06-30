import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, QuestionItem } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import AdminFooterNav from "@/src/components/AdminFooterNav";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

type Filter = "active" | "archived" | "all";

export default function ChairQuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();

  const [activeItems, setActiveItems] = useState<QuestionItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [active, archived] = await Promise.all([
        api.listQuestions(),
        api.listDeletedQuestions(),
      ]);
      setActiveItems(active);
      setArchivedItems(archived);
    } catch {
      setActiveItems([]);
      setArchivedItems([]);
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

  const visibleItems = filter === "active"
    ? activeItems
    : filter === "archived"
      ? archivedItems
      : [...activeItems, ...archivedItems].sort((left, right) => (right.updated_at || right.created_at || "").localeCompare(left.updated_at || left.created_at || ""));

  const analytics = useMemo(() => {
    const all = [...activeItems, ...archivedItems];
    const unreviewed = activeItems.filter((item) => !item.reviewed).length;
    const linkedTalks = new Set(all.filter((item) => item.event_id).map((item) => item.event_id)).size;
    const talkCounts = all.reduce<Record<string, { title: string; count: number }>>((acc, item) => {
      const key = item.event_id || item.event_title || "general";
      const title = item.event_title || "General";
      const current = acc[key];
      acc[key] = { title, count: (current?.count || 0) + 1 };
      return acc;
    }, {});
    const topTalks = Object.values(talkCounts)
      .sort((left, right) => right.count - left.count)
      .slice(0, 3);
    return { total: all.length, unreviewed, linkedTalks, topTalks };
  }, [activeItems, archivedItems]);

  const markReviewed = async (id: string) => {
    setActiveItems((prev) => prev.map((item) => item.id === id ? { ...item, reviewed: true } : item));
    setBusyId(id);
    try {
      await api.markQuestionReviewed(id);
    } catch {
      // Keep the optimistic reviewed state so the admin flow remains responsive.
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (id: string) => {
    setBusyId(id);
    try {
      await api.deleteQuestion(id);
      const moved = activeItems.find((item) => item.id === id);
      if (moved) {
        setActiveItems((prev) => prev.filter((item) => item.id !== id));
        setArchivedItems((prev) => [{ ...moved, reviewed: true, deleted: true }, ...prev]);
      }
    } catch {
      // Ignore transient failures.
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      await api.restoreQuestion(id);
      const restored = archivedItems.find((item) => item.id === id);
      if (restored) {
        setArchivedItems((prev) => prev.filter((item) => item.id !== id));
        setActiveItems((prev) => [{ ...restored, deleted: false }, ...prev]);
      }
    } catch {
      // Ignore transient failures.
    } finally {
      setBusyId(null);
    }
  };

  const removeForever = async (id: string) => {
    setBusyId(id);
    try {
      await api.permanentDeleteQuestion(id);
      setArchivedItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // Ignore transient failures.
    } finally {
      setBusyId(null);
    }
  };

  const items = visibleItems;

  if (auth.loading || (!auth.username && !auth.loading)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ScreenBg />
        <ActivityIndicator size="large" color={onSunset.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="chair-questions-screen">
      <ScreenBg />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
          hitSlop={10}
          testID="chair-questions-back"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={onSunset.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Speaker Questions</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.analyticsWrap}>
        <View style={[styles.metricCard, shadow.card]}>
          <Text style={styles.metricValue}>{analytics.total}</Text>
          <Text style={styles.metricLabel}>Total questions</Text>
        </View>
        <View style={[styles.metricCard, shadow.card]}>
          <Text style={styles.metricValue}>{analytics.unreviewed}</Text>
          <Text style={styles.metricLabel}>Unreviewed</Text>
        </View>
        <View style={[styles.metricCard, shadow.card]}>
          <Text style={styles.metricValue}>{analytics.linkedTalks}</Text>
          <Text style={styles.metricLabel}>Talks asked</Text>
        </View>
      </View>

      {analytics.topTalks.length > 0 ? (
        <View style={styles.topTalksWrap}>
          <Text style={styles.sectionLabel}>Top talks</Text>
          <View style={styles.topTalksRow}>
            {analytics.topTalks.map((talk) => (
              <View key={`${talk.title}-${talk.count}`} style={styles.topTalkPill}>
                <Text style={styles.topTalkCount}>{talk.count}</Text>
                <Text style={styles.topTalkTitle} numberOfLines={1}>{talk.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {([
          { key: "active", label: "Active" },
          { key: "archived", label: "Archived" },
          { key: "all", label: "All" },
        ] as { key: Filter; label: string }[]).map((entry) => {
          const selected = filter === entry.key;
          return (
            <Pressable
              key={entry.key}
              onPress={() => setFilter(entry.key)}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              testID={`questions-filter-${entry.key}`}
            >
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
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
              <Ionicons name="help-buoy-outline" size={48} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyText}>No speaker questions yet</Text>
              <Text style={styles.emptyHint}>Delegates will appear here once they ask a question from the feed or a talk card.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            const isBusy = busyId === item.id;
            const archived = !!item.deleted;
            const reviewed = !!item.reviewed;
            return (
              <View style={[styles.card, shadow.card, !item.reviewed && !archived && styles.cardUnread]}>
                <Pressable
                  onPress={() => {
                    setExpandedId((current) => current === item.id ? null : item.id);
                  }}
                  testID={`question-item-${item.id}`}
                >
                  <View style={styles.cardHead}>
                    {!item.reviewed && !archived ? <View style={styles.dot} /> : null}
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.event_title || "General question"}
                    </Text>
                    <Text style={styles.cardWhen}>{formatDate(item.updated_at || item.created_at)}</Text>
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
                      onPress={() => router.push(`/event/${item.event_id}`)}
                      style={styles.sessionChip}
                      testID={`question-jump-${item.id}`}
                    >
                      <Ionicons name="calendar" size={12} color={colors.brand} />
                      <Text style={styles.sessionChipText} numberOfLines={1}>Re: {item.event_title}</Text>
                      <Ionicons name="arrow-forward-circle" size={14} color={colors.brand} />
                    </Pressable>
                  ) : null}

                  {!expanded ? (
                    <Text style={styles.cardPreview} numberOfLines={2}>{item.question}</Text>
                  ) : null}
                </Pressable>

                {expanded ? (
                  <View style={styles.expandedWrap}>
                    <Text style={styles.questionLabel}>Question</Text>
                    <Text style={styles.questionText}>{item.question}</Text>
                    <View style={styles.actionRow}>
                      {!archived ? (
                        <Pressable
                          onPress={() => {
                            if (!reviewed) {
                              markReviewed(item.id);
                            }
                          }}
                          disabled={isBusy || reviewed}
                          style={[
                            styles.actionBtn,
                            reviewed ? styles.actionReviewed : styles.actionPrimary,
                            (isBusy || reviewed) && { opacity: 0.8 },
                          ]}
                          testID={`question-review-${item.id}`}
                        >
                          <Ionicons name={reviewed ? "checkmark-circle" : "checkmark-done"} size={14} color="#fff" />
                          <Text style={styles.actionPrimaryText}>{reviewed ? "Reviewed" : "Mark reviewed"}</Text>
                        </Pressable>
                      ) : null}
                      {!archived ? (
                        <Pressable
                          onPress={() => archive(item.id)}
                          disabled={isBusy}
                          style={[styles.actionBtn, styles.actionGhost, isBusy && { opacity: 0.5 }]}
                          testID={`question-archive-${item.id}`}
                        >
                          <Ionicons name="archive-outline" size={14} color={colors.onSurface} />
                          <Text style={styles.actionGhostText}>Archive</Text>
                        </Pressable>
                      ) : (
                        <>
                          <Pressable
                            onPress={() => restore(item.id)}
                            disabled={isBusy}
                            style={[styles.actionBtn, styles.actionGhost, isBusy && { opacity: 0.5 }]}
                            testID={`question-restore-${item.id}`}
                          >
                            <Ionicons name="refresh" size={14} color={colors.onSurface} />
                            <Text style={styles.actionGhostText}>Restore</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => removeForever(item.id)}
                            disabled={isBusy}
                            style={[styles.actionBtn, styles.actionDelete, isBusy && { opacity: 0.5 }]}
                            testID={`question-delete-${item.id}`}
                          >
                            <Ionicons name="trash-outline" size={14} color="#fff" />
                            <Text style={styles.actionDeleteText}>Delete forever</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
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
    return d.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },

  analyticsWrap: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  metricValue: { fontSize: 20, fontWeight: "800", color: colors.onSurface, fontFamily: "Georgia" },
  metricLabel: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, textAlign: "center" },

  topTalksWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 12, fontWeight: "800", color: colors.onSurface, letterSpacing: 0.8, marginBottom: spacing.xs },
  topTalksRow: { gap: spacing.xs },
  topTalkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  topTalkCount: { fontSize: 12, fontWeight: "800", color: colors.brand, width: 20, textAlign: "center" },
  topTalkTitle: { flex: 1, fontSize: 12, color: colors.onSurface },

  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterChipText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted },
  filterChipTextActive: { color: "#fff" },

  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: "#fff", fontWeight: "700" },
  emptyHint: { color: "#fff", textAlign: "center", fontSize: 12, lineHeight: 17 },

  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.brand },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  cardWhen: { fontSize: 11, color: colors.onSurfaceMuted },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardMetaText: { fontSize: 12, color: colors.onSurfaceMuted },
  cardEmail: { fontSize: 12, color: colors.onSurfaceMuted },
  dotSep: { color: colors.onSurfaceMuted, marginHorizontal: 2 },
  sessionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#F2F6F9",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sessionChipText: { fontSize: 11, color: colors.brand, fontWeight: "700", maxWidth: 220 },
  cardPreview: { fontSize: 13, color: colors.onSurface, marginTop: 8, lineHeight: 18 },

  expandedWrap: { marginTop: spacing.md },
  questionLabel: { fontSize: 11, fontWeight: "800", color: colors.onSurfaceMuted, letterSpacing: 0.8, marginBottom: 4 },
  questionText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  actionBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionPrimary: { backgroundColor: colors.brand },
  actionReviewed: { backgroundColor: colors.info },
  actionPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  actionGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionGhostText: { color: colors.onSurface, fontWeight: "700", fontSize: 12 },
  actionDelete: { backgroundColor: colors.error },
  actionDeleteText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
