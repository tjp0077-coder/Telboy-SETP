import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, SessionItem } from "@/src/api";
import { useFavorites } from "@/src/useFavorites";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg } from "@/src/components/ScreenBg";
import AddSessionSheet from "@/src/components/AddSessionSheet";

const HERO = require("@/assets/images/brand/hero.jpg");

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  session: "document-text",
  break: "cafe",
  meal: "restaurant",
  social: "wine",
  tour: "bus",
};

const CATEGORY_COLOR: Record<string, string> = {
  session: colors.brand,
  break: colors.warning,
  meal: colors.warning,
  social: colors.brandTertiary,
  tour: colors.success,
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { favorites, toggle } = useFavorites();
  const { auth } = useAuth();

  const load = useCallback(async () => {
    try {
      const data = await api.listSchedule();
      setItems(data);
      if (data.length && !activeDate) {
        setActiveDate(data[0].date);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeDate]);

  useEffect(() => { load(); }, []);

  const days = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => { if (!map.has(i.date)) map.set(i.date, i.day_label); });
    return Array.from(map.entries()).map(([date, label]) => ({ date, label }));
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) => i.date === activeDate),
    [items, activeDate]
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="schedule-screen">
      <ScreenBg />
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={styles.hero}>
              <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>

            {/* Day selector chip row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={styles.chipRowWrap}
            >
              {days.map((d) => {
                const active = d.date === activeDate;
                const [, , dd] = d.date.split("-");
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => setActiveDate(d.date)}
                    style={[styles.chip, active && styles.chipActive]}
                    testID={`day-chip-${d.date}`}
                  >
                    <Text style={[styles.chipDay, active && styles.chipDayActive]}>
                      {d.label.split(" ")[0].toUpperCase()}
                    </Text>
                    <Text style={[styles.chipDate, active && styles.chipDateActive]}>
                      {Number(dd)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.onSurfaceMuted} />
            <Text style={styles.emptyText}>No sessions for this day</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fav = favorites.has(item.id);
          const cIcon = CATEGORY_ICON[item.category] || "ellipse";
          const cColor = CATEGORY_COLOR[item.category] || colors.brand;
          return (
            <Pressable
              onPress={() => router.push(`/event/${item.id}`)}
              style={[styles.card, shadow.card]}
              testID={`session-card-${item.id}`}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardTime}>{item.time}</Text>
                {item.end_time ? <Text style={styles.cardEndTime}>{item.end_time}</Text> : null}
                <View style={[styles.catDot, { backgroundColor: cColor }]}>
                  <Ionicons name={cIcon} size={14} color="#fff" />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="location" size={15} color={colors.onSurfaceMuted} />
                  <Text style={styles.cardMetaText}>{item.location}</Text>
                </View>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); toggle(item.id); }}
                style={styles.favBtn}
                hitSlop={10}
                testID={`fav-btn-${item.id}`}
              >
                <Ionicons
                  name={fav ? "bookmark" : "bookmark-outline"}
                  size={26}
                  color={fav ? colors.brandTertiary : colors.onSurfaceMuted}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { aspectRatio: 2, marginBottom: spacing.md, borderRadius: 8, overflow: "hidden", backgroundColor: "#0F1A2E" },
  heroBadge: {
    position: "absolute", top: spacing.md, right: spacing.md,
    width: 78, height: 78,
  },
  heroContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg },
  heroEyebrow: { color: "#D4A373", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "700", fontFamily: "Georgia" },
  heroSub: { color: "#E2DFD8", fontSize: 13, marginTop: 4 },

  chipRowWrap: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
  chipRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: 6 },
  chip: {
    width: 54, height: 52, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipDay: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceMuted, letterSpacing: 0.8 },
  chipDayActive: { color: "#D4A373" },
  chipDate: { fontSize: 18, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  chipDateActive: { color: "#fff" },

  card: {
    flexDirection: "row", backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.sm, alignItems: "flex-start",
  },
  cardLeft: { width: 64, alignItems: "flex-start" },
  cardTime: { fontSize: 16, fontWeight: "700", color: colors.brand, fontFamily: "Georgia" },
  cardEndTime: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2 },
  catDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cardBody: { flex: 1, paddingHorizontal: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface, lineHeight: 20 },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  cardMetaText: { fontSize: 12, color: colors.onSurfaceMuted },
  cardDesc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 6, lineHeight: 17 },
  favBtn: { padding: 4 },

  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.onSurfaceMuted },

  fab: {
    position: "absolute", right: spacing.lg, height: 48, paddingHorizontal: 16,
    borderRadius: 24, backgroundColor: "#F2C265",
    flexDirection: "row", alignItems: "center", gap: 6,
    ...shadow.raised,
  },
  fabText: { color: "#1A2841", fontWeight: "800", fontSize: 13 },
});
