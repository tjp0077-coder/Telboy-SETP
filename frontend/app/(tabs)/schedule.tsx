import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  RefreshControl, FlatList, Dimensions, Linking, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, CommitteeBioItem, SessionItem } from "@/src/api";
import { COMMITTEE_DAY26_ORDER, COMMITTEE_SEED_BY_ID } from "@/src/constants/committeeBios";
import { useFavorites } from "@/src/useFavorites";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg } from "@/src/components/ScreenBg";

const HERO = require("@/assets/images/brand/hero.jpg");
const INCHOLM_PAY_BUTTON = require("@/assets/images/brand/IncholmPayButton.jpg");
const APP_ICON = require("@/assets/images/icon.png");
const LANDING_FEE_LINK = "https://pay.collctiv.com/inchcolm-island-landing-fee-74966";
const LANDING_FEE_DATE = "2026-07-30";
const COMMITTEE_CARD_DATE = "2026-07-26";

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

const isTechnicalTalk = (item: SessionItem) =>
  item.category === "session" && /technical session|paper/i.test(`${item.title} ${item.description || ""}`);

type CommitteeCardBio = {
  id: string;
  name: string;
  bio: string;
  imageSource: number;
};

type ExpandedCommitteeImage = {
  name: string;
  source: number;
};

type CommitteeGridItem =
  | { kind: "member"; member: CommitteeCardBio }
  | { kind: "icon"; id: string };

export default function ScheduleListScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [committeeBios, setCommitteeBios] = useState<CommitteeCardBio[]>([]);
  const [expandedCommitteeImage, setExpandedCommitteeImage] = useState<ExpandedCommitteeImage | null>(null);
  const { favorites, toggle } = useFavorites();

  const committeeGridItems = useMemo<CommitteeGridItem[]>(() => {
    const terryIdx = committeeBios.findIndex((item) => item.id === "terry-parker");
    const rhysIdx = committeeBios.findIndex((item) => item.id === "rhys-williams");
    if (terryIdx === -1 || rhysIdx === -1 || rhysIdx <= terryIdx) {
      return committeeBios.map((member) => ({ kind: "member", member }));
    }

    const beforeRhys = committeeBios.slice(0, rhysIdx).map((member) => ({ kind: "member", member } as const));
    const rhys = committeeBios[rhysIdx];
    return [
      ...beforeRhys,
      { kind: "icon", id: "setp-icon-slot" },
      { kind: "member", member: rhys },
    ];
  }, [committeeBios]);

  const load = useCallback(async () => {
    try {
      const [data, persistedCommittee] = await Promise.all([
        api.listSchedule(),
        api.listCommitteeBios().catch(() => [] as CommitteeBioItem[]),
      ]);
      setItems(data);
      if (data.length && !activeDate) setActiveDate(data[0].date);

      const persistedById = new Map<string, CommitteeBioItem>(persistedCommittee.map((item) => [item.id, item]));
      const merged = COMMITTEE_DAY26_ORDER
        .map((id) => {
          const seeded = COMMITTEE_SEED_BY_ID[id];
          if (!seeded) return null;
          const stored = persistedById.get(id);
          return {
            id,
            name: stored?.name || seeded.name,
            bio: stored?.bio || "",
            imageSource: seeded.imageSource,
          };
        })
        .filter((item): item is CommitteeCardBio => !!item);
      setCommitteeBios(merged);
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

  const openLandingFeePayment = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(LANDING_FEE_LINK);
      if (!supported) {
        Alert.alert("Unable to open payment link", "Please try again in a few moments.");
        return;
      }
      await Linking.openURL(LANDING_FEE_LINK);
    } catch {
      Alert.alert("Unable to open payment link", "Please try again in a few moments.");
    }
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const winH = Dimensions.get("window").height;
  const winW = Dimensions.get("window").width;
  const heroHeight = Math.min((winW - spacing.lg * 2) / 2, winH * 0.28);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="schedule-list-screen">
      <ScreenBg />

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: tabBarHeight + spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { height: heroHeight }]}>
              <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <View style={styles.chipRow}>
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
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.onSurfaceMuted} />
            <Text style={styles.emptyText}>No sessions for this day</Text>
          </View>
        }
        ListFooterComponent={
          <>
            {activeDate === COMMITTEE_CARD_DATE ? (
              <View style={[styles.committeeCard, styles.committeeCardFill]} testID="meet-committee-card">
                <View style={styles.committeeTitleRow}>
                  <Text style={styles.committeeTitle}>Meet the Committee</Text>
                </View>
                <Text style={styles.committeeSubTitle}>Tap a photo to expand</Text>
                <View style={styles.committeeGrid}>
                  {committeeGridItems.map((item) => {
                    if (item.kind === "icon") {
                      return (
                        <View key={item.id} style={styles.committeeMember} testID="committee-day26-icon-slot">
                          <Image source={APP_ICON} style={styles.committeeAvatar} contentFit="contain" />
                          <Text style={styles.committeeMemberName} numberOfLines={2}>SETP 2026</Text>
                        </View>
                      );
                    }

                    const member = item.member;
                    return (
                      <Pressable
                        key={member.id}
                        style={styles.committeeMember}
                        onPress={() => setExpandedCommitteeImage({ name: member.name, source: member.imageSource })}
                        testID={`committee-day26-${member.id}`}
                      >
                        <Image source={member.imageSource} style={styles.committeeAvatar} contentFit="cover" />
                        <Text style={styles.committeeMemberName} numberOfLines={2}>{member.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => router.push("/committee-bios")}
                  style={styles.committeeBioBtn}
                  testID="committee-day26-bio-btn"
                >
                  <Ionicons name="book-outline" size={14} color={colors.brand} />
                  <Text style={styles.committeeBioBtnText}>Bio</Text>
                </Pressable>
              </View>
            ) : null}
            {activeDate === LANDING_FEE_DATE ? (
              <View style={styles.paymentWrap} testID="landing-fee-card">
                <Pressable
                  onPress={openLandingFeePayment}
                  style={[styles.paymentHeader, shadow.card]}
                  testID="pay-landing-fee-image"
                >
                  <Image source={INCHOLM_PAY_BUTTON} style={styles.paymentBanner} contentFit="cover" />
                </Pressable>

                <Pressable
                  onPress={openLandingFeePayment}
                  style={[styles.paymentBtn, shadow.card]}
                  testID="pay-landing-fee-single"
                >
                  <Text style={styles.paymentBtnTitle}>Pay Historic Scotland £8.50 landing fee</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const fav = favorites.has(item.id);
          const cIcon = CATEGORY_ICON[item.category] || "ellipse";
          const cColor = CATEGORY_COLOR[item.category] || colors.brand;
          const askSpeaker = isTechnicalTalk(item);
          const hasSpeakerBios = (item.speakerBios || []).length > 0 || !!item.speakerId;
          const coachMeta = item.transportDetails?.trim() || (item.coachTime ? `${item.coachTime} – Coach leaves hotel` : "");
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
                {coachMeta ? (
                  <View style={styles.cardMeta}>
                    <Ionicons name="bus" size={15} color={colors.onSurfaceMuted} />
                    <Text style={styles.coachMetaText}>{coachMeta}</Text>
                  </View>
                ) : null}
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}
                {askSpeaker && hasSpeakerBios ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push(`/speaker-bios/${item.id}`);
                    }}
                    style={styles.speakerBtn}
                    hitSlop={8}
                    testID={`speaker-bio-link-${item.id}`}
                  >
                    <Ionicons name="people-outline" size={14} color={colors.brand} />
                    <Text style={styles.speakerBtnText}>Speaker Bio's</Text>
                  </Pressable>
                ) : null}
                {askSpeaker ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push({ pathname: "/questions", params: { event_id: item.id, event_title: item.title } });
                    }}
                    style={styles.askBtn}
                    hitSlop={8}
                    testID={`ask-speaker-${item.id}`}
                  >
                    <Ionicons name="mic-outline" size={14} color={colors.success} />
                    <Text style={styles.askBtnText}>Ask the speaker</Text>
                  </Pressable>
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

      <Modal
        visible={!!expandedCommitteeImage}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedCommitteeImage(null)}
      >
        <View style={styles.imageModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setExpandedCommitteeImage(null)}
            testID="committee-day26-image-dismiss"
          />
          <View style={styles.imageModalCard}>
            <Text style={styles.imageModalTitle}>{expandedCommitteeImage?.name}</Text>
            {expandedCommitteeImage ? (
              <Image source={expandedCommitteeImage.source} style={styles.expandedImage} contentFit="contain" />
            ) : null}
            <Pressable
              onPress={() => setExpandedCommitteeImage(null)}
              style={styles.closeImageBtn}
              testID="committee-day26-image-close"
            >
              <Text style={styles.closeImageBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { marginBottom: spacing.md, borderRadius: 8, overflow: "hidden", backgroundColor: "#0F1A2E" },
  chipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    flex: 1, marginHorizontal: 3, height: 50, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
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
  coachMetaText: { fontSize: 12, color: colors.onSurfaceMuted, fontFamily: "Georgia", fontStyle: "italic", fontWeight: "700" },
  cardDesc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 6, lineHeight: 17 },
  askBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#EAF5EE",
  },
  askBtnText: { fontSize: 12, fontWeight: "800", color: colors.success },
  speakerBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#E8ECF2",
  },
  speakerBtnText: { fontSize: 12, fontWeight: "800", color: colors.brand },
  favBtn: { padding: 4 },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.onSurfaceMuted },

  paymentWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  committeeCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(15,26,46,0.35)",
  },
  committeeCardFill: {
    minHeight: Math.max(420, Dimensions.get("window").height * 0.58),
  },
  committeeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  committeeTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Georgia",
  },
  committeeSubTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.85,
    fontFamily: "Georgia",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  committeeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  committeeMember: {
    width: "31%",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  committeeAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#DDE3EA",
  },
  committeeMemberName: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    fontWeight: "700",
  },
  committeeBioBtn: {
    marginTop: spacing.md,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8ECF2",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  committeeBioBtnText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  paymentHeader: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  paymentBanner: { width: "100%", aspectRatio: 1536 / 1024 },
  paymentBtn: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "#E8ECF2",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  paymentBtnTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand,
  },
  paymentBtnSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurfaceMuted,
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  imageModalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.card,
  },
  imageModalTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.sm,
    fontFamily: "Georgia",
  },
  expandedImage: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 420,
    borderRadius: radius.md,
    backgroundColor: "#DDE3EA",
  },
  closeImageBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeImageBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
