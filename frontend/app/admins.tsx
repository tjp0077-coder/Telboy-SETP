import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, AdminInfo } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import AdminFooterNav from "@/src/components/AdminFooterNav";
import WhatsAppGroupButton from "@/src/components/WhatsAppGroupButton";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

export default function AdminsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const canManageAdmins = ["terry parker", "dave mackay"].includes((auth.name || "").trim().toLowerCase());
  const [items, setItems] = useState<AdminInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [composeOpen, setComposeOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createdInfo, setCreatedInfo] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listAdmins();
      setItems(data);
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!auth.username && !auth.loading) {
      router.replace("/login");
      return;
    }
    if (auth.username) load();
  }, [auth.username, auth.loading, load, router]);

  const submit = async () => {
    if (!canManageAdmins) {
      setError("Only Terry Parker and Dave Mackay can add committee members.");
      return;
    }
    setError(null);
    const u = username.trim().toLowerCase();
    const n = name.trim();
    if (!n || !u || !password) { setError("All fields are required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (u.includes(" ")) { setError("Username cannot contain spaces."); return; }

    setSaving(true);
    try {
      await api.createAdmin({ name: n, username: u, password });
      setCreatedInfo({ username: u, password });
      setName(""); setUsername(""); setPassword(""); setShowPw(false);
      setComposeOpen(false);
      load();
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("409") || msg.includes("already")) setError("That username is taken.");
      else setError("Couldn't create the account. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: AdminInfo) => {
    if (!canManageAdmins) {
      return;
    }
    if (u.username === auth.username) return;
    try {
      await api.deleteAdmin(u.username);
      setItems((prev) => prev.filter((x) => x.username !== u.username));
    } catch {}
  };

  if (auth.loading) {
    return <View style={[styles.screen, styles.center]}><ScreenBg /><ActivityIndicator size="large" color={onSunset.primary} /></View>;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="admins-screen">
      <ScreenBg />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
          hitSlop={10}
          testID="admins-back"
        >
          <Ionicons name="chevron-back" size={26} color={onSunset.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Manage Committee</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.helpText}>
        Anyone listed here can sign in and post live messages. Only Terry Parker and Dave Mackay can add or remove committee members.
      </Text>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <WhatsAppGroupButton
          variant="card"
          showBadge
          testID="admin-whatsapp-card"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={onSunset.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.username}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 220 }}
          renderItem={({ item }) => {
            const isSelf = item.username === auth.username;
            return (
              <View style={[styles.card, shadow.card]} testID={`admin-${item.username}`}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.name || item.username).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    {isSelf ? (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardUser}>@{item.username}</Text>
                </View>
                {canManageAdmins && !isSelf ? (
                  <Pressable
                    onPress={() => remove(item)}
                    hitSlop={8}
                    style={styles.delBtn}
                    testID={`admin-delete-${item.username}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {canManageAdmins ? (
        <Pressable
          onPress={() => setComposeOpen(true)}
          style={[styles.fab, { bottom: insets.bottom + 88 }]}
          testID="admin-add-fab"
        >
          <Ionicons name="person-add" size={20} color="#1A2841" />
          <Text style={styles.fabText}>Add committee member</Text>
        </Pressable>
      ) : (
        <View style={[styles.readOnlyCard, shadow.card]} testID="admin-read-only-note">
          <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceMuted} />
          <Text style={styles.readOnlyText}>Read-only access</Text>
        </View>
      )}

      <AdminFooterNav />

      <WhatsAppGroupButton
        variant="fab"
        showBadge
        style={{ bottom: insets.bottom + 22 }}
        testID="admin-whatsapp-fab"
      />

      {/* Compose modal */}
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
            <Text style={styles.modalTitle}>Add committee member</Text>
            <Text style={styles.modalSub}>
              They'll be able to sign in and post live messages.
            </Text>

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex MacLeod"
              placeholderTextColor={colors.onSurfaceMuted}
              value={name}
              onChangeText={setName}
              testID="admin-name"
            />
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. alex.macleod"
              placeholderTextColor={colors.onSurfaceMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              testID="admin-username"
            />
            <Text style={styles.label}>Password (min 8 chars)</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.onSurfaceMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                testID="admin-password"
              />
              <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={18} color={colors.onSurfaceMuted} />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => { setComposeOpen(false); setError(null); }}
                style={[styles.btn, styles.btnGhost]}
                testID="admin-cancel"
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={saving}
                style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.5 }]}
                testID="admin-save"
              >
                <Text style={styles.btnPrimaryText}>{saving ? "Saving…" : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Created confirmation */}
      <Modal visible={!!createdInfo} animationType="fade" transparent onRequestClose={() => setCreatedInfo(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.xl }]}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark" size={28} color={colors.success} />
            </View>
            <Text style={styles.modalTitle}>Account created</Text>
            <Text style={styles.modalSub}>
              Share these credentials with the new committee member. Make sure they change the password after first sign-in (we'll add that in a future update).
            </Text>
            <View style={styles.credentialBox}>
              <Text style={styles.credLabel}>Username</Text>
              <Text style={styles.credValue}>{createdInfo?.username}</Text>
              <Text style={[styles.credLabel, { marginTop: spacing.md }]}>Password</Text>
              <Text style={styles.credValue}>{createdInfo?.password}</Text>
            </View>
            <Pressable
              onPress={() => setCreatedInfo(null)}
              style={[styles.btn, styles.btnPrimary, { marginTop: spacing.lg }]}
              testID="admin-created-close"
            >
              <Text style={styles.btnPrimaryText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topTitle: { fontSize: 20, fontWeight: "700", color: onSunset.primary, fontFamily: "Georgia" },
  helpText: { fontSize: 13, color: onSunset.secondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md, lineHeight: 18 },

  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#1A2841",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#F2C265", fontWeight: "800", fontSize: 18, fontFamily: "Georgia" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { fontSize: 15, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  cardUser: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  youBadge: { backgroundColor: "#FBF1E5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youBadgeText: { color: "#8B5A1B", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  delBtn: { padding: 6 },

  fab: {
    position: "absolute", left: spacing.lg, right: spacing.lg, height: 50,
    backgroundColor: "#F2C265", borderRadius: radius.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    ...shadow.raised,
  },
  fabText: { color: "#1A2841", fontWeight: "800", fontSize: 14 },
  readOnlyCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 24,
    height: 50,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  readOnlyText: { color: colors.onSurfaceMuted, fontWeight: "700", fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: 22, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", textAlign: "center" },
  modalSub: { fontSize: 13, color: colors.onSurfaceMuted, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 18, textAlign: "center" },

  label: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15,
  },
  pwRow: { flexDirection: "row", alignItems: "center", position: "relative" },
  eyeBtn: { position: "absolute", right: 12, padding: 4 },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.md, textAlign: "center" },

  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.onSurface, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },

  successBadge: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#E6F2EC",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  credentialBox: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  credLabel: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceMuted, letterSpacing: 0.8 },
  credValue: { fontSize: 16, fontWeight: "700", color: colors.brand, fontFamily: "Georgia", marginTop: 2 },
});
