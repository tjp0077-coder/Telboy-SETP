import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, PrototypeIdea } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import AdminFooterNav from "@/src/components/AdminFooterNav";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

export default function PrototypesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const [items, setItems] = useState<PrototypeIdea[]>([]);
  const [loading, setLoading] = useState(true);

  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [proposedScreen, setProposedScreen] = useState("");
  const [mockLink, setMockLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listAdminPrototypeIdeas();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.username && !auth.loading) {
      router.replace("/login");
      return;
    }
    if (auth.username) load();
  }, [auth.username, auth.loading, load, router]);

  const createDraft = async () => {
    setError(null);
    if (!title.trim() || !summary.trim()) {
      setError("Title and summary are required.");
      return;
    }
    setSaving(true);
    try {
      await api.createPrototypeIdea({
        title: title.trim(),
        summary: summary.trim(),
        proposed_screen: proposedScreen.trim(),
        mock_link: mockLink.trim(),
      });
      setTitle("");
      setSummary("");
      setProposedScreen("");
      setMockLink("");
      setComposeOpen(false);
      await load();
    } catch {
      setError("Could not save the draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    try {
      await api.publishPrototypeIdea(id);
      await load();
    } catch {}
  };

  const remove = async (id: string) => {
    try {
      await api.deletePrototypeIdea(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {}
  };

  if (auth.loading) {
    return <View style={[styles.screen, styles.center]}><ScreenBg /><ActivityIndicator size="large" color={onSunset.primary} /></View>;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="prototype-lab-screen">
      <ScreenBg />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
          hitSlop={10}
          testID="prototype-lab-back"
        >
          <Ionicons name="chevron-back" size={26} color={onSunset.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Prototype Lab</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.helpText}>
        Create drafts for internal review, then publish approved ideas globally to the app.
      </Text>

      {loading ? (
        <ActivityIndicator color={onSunset.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
          ListEmptyComponent={
            <View style={[styles.emptyCard, shadow.card]}>
              <Ionicons name="flask-outline" size={30} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyTitle}>No ideas yet</Text>
              <Text style={styles.emptyText}>Create your first draft to share with the 6 admins.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPublished = item.status === "published";
            return (
              <View style={[styles.card, shadow.card]} testID={`prototype-${item.id}`}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.statusBadge, isPublished ? styles.statusPublished : styles.statusDraft]}>
                    <Text style={[styles.statusText, isPublished ? styles.statusTextPublished : styles.statusTextDraft]}>
                      {isPublished ? "PUBLISHED" : "DRAFT"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSummary}>{item.summary}</Text>
                {item.proposed_screen ? (
                  <Text style={styles.meta}>Target: {item.proposed_screen}</Text>
                ) : null}
                {item.mock_link ? (
                  <Text style={styles.meta} numberOfLines={1}>Mock: {item.mock_link}</Text>
                ) : null}
                <Text style={styles.meta}>By {item.created_by}</Text>

                <View style={styles.actions}>
                  {!isPublished ? (
                    <Pressable
                      onPress={() => publish(item.id)}
                      style={[styles.actionBtn, styles.publishBtn]}
                      testID={`prototype-publish-${item.id}`}
                    >
                      <Ionicons name="rocket" size={16} color="#1A2841" />
                      <Text style={styles.publishBtnText}>Publish globally</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => remove(item.id)}
                    style={[styles.actionBtn, styles.deleteBtn]}
                    testID={`prototype-delete-${item.id}`}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      <Pressable
        onPress={() => setComposeOpen(true)}
        style={[styles.fab, { bottom: insets.bottom + 88 }]}
        testID="prototype-add-fab"
      >
        <Ionicons name="add-circle" size={20} color="#1A2841" />
        <Text style={styles.fabText}>New draft</Text>
      </Pressable>

      <Modal
        visible={composeOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposeOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New prototype draft</Text>

            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={colors.onSurfaceMuted}
              value={title}
              onChangeText={setTitle}
              testID="prototype-title"
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Summary for admin review"
              placeholderTextColor={colors.onSurfaceMuted}
              value={summary}
              onChangeText={setSummary}
              multiline
              testID="prototype-summary"
            />
            <TextInput
              style={styles.input}
              placeholder="Target screen (optional)"
              placeholderTextColor={colors.onSurfaceMuted}
              value={proposedScreen}
              onChangeText={setProposedScreen}
              testID="prototype-target"
            />
            <TextInput
              style={styles.input}
              placeholder="Mock/prototype URL (optional)"
              placeholderTextColor={colors.onSurfaceMuted}
              value={mockLink}
              onChangeText={setMockLink}
              autoCapitalize="none"
              autoCorrect={false}
              testID="prototype-link"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => { setComposeOpen(false); setError(null); }}
                style={[styles.btn, styles.btnGhost]}
                testID="prototype-cancel"
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={createDraft}
                disabled={saving}
                style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.5 }]}
                testID="prototype-save"
              >
                <Text style={styles.btnPrimaryText}>{saving ? "Saving..." : "Save draft"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

      <AdminFooterNav />

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: onSunset.primary, fontFamily: "Georgia" },
  helpText: { fontSize: 13, color: onSunset.secondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md, lineHeight: 18 },

  emptyCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.lg, alignItems: "center", gap: spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  emptyText: { fontSize: 12, color: colors.onSurfaceMuted, textAlign: "center" },

  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  cardSummary: { color: colors.onSurface, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  meta: { color: colors.onSurfaceMuted, fontSize: 12, marginTop: 4 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statusDraft: { backgroundColor: "#E8ECF2" },
  statusPublished: { backgroundColor: "#E6F2EC" },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  statusTextDraft: { color: colors.info },
  statusTextPublished: { color: colors.success },

  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, height: 40, borderRadius: radius.md, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 6,
  },
  publishBtn: { backgroundColor: "#F2C265" },
  publishBtnText: { color: "#1A2841", fontWeight: "800" },
  deleteBtn: { backgroundColor: "#F8DEDA" },
  deleteBtnText: { color: colors.error, fontWeight: "700" },

  fab: {
    position: "absolute", left: spacing.lg, right: spacing.lg, height: 50,
    backgroundColor: "#F2C265", borderRadius: radius.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    ...shadow.raised,
  },
  fabText: { color: "#1A2841", fontWeight: "800", fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: 22, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", textAlign: "center", marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15, marginTop: spacing.sm,
  },
  inputMulti: { minHeight: 92, textAlignVertical: "top" },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },

  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.onSurface, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
