import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SessionItem, SessionSpeakerBio } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { ScreenBg } from "@/src/components/ScreenBg";

function countWords(value: string): number {
  return (value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function createEmptyBio(): SessionSpeakerBio {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    paperTitle: "",
    name: "",
    title: "",
    company: "",
    bioText: "",
    imageUrl: "",
  };
}

export default function SessionSpeakerBiosScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const isAdmin = !!auth.username;

  const [session, setSession] = useState<SessionItem | null>(null);
  const [bios, setBios] = useState<SessionSpeakerBio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await api.getSession(sessionId);
      setSession(data);
      setBios((data.speakerBios || []).map((bio) => ({ ...bio })));
    } catch {
      setSession(null);
      setBios([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const validation = useMemo(() => {
    return bios.map((bio) => {
      const words = countWords(bio.bioText);
      const validWords = words <= 500;
      const validRequired = !!bio.paperTitle.trim() && !!bio.name.trim() && !!bio.title.trim() && !!bio.company.trim() && !!bio.imageUrl.trim();
      return { words, validWords, validRequired, valid: validWords && validRequired };
    });
  }, [bios]);

  const allValid = validation.length > 0 && validation.every((v) => v.valid);

  const updateBio = (index: number, patch: Partial<SessionSpeakerBio>) => {
    // Keep edit operations immutable so each card updates reliably.
    setBios((prev) => prev.map((bio, i) => (i === index ? { ...bio, ...patch } : bio)));
  };

  const addBio = () => {
    setBios((prev) => [...prev, createEmptyBio()]);
  };

  const removeBio = (index: number) => {
    setBios((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!sessionId || !session) return;
    if (!allValid) {
      Alert.alert("Validation", "Each bio needs all fields and 0-500 words.");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateSession(sessionId, { speakerBios: bios });
      setSession(updated);
      setBios((updated.speakerBios || []).map((bio) => ({ ...bio })));
      setEditing(false);
    } catch {
      Alert.alert("Save failed", "Could not save speaker bios. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const backToSchedule = () => {
    if (router.canGoBack()) {
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

  if (!session) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ScreenBg />
        <Ionicons name="alert-circle-outline" size={44} color={colors.onSurfaceMuted} />
        <Text style={styles.emptyText}>Session not found</Text>
        <Pressable style={styles.backBtn} onPress={backToSchedule}>
          <Text style={styles.backBtnText}>Back to Schedule</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="speaker-bios-screen">
      <ScreenBg />
      <View style={styles.topBar}>
        <Pressable onPress={backToSchedule} hitSlop={10} testID="speaker-bios-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Speaker Bio's</Text>
        {isAdmin && !editing ? (
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)} testID="speaker-bios-edit">
            <Ionicons name="create-outline" size={14} color="#fff" />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={{ width: 62 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.sessionCard, shadow.card]}>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          <Text style={styles.sessionMeta}>{session.day_label} · {session.time} · {session.location}</Text>
        </View>

        {bios.length === 0 ? (
          <View style={[styles.bioCard, shadow.card]}>
            <Text style={styles.emptyText}>No bios yet for this session.</Text>
          </View>
        ) : null}

        {bios.map((bio, index) => {
          const check = validation[index];
          return (
            <View key={bio.id || `${index}`} style={[styles.bioCard, shadow.card]}>
              {!editing ? (
                <>
                  <Image source={{ uri: bio.imageUrl }} style={styles.avatar} contentFit="cover" />
                  <Text style={styles.paperTitle}>{bio.paperTitle}</Text>
                  <Text style={styles.speakerName}>{bio.title} {bio.name}</Text>
                  <Text style={styles.company}>{bio.company}</Text>
                  <Text style={styles.wordMeta}>{check?.words || 0} words</Text>
                  <Text style={styles.bioText}>{bio.bioText}</Text>
                </>
              ) : (
                <>
                  <View style={styles.editHeader}>
                    <Text style={styles.editHeaderTitle}>Bio #{index + 1}</Text>
                    <Pressable onPress={() => removeBio(index)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  </View>

                  <Text style={styles.label}>Paper Title</Text>
                  <TextInput
                    style={styles.input}
                    value={bio.paperTitle}
                    onChangeText={(value) => updateBio(index, { paperTitle: value })}
                    placeholder="e.g. Paper 12: Digital Avionics..."
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`bio-paper-title-${index}`}
                  />

                  <Text style={styles.label}>Speaker Title</Text>
                  <TextInput
                    style={styles.input}
                    value={bio.title}
                    onChangeText={(value) => updateBio(index, { title: value })}
                    placeholder="e.g. Dr."
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`bio-title-${index}`}
                  />

                  <Text style={styles.label}>Speaker Name</Text>
                  <TextInput
                    style={styles.input}
                    value={bio.name}
                    onChangeText={(value) => updateBio(index, { name: value })}
                    placeholder="Speaker name"
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`bio-name-${index}`}
                  />

                  <Text style={styles.label}>Company / Organization</Text>
                  <TextInput
                    style={styles.input}
                    value={bio.company}
                    onChangeText={(value) => updateBio(index, { company: value })}
                    placeholder="Organization"
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`bio-company-${index}`}
                  />

                  <Text style={styles.label}>Image URL</Text>
                  <TextInput
                    style={styles.input}
                    value={bio.imageUrl}
                    onChangeText={(value) => updateBio(index, { imageUrl: value })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="https://..."
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`bio-image-${index}`}
                  />

                  <Text style={styles.label}>Biography (0-500 words)</Text>
                  <TextInput
                    style={[styles.input, styles.bioInput]}
                    value={bio.bioText}
                    onChangeText={(value) => updateBio(index, { bioText: value })}
                    multiline
                    textAlignVertical="top"
                    placeholder="Biography"
                    placeholderTextColor={colors.onSurfaceMuted}
                    testID={`bio-text-${index}`}
                  />
                  <Text style={[styles.counter, check?.valid ? styles.counterGood : styles.counterBad]}>
                    {check?.words || 0} words {(check?.validWords ? "(within limit)" : "(must be 0-500)")}
                  </Text>
                </>
              )}
            </View>
          );
        })}

        {isAdmin && editing ? (
          <>
            <Pressable style={styles.addBtn} onPress={addBio} testID="speaker-bios-add">
              <Ionicons name="add-circle-outline" size={16} color={colors.brand} />
              <Text style={styles.addBtnText}>Add another speaker bio</Text>
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setBios((session.speakerBios || []).map((bio) => ({ ...bio })));
                  setEditing(false);
                }}
                testID="speaker-bios-cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.saveBtn, (!allValid || saving) && { opacity: 0.5 }]}
                onPress={save}
                disabled={!allValid || saving}
                testID="speaker-bios-save"
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Bios"}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Pressable style={styles.backBtn} onPress={backToSchedule} testID="speaker-bios-back-to-schedule">
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={styles.backBtnText}>Back to Schedule</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  sessionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sessionTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  sessionMeta: { marginTop: 4, fontSize: 12, color: colors.onSurfaceMuted },

  bioCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignSelf: "center",
    backgroundColor: "#D5DAE2",
    marginBottom: spacing.sm,
  },
  paperTitle: { fontSize: 15, fontWeight: "800", color: colors.brand, textAlign: "center" },
  speakerName: { marginTop: 4, fontSize: 17, fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  company: { marginTop: 2, fontSize: 13, color: colors.onSurfaceMuted, textAlign: "center" },
  wordMeta: { marginTop: 6, fontSize: 11, color: colors.onSurfaceMuted, textAlign: "center" },
  bioText: { marginTop: spacing.sm, fontSize: 14, lineHeight: 22, color: colors.onSurface },

  editHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editHeaderTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  label: { marginTop: spacing.sm, marginBottom: 6, fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  bioInput: { minHeight: 150 },
  counter: { marginTop: 6, fontSize: 12, fontWeight: "700" },
  counterGood: { color: colors.success },
  counterBad: { color: colors.error },

  addBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "stretch",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    minHeight: 44,
  },
  addBtnText: { color: colors.brand, fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    minHeight: 44,
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
    marginBottom: spacing.sm,
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
  emptyText: { color: colors.onSurfaceMuted, textAlign: "center" },
});
