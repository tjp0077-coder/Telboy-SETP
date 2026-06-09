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

const HERO = "https://images.unsplash.com/photo-1595275842222-bb71d4209726?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxFZGluYnVyZ2glMjBza3lsaW5lfGVufDB8fHxibHVlfDE3ODEwMjUzMjV8MA&ixlib=rb-4.1.0&q=85";

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
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(18,24,34,0.15)", "rgba(18,24,34,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>SETP SYMPOSIUM · EDINBURGH</Text>
          <Text style={styles.heroTitle}>25–30 July 2026</Text>
          <Text style={styles.heroSub}>Welcome, delegate. Plan your symposium.</Text>
        </View>
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
          const [, mm, dd] = d.date.split("-");
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

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
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
            <Ionicons name="calendar-outline" size={48} color={colors.onSurfaceMuted} />
            <Text style={styles.emptyText}>No sessions for this day</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fav = favorites.has(item.id);
          const cIcon = CATEGORY_ICON[item.category] || "ellipse";
          const cColor = CATEGORY_COLOR[item.category] || colors.brand;
          return (
            <View style={[styles.card, shadow.card]} testID={`session-card-${item.id}`}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTime}>{item.time}</Text>
                {item.end_time ? <Text style={styles.cardEndTime}>{item.end_time}</Text> : null}
                <View style={[styles.catDot, { backgroundColor: cColor }]}>
                  <Ionicons name={cIcon} size={12} color="#fff" />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="location" size={13} color={colors.onSurfaceMuted} />
                  <Text style={styles.cardMetaText}>{item.location}</Text>
                </View>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => toggle(item.id)}
                style={styles.favBtn}
                hitSlop={10}
                testID={`fav-btn-${item.id}`}
              >
                <Ionicons
                  name={fav ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={fav ? colors.brandTertiary : colors.onSurfaceMuted}
                />
              </Pressable>
            </View>
          );
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { height: 180, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.lg, overflow: "hidden" },
  heroContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg },
  heroEyebrow: { color: "#D4A373", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "700", fontFamily: "Georgia" },
  heroSub: { color: "#E2DFD8", fontSize: 13, marginTop: 4 },

  chipRowWrap: { maxHeight: 72 },
  chipRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    width: 62, height: 56, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipDay: { fontSize: 10, fontWeight: "700", color: colors.onSurfaceMuted, letterSpacing: 1 },
  chipDayActive: { color: "#D4A373" },
  chipDate: { fontSize: 20, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  chipDateActive: { color: "#fff" },

  card: {
    flexDirection: "row", backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.sm, alignItems: "flex-start",
  },
  cardLeft: { width: 64, alignItems: "flex-start" },
  cardTime: { fontSize: 16, fontWeight: "700", color: colors.brand, fontFamily: "Georgia" },
  cardEndTime: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2 },
  catDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cardBody: { flex: 1, paddingHorizontal: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurface, lineHeight: 20 },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  cardMetaText: { fontSize: 12, color: colors.onSurfaceMuted },
  cardDesc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 6, lineHeight: 17 },
  favBtn: { padding: 4 },

  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.onSurfaceMuted },

  fab: {
    position: "absolute", right: spacing.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
    ...shadow.raised,
  },
});
