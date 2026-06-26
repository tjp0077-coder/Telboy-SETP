import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, SessionItem } from "@/src/api";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SessionItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // schedule for picker
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listSchedule().then(setSessions).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.location.toLowerCase().includes(q) ||
            s.day_label.toLowerCase().includes(q),
        )
      : sessions;
    const map = new Map<string, { date: string; day_label: string; items: SessionItem[] }>();
    filtered.forEach((s) => {
      const g = map.get(s.date);
      if (g) g.items.push(s);
      else map.set(s.date, { date: s.date, day_label: s.day_label, items: [s] });
    });
    return Array.from(map.values());
  }, [sessions, search]);

  const handleSubmit = async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) {
      setError("Name, subject and message are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.submitContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        event_id: selectedEvent?.id || null,
      });
      setDone(true);
    } catch {
      setError("Sorry — we couldn't send that. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.xl, paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.successBadge}>
          <Ionicons name="checkmark" size={36} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Message sent</Text>
        <Text style={styles.successText}>
          Thanks {name.split(" ")[0] || "delegate"} — a committee member will get back to you.
        </Text>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
          style={[styles.btn, styles.btnPrimary, { marginTop: spacing.xl, width: 200 }]}
          testID="contact-done-back"
        >
          <Text style={styles.btnPrimaryText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}
          hitSlop={10}
          testID="contact-close"
        >
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Contact the committee</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="mail" size={22} color={colors.brand} />
          </View>
          <Text style={styles.introTitle}>Get in touch with the committee</Text>
          <Text style={styles.introText}>
            Use this form to ask a question or report an issue. The committee will receive your message.
          </Text>
        </View>

        <Text style={styles.label}>Your name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jane Doe"
          placeholderTextColor={colors.onSurfaceMuted}
          value={name}
          onChangeText={setName}
          testID="contact-name"
        />

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="jane@example.com"
          placeholderTextColor={colors.onSurfaceMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="contact-email"
        />

        <Text style={styles.label}>Subject *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dietary requirement for banquet"
          placeholderTextColor={colors.onSurfaceMuted}
          value={subject}
          onChangeText={setSubject}
          testID="contact-subject"
        />

        <Text style={styles.label}>Related session (optional)</Text>
        {selectedEvent ? (
          <View style={styles.selectedSession} testID="selected-session">
            <View style={styles.sessionIcon}>
              <Ionicons name="calendar" size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedSessionTitle} numberOfLines={1}>
                {selectedEvent.title}
              </Text>
              <Text style={styles.selectedSessionMeta} numberOfLines={1}>
                {selectedEvent.day_label} · {selectedEvent.time}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedEvent(null)}
              hitSlop={10}
              style={styles.clearBtn}
              testID="clear-session"
            >
              <Ionicons name="close" size={18} color={colors.onSurfaceMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={styles.pickerBtn}
            testID="open-session-picker"
          >
            <Ionicons name="link-outline" size={18} color={colors.brand} />
            <Text style={styles.pickerBtnText}>Attach a session</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
          </Pressable>
        )}

        <Text style={styles.label}>Message *</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Type your message here…"
          placeholderTextColor={colors.onSurfaceMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          testID="contact-message"
        />

        {error ? <Text style={styles.error} testID="contact-error">{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.btn, styles.btnPrimary, submitting && { opacity: 0.5 }, { marginTop: spacing.lg }]}
          testID="contact-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={[styles.btnPrimaryText, { marginLeft: 8 }]}>Send to the committee</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Session picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md, height: "85%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach a session</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} testID="close-picker">
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.onSurfaceMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search sessions, venues, days…"
                placeholderTextColor={colors.onSurfaceMuted}
                value={search}
                onChangeText={setSearch}
                testID="session-search"
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.onSurfaceMuted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={grouped}
              keyExtractor={(g) => g.date}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              renderItem={({ item: group }) => (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.dayHeader}>{group.day_label}</Text>
                  {group.items.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        setSelectedEvent(s);
                        setPickerOpen(false);
                        setSearch("");
                      }}
                      style={styles.sessionRow}
                      testID={`pick-session-${s.id}`}
                    >
                      <Text style={styles.sessionRowTime}>{s.time}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionRowTitle} numberOfLines={1}>{s.title}</Text>
                        <Text style={styles.sessionRowLoc} numberOfLines={1}>{s.location}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} />
                    </Pressable>
                  ))}
                </View>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing.xl, alignItems: "center" }}>
                  <Text style={{ color: colors.onSurfaceMuted }}>No sessions match "{search}"</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface,
  },
  topTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },

  intro: { marginBottom: spacing.lg },
  introIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  introTitle: { fontSize: 22, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", lineHeight: 28 },
  introText: { fontSize: 13, color: colors.onSurfaceMuted, marginTop: spacing.xs, lineHeight: 18 },

  label: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15,
  },
  inputMulti: { minHeight: 140, textAlignVertical: "top" },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.md, textAlign: "center" },

  btn: { flexDirection: "row", height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  pickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md,
    height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderStyle: "dashed", backgroundColor: colors.surfaceSecondary,
  },
  pickerBtnText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  selectedSession: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border,
  },
  sessionIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center",
  },
  selectedSessionTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  selectedSessionMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  clearBtn: { padding: 4 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14 },

  dayHeader: {
    fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.onSurfaceMuted,
    paddingVertical: spacing.sm,
  },
  sessionRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sessionRowTime: { width: 50, fontSize: 14, fontWeight: "700", color: colors.brand, fontFamily: "Georgia" },
  sessionRowTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  sessionRowLoc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },

  successBadge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#E6F2EC",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  successTitle: { fontSize: 26, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  successText: { fontSize: 14, color: colors.onSurfaceMuted, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
});
