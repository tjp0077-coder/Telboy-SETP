import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

const HERO = require("@/assets/images/brand/symposium_hub_hero.png");
const TRAM = "https://images.unsplash.com/photo-1729639316718-c148801e55bc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxFZGluYnVyZ2glMjB0cmFtfGVufDB8fHx8MTc4MTAyNTMyNnww&ixlib=rb-4.1.0&q=85";
const SYMPOSIUM_VENUES = require("@/assets/images/brand/symposium_venues.png");
const CITY_GUIDE_OVERRIDES_KEY = "cache:cityguide:venue-overrides";

type CityGuideVenue = {
  name: string;
  address: string;
  notes: string;
  maps_url: string;
};

type CityGuideData = {
  hero: { title: string; subtitle: string };
  essentials: Array<{ title: string; icon: string; summary: string }>;
  transport: Array<{ name: string; icon: string; description: string; tip: string; url?: string }>;
  phrases: Array<{ phrase: string; meaning: string }>;
  venues: CityGuideVenue[];
};

type VenueDraft = {
  address: string;
  notes: string;
};

function parseVenueOverrides(raw: string | null): Record<string, VenueDraft> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, VenueDraft>;
  } catch {
    return {};
  }
}

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
  const tabBarHeight = useBottomTabBarHeight();
  const { auth } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingVenue, setEditingVenue] = useState<string | null>(null);
  const [venueDraft, setVenueDraft] = useState<VenueDraft | null>(null);
  const isAdmin = !!auth.username;

  const load = useCallback(async () => {
    try {
      const [res, overridesRaw] = await Promise.all([
        api.cityGuide() as Promise<CityGuideData>,
        AsyncStorage.getItem(CITY_GUIDE_OVERRIDES_KEY),
      ]);
      const overrides = parseVenueOverrides(overridesRaw);
      setData({
        ...res,
        venues: (res.venues || []).map((venue) => ({
          ...venue,
          ...(overrides[venue.name] || {}),
        })),
      });
    } catch {
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startVenueEdit = (venue: CityGuideVenue) => {
    if (!isAdmin) return;
    setEditingVenue(venue.name);
    setVenueDraft({ address: venue.address, notes: venue.notes });
  };

  const cancelVenueEdit = () => {
    setEditingVenue(null);
    setVenueDraft(null);
  };

  const saveVenueEdit = useCallback(async (venueName: string) => {
    if (!venueDraft) return;
    const nextVenue = {
      address: venueDraft.address.trim(),
      notes: venueDraft.notes.trim(),
    };
    const nextOverridesRaw = await AsyncStorage.getItem(CITY_GUIDE_OVERRIDES_KEY);
    const nextOverrides = parseVenueOverrides(nextOverridesRaw);
    nextOverrides[venueName] = nextVenue;
    await AsyncStorage.setItem(CITY_GUIDE_OVERRIDES_KEY, JSON.stringify(nextOverrides));
    setData((prev: CityGuideData | null) => (
      prev ? {
        ...prev,
        venues: prev.venues.map((venue) => (
          venue.name === venueName ? { ...venue, ...nextVenue } : venue
        )),
      } : prev
    ));
    setEditingVenue(null);
    setVenueDraft(null);
  }, [venueDraft]);

  if (loading || !data) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }

  const openMap = (url: string) => { Linking.openURL(url).catch(() => {}); };

  return (
    <View style={{ flex: 1 }} testID="city-guide-screen">
      <ScreenBg />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(18,24,34,0.2)", "rgba(18,24,34,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>FOR DELEGATES</Text>
          <Text style={styles.heroTitle}>{data.hero.title}</Text>
          <Text style={styles.heroSub}>{data.hero.subtitle}</Text>
        </View>
      </View>

          <Pressable
            onPress={() => Linking.openURL("https://whiskyandwitches.com/").catch(() => {})}
            style={styles.kiltBanner}
            testID="whisky-and-witches-banner"
          >
            <Image
              source={require("@/assets/images/brand/wandw.webp")}
              style={styles.kiltImage}
              contentFit="cover"
            />
          </Pressable>

        <Pressable
          onPress={() => Linking.openURL("https://theknightsvault.com/").catch(() => {})}
          style={styles.kiltBanner}
          testID="knights-vault-banner"
        >
          <Image
            source={require("@/assets/images/brand/knights_vault.png")}
            style={styles.kiltImage}
            contentFit="cover"
          />
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL("https://www.edinburghgin.com/").catch(() => {})}
          style={styles.kiltBanner}
          testID="edinburgh-gin-banner"
        >
          <Image
            source={require("@/assets/images/brand/edigin-static.jpg")}
            style={styles.kiltImage}
            contentFit="cover"
          />
        </Pressable>

        <View style={styles.kiltBanner} testID="storymaker-banner">
          <Image
            source={require("@/assets/images/brand/storymaker.jpg")}
            style={styles.kiltImage}
            contentFit="cover"
          />
        </View>

        <Pressable
          onPress={() => Linking.openURL("https://www.a1kilthire.co.uk/index").catch(() => {})}
          style={styles.kiltBanner}
          testID="kilt-hire-banner"
        >
          <Image
            source={require("@/assets/images/brand/kilthire.jpg")}
            style={styles.kiltImage}
            contentFit="cover"
          />
        </Pressable>

        {/* Venues */}
        <Text style={styles.sectionTitle}>Symposium Venues</Text>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Image source={SYMPOSIUM_VENUES} style={styles.transportHero} contentFit="cover" />
        </View>
        {data.venues.map((v: CityGuideVenue) => {
          const editing = isAdmin && editingVenue === v.name && venueDraft;
          return (
          <View key={v.name} style={[styles.venueCard, shadow.card]} testID={`venue-${v.name}`}>
            <View style={{ flex: 1 }}>
              <View style={styles.venueHeadRow}>
                <Text style={styles.venueName}>{v.name}</Text>
                {isAdmin && !editing ? (
                  <Pressable
                    onPress={() => startVenueEdit(v)}
                    style={styles.venueEditBtn}
                    testID={`venue-edit-${v.name}`}
                  >
                    <Ionicons name="create-outline" size={13} color={colors.brand} />
                    <Text style={styles.venueEditBtnText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
              {!editing ? (
                <>
                  <Text style={styles.venueAddr}>{v.address}</Text>
                  <Text style={styles.venueNotes}>{v.notes}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.venueFieldLabel}>Address</Text>
                  <TextInput
                    value={venueDraft.address}
                    onChangeText={(value) => setVenueDraft((prev) => (prev ? { ...prev, address: value } : prev))}
                    placeholder="Venue address"
                    placeholderTextColor={colors.onSurfaceMuted}
                    style={styles.venueInput}
                    multiline
                    testID={`venue-address-${v.name}`}
                  />
                  <Text style={styles.venueFieldLabel}>Notes</Text>
                  <TextInput
                    value={venueDraft.notes}
                    onChangeText={(value) => setVenueDraft((prev) => (prev ? { ...prev, notes: value } : prev))}
                    placeholder="Venue notes"
                    placeholderTextColor={colors.onSurfaceMuted}
                    style={[styles.venueInput, styles.venueInputMulti]}
                    multiline
                    textAlignVertical="top"
                    testID={`venue-notes-${v.name}`}
                  />
                  <View style={styles.venueEditorActions}>
                    <Pressable
                      onPress={() => saveVenueEdit(v.name)}
                      style={[styles.venueActionBtn, styles.venueActionPrimary]}
                      testID={`venue-save-${v.name}`}
                    >
                      <Text style={styles.venueActionPrimaryText}>Save</Text>
                    </Pressable>
                    <Pressable
                      onPress={cancelVenueEdit}
                      style={[styles.venueActionBtn, styles.venueActionSecondary]}
                      testID={`venue-cancel-${v.name}`}
                    >
                      <Text style={styles.venueActionSecondaryText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              )}
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
          );
        })}

        {/* Essentials grid */}

      <Text style={styles.sectionTitle}>The Essentials</Text>
      <View style={styles.grid}>
        {data.essentials.map((e: any) => (
          <View key={e.title} style={[styles.gridCard, shadow.card]} testID={`essential-${e.title}`}>
            <View style={styles.gridIcon}>
              <Ionicons name={ESSENTIAL_ICONS[e.icon] || "information-circle"} size={26} color={colors.brand} />
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
              <Ionicons name={TRANSPORT_ICONS[t.icon] || "navigate"} size={28} color={colors.brand} />
            </View>
            <Text style={styles.transportName}>{t.name}</Text>
          </View>
          <Text style={styles.transportDesc}>{t.description}</Text>
          {t.tip ? (
            <View style={styles.tip}>
              <Ionicons name="bulb" size={14} color={colors.brandTertiary} />
              <Text style={styles.tipText}>{t.tip}</Text>
            </View>
          ) : null}
          {t.url ? (
            <Pressable
              onPress={() => Linking.openURL(t.url).catch(() => {})}
              style={styles.linkBtn}
              testID={`transport-link-${t.name}`}
            >
              <Ionicons name="open-outline" size={14} color="#fff" />
              <Text style={styles.linkBtnText}>Visit website</Text>
            </Pressable>
          ) : null}
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

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: { height: 240, paddingHorizontal: spacing.lg, justifyContent: "flex-end", paddingBottom: spacing.lg },
  heroContent: {},
  heroEyebrow: { color: "#D4A373", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 4 },
  heroTitle: { color: "#fff", fontSize: 30, fontWeight: "700", fontFamily: "Georgia" },
  heroSub: { color: "#E2DFD8", fontSize: 13, marginTop: 6 },

  sectionTitle: {
    fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: onSunset.primary,
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
  },

  kiltBanner: {
    marginHorizontal: spacing.lg, marginTop: spacing.xl, borderRadius: radius.md,
    overflow: "hidden", backgroundColor: "#000",
    ...shadow.card,
  },
  kiltImage: { width: "100%", aspectRatio: 1080 / 500 },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg - 4, gap: 0 },
  gridCard: {
    width: "48%", margin: "1%", backgroundColor: colors.surfaceSecondary,
    padding: spacing.md, borderRadius: radius.md, minHeight: 130,
  },
  gridIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#E8ECF2",
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center",
  },
  transportName: { fontSize: 16, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  transportDesc: { fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  tip: {
    flexDirection: "row", gap: 6, alignItems: "flex-start",
    backgroundColor: "#FBF1E5", padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm,
  },
  tipText: { flex: 1, fontSize: 12, color: "#7A4416", lineHeight: 17 },

  linkBtn: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, marginTop: spacing.sm,
  },
  linkBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

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
  venueHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  venueName: { fontSize: 15, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  venueAddr: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  venueNotes: { fontSize: 12, color: colors.onSurface, marginTop: 4, lineHeight: 17 },
  venueEditBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: "#F1F5FB",
  },
  venueEditBtnText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
  venueFieldLabel: { marginTop: spacing.sm, marginBottom: 4, fontSize: 11, fontWeight: "800", letterSpacing: 0.7, color: onSunset.primary },
  venueInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface,
    paddingHorizontal: 10, paddingVertical: 8, color: colors.onSurface, fontSize: 12,
  },
  venueInputMulti: { minHeight: 72 },
  venueEditorActions: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  venueActionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  venueActionPrimary: { backgroundColor: colors.brand },
  venueActionPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  venueActionSecondary: { backgroundColor: "#ECEFF4" },
  venueActionSecondaryText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  mapBtn: {
    backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 4,
  },
  mapBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  ideaCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
  },
  ideaHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  ideaTag: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: colors.brandTertiary },
  ideaTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface, marginTop: spacing.xs, fontFamily: "Georgia" },
  ideaSummary: { fontSize: 13, color: colors.onSurface, marginTop: spacing.xs, lineHeight: 19 },
  ideaMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: spacing.sm },
});
