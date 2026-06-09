import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius, shadow } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1595275842222-bb71d4209726?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxFZGluYnVyZ2glMjBza3lsaW5lfGVufDB8fHxibHVlfDE3ODEwMjUzMjV8MA&ixlib=rb-4.1.0&q=85";
const TRAM = "https://images.unsplash.com/photo-1729639316718-c148801e55bc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxFZGluYnVyZ2glMjB0cmFtfGVufDB8fHx8MTc4MTAyNTMyNnww&ixlib=rb-4.1.0&q=85";
const BRITANNIA = "https://images.unsplash.com/photo-1704632992039-a69ea56b5aee?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxSb3lhbCUyMFlhY2h0JTIwQnJpdGFubmlhfGVufDB8fHx8MTc4MTAyNTMyNXww&ixlib=rb-4.1.0&q=85";

const ESSENTIAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "currency-pound": "cash",
  "plug": "flash",
  "tip": "wallet",
  "phone": "call",
};

const TRANSPORT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  tram: "train",
  bus: "bus",
  car: "car",
  rideshare: "car-sport",
  walk: "walk",
  train: "train",
};

export default function CityGuideScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.cityGuide();
      setData(res);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }

  const openMap = (url: string) => { Linking.openURL(url).catch(() => {}); };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      testID="city-guide-screen"
    >
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(18,24,34,0.2)", "rgba(18,24,34,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>FOR AMERICAN DELEGATES</Text>
          <Text style={styles.heroTitle}>{data.hero.title}</Text>
          <Text style={styles.heroSub}>{data.hero.subtitle}</Text>
        </View>
      </View>

      {/* Essentials grid */}
      <Text style={styles.sectionTitle}>The Essentials</Text>
      <View style={styles.grid}>
        {data.essentials.map((e: any) => (
          <View key={e.title} style={[styles.gridCard, shadow.card]} testID={`essential-${e.title}`}>
            <View style={styles.gridIcon}>
              <Ionicons name={ESSENTIAL_ICONS[e.icon] || "information-circle"} size={20} color={colors.brand} />
            </View>
            <Text style={styles.gridTitle}>{e.title}</Text>
            <Text style={styles.gridDesc}>{e.summary}</Text>
          </View>
        ))}
      </View>

      {/* Transport */}
      <Text style={styles.sectionTitle}>Getting Around</Text>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Image source={TRAM} style={styles.transportHero} contentFit="cover" />
      </View>
      {data.transport.map((t: any) => (
        <View key={t.name} style={[styles.transportCard, shadow.card]} testID={`transport-${t.name}`}>
          <View style={styles.transportHead}>
            <View style={styles.transportIconWrap}>
              <Ionicons name={TRANSPORT_ICONS[t.icon] || "navigate"} size={22} color={colors.brand} />
            </View>
            <Text style={styles.transportName}>{t.name}</Text>
          </View>
          <Text style={styles.transportDesc}>{t.description}</Text>
          <View style={styles.tip}>
            <Ionicons name="bulb" size={14} color={colors.brandTertiary} />
            <Text style={styles.tipText}>{t.tip}</Text>
          </View>
        </View>
      ))}

      {/* Phrases */}
      <Text style={styles.sectionTitle}>Scottish Phrasebook</Text>
      <View style={[styles.phrasesCard, shadow.card]}>
        {data.phrases.map((p: any, i: number) => (
          <View
            key={p.phrase}
            style={[styles.phraseRow, i === data.phrases.length - 1 && { borderBottomWidth: 0 }]}
          >
            <Text style={styles.phraseWord}>{p.phrase}</Text>
            <Text style={styles.phraseMean}>{p.meaning}</Text>
          </View>
        ))}
      </View>

      {/* Venues */}
      <Text style={styles.sectionTitle}>Symposium Venues</Text>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Image source={BRITANNIA} style={styles.transportHero} contentFit="cover" />
      </View>
      {data.venues.map((v: any) => (
        <View key={v.name} style={[styles.venueCard, shadow.card]} testID={`venue-${v.name}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.venueName}>{v.name}</Text>
            <Text style={styles.venueAddr}>{v.address}</Text>
            <Text style={styles.venueNotes}>{v.notes}</Text>
          </View>
          <Pressable
            onPress={() => openMap(v.maps_url)}
            style={styles.mapBtn}
            testID={`venue-map-${v.name}`}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.mapBtnText}>Open</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface },

  hero: { height: 240, paddingHorizontal: spacing.lg, justifyContent: "flex-end", paddingBottom: spacing.lg },
  heroContent: {},
  heroEyebrow: { color: "#D4A373", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 30, fontWeight: "700", fontFamily: "Georgia" },
  heroSub: { color: "#E2DFD8", fontSize: 13, marginTop: 6 },

  sectionTitle: {
    fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: colors.onSurfaceMuted,
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg - 4, gap: 0 },
  gridCard: {
    width: "48%", margin: "1%", backgroundColor: colors.surfaceSecondary,
    padding: spacing.md, borderRadius: radius.md, minHeight: 130,
  },
  gridIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  gridTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginBottom: 2 },
  gridDesc: { fontSize: 11, color: colors.onSurfaceMuted, lineHeight: 16 },

  transportHero: {
    width: "100%", height: 140, borderRadius: radius.md, marginBottom: spacing.md,
  },
  transportCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
  },
  transportHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  transportIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center",
  },
  transportName: { fontSize: 16, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  transportDesc: { fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  tip: {
    flexDirection: "row", gap: 6, alignItems: "flex-start",
    backgroundColor: "#FBF1E5", padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm,
  },
  tipText: { flex: 1, fontSize: 12, color: "#7A4416", lineHeight: 17 },

  phrasesCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  phraseRow: {
    flexDirection: "row", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  phraseWord: { width: 100, fontSize: 14, fontWeight: "700", color: colors.brand, fontFamily: "Georgia" },
  phraseMean: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 18 },

  venueCard: {
    flexDirection: "row", marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    alignItems: "center", gap: spacing.sm,
  },
  venueName: { fontSize: 15, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  venueAddr: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  venueNotes: { fontSize: 12, color: colors.onSurface, marginTop: 4, lineHeight: 17 },
  mapBtn: {
    backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 4,
  },
  mapBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
