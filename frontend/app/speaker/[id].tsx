import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SpeakerItem } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { ScreenBg } from "@/src/components/ScreenBg";

function countWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function SpeakerBioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const isAdmin = !!auth.username;

  const [speaker, setSpeaker] = useState<SpeakerItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft holds editable fields while the read-only card remains untouched.
  const [draft, setDraft] = useState<SpeakerItem | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getSpeaker(id);
      setSpeaker(data);
      setDraft(data);
    } catch {
      setSpeaker(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const draftWordCount = useMemo(() => countWords(draft?.bioText || ""), [draft?.bioText]);
  const bioWordCount = useMemo(() => countWords(speaker?.bioText || ""), [speaker?.bioText]);
  const wordCountValid = draftWordCount >= 200 && draftWordCount <= 500;

  const pickImage = useCallback(() => {
    if (Platform.OS !== "web") {
      Alert.alert("Image upload", "Paste an image URL for now. Hook native image picker upload here when needed.");
      return;
    }

    const doc = (globalThis as any).document;
    if (!doc) return;

    const input = doc.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event: any) => {
      const file = event?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        setDraft((prev) => (prev ? { ...prev, imageUrl: result } : prev));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const save = useCallback(async () => {
    if (!id || !draft) return;
    if (!wordCountValid) {
      Alert.alert("Bio length", "Biography must be between 200 and 500 words.");
      return;
    }

    setSaving(true);
    try {
      // Hook backend save here (already wired to PUT /api/speakers/:id).
      const updated = await api.updateSpeaker(id, {
        name: draft.name,
        title: draft.title,
        company: draft.company,
        imageUrl: draft.imageUrl,
        bioText: draft.bioText,
      });
      setSpeaker(updated);
      setDraft(updated);
      setEditing(false);
    } catch {
      Alert.alert("Save failed", "Could not save speaker bio. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [draft, id, wordCountValid]);

  const goBackToSchedule = () => {
    if (router.canGoBack()) {
      // Back preserves the existing schedule list state and scroll position.
      router.back();
      return;
    }
    router.replace("/(tabs)/schedule");
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ScreenBg />
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!speaker || !draft) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.lg }]}>
        <ScreenBg />
        <Ionicons name="person-circle-outline" size={44} color={colors.onSurfaceMuted} />
        <Text style={styles.emptyTitle}>Speaker not found</Text>
        <Pressable style={styles.backBtn} onPress={goBackToSchedule}>
          <Text style={styles.backBtnText}>Back to Schedule</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="speaker-bio-screen">
      <ScreenBg />

      <View style={styles.topBar}>
        <Pressable onPress={goBackToSchedule} hitSlop={10} testID="speaker-bio-back-top">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Speaker Bio</Text>
        <View style={styles.topRight}>
          {isAdmin && !editing ? (
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn} testID="speaker-edit-bio">
              <Ionicons name="create-outline" size={14} color="#fff" />
              <Text style={styles.editBtnText}>Edit Bio</Text>
            </Pressable>
          ) : (
            <View style={{ width: 66 }} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, shadow.card]}>
          <Image source={{ uri: draft.imageUrl || speaker.imageUrl }} style={styles.avatar} contentFit="cover" />
          <Text style={styles.name}>{draft.title} {draft.name}</Text>
          <Text style={styles.company}>{draft.company}</Text>

          {!editing ? (
            <>
              <Text style={styles.wordMeta}>{bioWordCount} words</Text>
              <Text style={styles.bioText}>{speaker.bioText}</Text>
            </>
          ) : (
            <View style={styles.formWrap}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                value={draft.title}
                onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, title: value } : prev))}
                style={styles.input}
                placeholder="e.g. Capt."
                placeholderTextColor={colors.onSurfaceMuted}
                testID="speaker-input-title"
              />

              <Text style={styles.label}>Name</Text>
              <TextInput
                value={draft.name}
                onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, name: value } : prev))}
                style={styles.input}
                placeholder="Speaker name"
                placeholderTextColor={colors.onSurfaceMuted}
                testID="speaker-input-name"
              />

              <Text style={styles.label}>Company / Organization</Text>
              <TextInput
                value={draft.company}
                onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, company: value } : prev))}
                style={styles.input}
                placeholder="Organization"
                placeholderTextColor={colors.onSurfaceMuted}
                testID="speaker-input-company"
              />

              <Text style={styles.label}>Image URL</Text>
              <TextInput
                value={draft.imageUrl}
                onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, imageUrl: value } : prev))}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://..."
                placeholderTextColor={colors.onSurfaceMuted}
                testID="speaker-input-image-url"
              />

              <Pressable style={styles.uploadBtn} onPress={pickImage} testID="speaker-upload-image">
                <Ionicons name="cloud-upload-outline" size={14} color={colors.brand} />
                <Text style={styles.uploadBtnText}>Upload image (or paste URL)</Text>
              </Pressable>

              <Text style={styles.label}>Biography (200-500 words)</Text>
              <TextInput
                value={draft.bioText}
                onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, bioText: value } : prev))}
                style={[styles.input, styles.bioInput]}
                multiline
                textAlignVertical="top"
                placeholder="Write biography..."
                placeholderTextColor={colors.onSurfaceMuted}
                testID="speaker-input-bio"
              />
              <Text style={[styles.counter, wordCountValid ? styles.counterGood : styles.counterBad]}>
                {draftWordCount} words {wordCountValid ? "(within limit)" : "(must be 200-500)"}
              </Text>

              <View style={styles.formActions}>
                <Pressable
                  onPress={() => {
                    setDraft(speaker);
                    setEditing(false);
                  }}
                  style={[styles.actionBtn, styles.cancelBtn]}
                  testID="speaker-cancel"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={saving || !wordCountValid}
                  style={[styles.actionBtn, styles.saveBtn, (saving || !wordCountValid) && { opacity: 0.5 }]}
                  testID="speaker-save"
                >
                  <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Pressable style={styles.backBtn} onPress={goBackToSchedule} testID="speaker-back-to-schedule">
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={styles.backBtnText}>Back to Schedule</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  topRight: { minWidth: 66, alignItems: "flex-end" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  content: { padding: spacing.lg, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: spacing.sm,
    backgroundColor: "#DADDE3",
  },
  name: { fontSize: 22, fontWeight: "800", color: colors.onSurface, fontFamily: "Georgia", textAlign: "center" },
  company: { marginTop: 4, fontSize: 13, color: colors.onSurfaceMuted, textAlign: "center" },
  wordMeta: { marginTop: spacing.sm, fontSize: 11, color: colors.onSurfaceMuted },
  bioText: {
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 24,
    color: colors.onSurface,
    textAlign: "left",
    alignSelf: "stretch",
  },

  formWrap: { marginTop: spacing.md, alignSelf: "stretch" },
  label: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted, marginTop: spacing.sm, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontSize: 14,
  },
  bioInput: { minHeight: 180 },
  uploadBtn: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8ECF2",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  uploadBtnText: { fontSize: 12, fontWeight: "700", color: colors.brand },
  counter: { marginTop: 6, fontSize: 12, fontWeight: "700" },
  counterGood: { color: colors.success },
  counterBad: { color: colors.error },
  formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.onSurface, fontWeight: "700" },
  saveBtn: { backgroundColor: colors.brand },
  saveBtnText: { color: "#fff", fontWeight: "700" },

  backBtn: {
    marginTop: spacing.lg,
    alignSelf: "stretch",
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  backBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
});
