import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/AuthContext";
import AdminFooterNav from "@/src/components/AdminFooterNav";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

type CommitteeBio = {
  id: string;
  name: string;
  imageSource: number | { uri: string };
  imageUrl?: string;
  bio: string;
};

type ExpandedImage = {
  name: string;
  source: number | { uri: string };
};

const committeeBioAssets = {
  davidMackay: require("@/assets/images/committee-bios/dave_mackay.jpg"),
  terryParker: require("@/assets/images/committee-bios/terry_parker.jpg"),
  laurieBalderas: require("@/assets/images/committee-bios/lauri_balderas.jpg"),
  clarkChilders: require("@/assets/images/committee-bios/clark-childers.jpg"),
  timBelow: require("@/assets/images/committee-bios/tim_below.jpg"),
  paulEdwards: require("@/assets/images/committee-bios/paul_edwards.jpg"),
  rhysWilliams: require("@/assets/images/committee-bios/rhys-williams.jpg"),
  geoffConnolly: require("@/assets/images/committee-bios/geoff-connolly.jpg"),
} as const;

const INITIAL_BIOS: CommitteeBio[] = [
  {
    id: "david-mackay",
    name: "David Mackay",
    imageSource: committeeBioAssets.davidMackay,
    bio: "",
  },
  {
    id: "terry-parker",
    name: "Terry Parker",
    imageSource: committeeBioAssets.terryParker,
    bio: "",
  },
  {
    id: "laurie-balderas",
    name: "Laurie Balderas",
    imageSource: committeeBioAssets.laurieBalderas,
    bio: "",
  },
  {
    id: "clark-childers",
    name: "Clark Childers",
    imageSource: committeeBioAssets.clarkChilders,
    bio: "",
  },
  {
    id: "tim-below",
    name: "Tim Below",
    imageSource: committeeBioAssets.timBelow,
    bio: "",
  },
  {
    id: "paul-edwards",
    name: "Paul Edwards",
    imageSource: committeeBioAssets.paulEdwards,
    bio: "",
  },
  {
    id: "rhys-williams",
    name: "Rhys Williams",
    imageSource: committeeBioAssets.rhysWilliams,
    bio: "",
  },
  {
    id: "geoff-connolly",
    name: "Geoff Connolly",
    imageSource: committeeBioAssets.geoffConnolly,
    bio: "",
  },
];

// Keep edits alive for the duration of the app session, even if the screen remounts.
let committeeBiosSessionStore: CommitteeBio[] = INITIAL_BIOS.map((item) => ({ ...item }));

function countWords(value: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function CommitteeBiosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();

  const [bios, setBios] = useState<CommitteeBio[]>(() => committeeBiosSessionStore.map((item) => ({ ...item })));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommitteeBio | null>(null);
  const [expandedBioIds, setExpandedBioIds] = useState<Set<string>>(new Set());
  const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null);

  const isAdmin = !!auth.username;

  useEffect(() => {
    if (!auth.username && !auth.loading) {
      router.replace("/login");
    }
  }, [auth.username, auth.loading, router]);

  const draftWordCount = useMemo(() => countWords(draft?.bio || ""), [draft?.bio]);
  const canSaveDraft = !!draft && draft.name.trim().length > 0 && draftWordCount <= 400;

  const startEdit = (item: CommitteeBio) => {
    setEditingId(item.id);
    setDraft({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const toggleExpandedBio = (id: string) => {
    setExpandedBioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveEdit = () => {
    if (!draft || !canSaveDraft) return;
    const normalizedDraft = {
      ...draft,
      imageUrl: draft.imageUrl?.trim() || undefined,
    };
    committeeBiosSessionStore = bios.map((item) => (item.id === normalizedDraft.id ? { ...normalizedDraft } : item));
    setBios(committeeBiosSessionStore.map((item) => ({ ...item })));
    setEditingId(null);
    setDraft(null);
  };

  if (auth.loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ScreenBg />
        <ActivityIndicator size="large" color={onSunset.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="committee-bios-screen">
      <ScreenBg />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          hitSlop={10}
          testID="committee-bios-back"
        >
          <Ionicons name="chevron-back" size={26} color={onSunset.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Committee Bios</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helpText}>
          Committee profile cards are shown below. Admins can edit name, profile image URL, and bio text inline.
        </Text>

        {bios.map((item) => {
          const editing = isAdmin && editingId === item.id && draft;
          const bioWordCount = countWords(item.bio);
          const isExpanded = expandedBioIds.has(item.id);
          const hasBio = !!item.bio.trim();
          const imageSource = item.imageUrl?.trim() ? { uri: item.imageUrl.trim() } : item.imageSource;

          return (
            <View key={item.id} style={[styles.card, shadow.card]} testID={`committee-bio-${item.id}`}>
              {!editing ? (
                <>
                  <View style={styles.cardHead}>
                    <Pressable
                      onPress={() => setExpandedImage({ name: item.name, source: imageSource })}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Expand profile image for ${item.name}`}
                      testID={`committee-bio-image-expand-${item.id}`}
                    >
                      <Image
                        source={imageSource}
                        style={styles.avatar}
                        contentFit="cover"
                      />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>{bioWordCount} / 400 words</Text>
                    </View>
                    {isAdmin ? (
                      <Pressable
                        onPress={() => startEdit(item)}
                        style={styles.editBtn}
                        testID={`committee-bio-edit-${item.id}`}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.brand} />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <Text style={styles.bioText} numberOfLines={isExpanded ? undefined : 3}>
                    {hasBio ? item.bio : "Bio coming soon."}
                  </Text>
                  {hasBio ? (
                    <Pressable
                      onPress={() => toggleExpandedBio(item.id)}
                      hitSlop={8}
                      style={styles.readMoreBtn}
                      testID={`committee-bio-toggle-${item.id}`}
                    >
                      <Text style={styles.readMoreText}>{isExpanded ? "Show less" : "Read more"}</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Inline editor for this card only. */}
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={draft.name}
                    onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, name: value } : prev))}
                    placeholder="Committee member name"
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`committee-bio-name-${item.id}`}
                  />

                  <Text style={styles.inputLabel}>Profile image URL</Text>
                  <TextInput
                    style={styles.input}
                    value={draft.imageUrl || ""}
                    onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, imageUrl: value } : prev))}
                    placeholder="Paste an image URL to override the uploaded headshot"
                    placeholderTextColor={colors.onSurfaceMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID={`committee-bio-image-${item.id}`}
                  />

                  <Text style={styles.inputLabel}>Bio (max 400 words)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={draft.bio}
                    onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, bio: value } : prev))}
                    multiline
                    textAlignVertical="top"
                    placeholder="Paste or write committee bio..."
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`committee-bio-text-${item.id}`}
                  />

                  <Text style={[styles.counter, draftWordCount > 400 && styles.counterError]}>
                    {draftWordCount} / 400 words
                  </Text>

                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={cancelEdit}
                      style={[styles.actionBtn, styles.cancelBtn]}
                      testID={`committee-bio-cancel-${item.id}`}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveEdit}
                      disabled={!canSaveDraft}
                      style={[styles.actionBtn, styles.saveBtn, !canSaveDraft && { opacity: 0.45 }]}
                      testID={`committee-bio-save-${item.id}`}
                    >
                      <Text style={styles.saveBtnText}>Save</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!expandedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <View style={styles.imageModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setExpandedImage(null)}
            testID="committee-bio-image-dismiss"
          />
          <View style={styles.imageModalCard}>
            <Text style={styles.imageModalTitle}>{expandedImage?.name}</Text>
            {expandedImage ? (
              <Image
                source={expandedImage.source}
                style={styles.expandedImage}
                contentFit="contain"
              />
            ) : null}
            <Pressable
              onPress={() => setExpandedImage(null)}
              style={styles.closeImageBtn}
              testID="committee-bio-image-close"
            >
              <Text style={styles.closeImageBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <AdminFooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: onSunset.primary, fontFamily: "Georgia" },
  helpText: {
    color: onSunset.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E8ECF2",
  },
  name: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Georgia",
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurfaceMuted,
  },
  bioText: {
    marginTop: spacing.sm,
    color: colors.onSurface,
    fontSize: 13,
    lineHeight: 20,
  },
  readMoreBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  readMoreText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8ECF2",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
  inputLabel: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    padding: spacing.md,
    fontSize: 14,
  },
  inputMulti: {
    minHeight: 120,
  },
  counter: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.onSurfaceMuted,
    textAlign: "right",
  },
  counterError: {
    color: colors.error,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#E8ECF2",
  },
  cancelBtnText: {
    color: colors.onSurface,
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: colors.brand,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
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