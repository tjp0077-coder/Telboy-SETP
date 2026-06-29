import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, SessionItem } from "@/src/api";
import { enqueueQuestionSubmission, flushQueuedQuestionSubmissions, isRetryableQuestionError } from "@/src/questionQueue";
import { colors, spacing, radius } from "@/src/theme";
import { ScreenBg, onSunset } from "@/src/components/ScreenBg";

type RelatedTalk = Pick<SessionItem, "id" | "title" | "day_label" | "time" | "location">;

export default function AskSpeakerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ event_id?: string | string[]; event_title?: string | string[] }>();

  const eventIdParam = Array.isArray(params.event_id) ? params.event_id[0] : params.event_id;
  const eventTitleParam = Array.isArray(params.event_title) ? params.event_title[0] : params.event_title;

  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [selectedTalk, setSelectedTalk] = useState<RelatedTalk | null>(null);
  const [talks, setTalks] = useState<SessionItem[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingTalks, setLoadingTalks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appliedTalkParamRef = useRef<string | null>(null);

  const loadTalks = useCallback(async () => {
    try {
      const data = await api.listSchedule();
      setTalks(data);
    } finally {
      setLoadingTalks(false);
    }
  }, []);

  useEffect(() => {
    loadTalks();
    flushQueuedQuestionSubmissions().catch(() => {});
  }, [loadTalks]);

  useEffect(() => {
    if (!eventIdParam || talks.length === 0) return;
    if (appliedTalkParamRef.current === eventIdParam) return;
    const match = talks.find((talk) => talk.id === eventIdParam);
    if (match) {
      setSelectedTalk({
        id: match.id,
        title: match.title,
        day_label: match.day_label,
        time: match.time,
        location: match.location,
      });
      appliedTalkParamRef.current = eventIdParam;
      return;
    }
    if (eventTitleParam) {
      setSelectedTalk({
        id: eventIdParam,
        title: eventTitleParam,
        day_label: "",
        time: "",
        location: "",
      });
      appliedTalkParamRef.current = eventIdParam;
    }
  }, [eventIdParam, eventTitleParam, talks]);

  const groupedTalks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? talks.filter(
          (talk) =>
            talk.title.toLowerCase().includes(q) ||
            talk.location.toLowerCase().includes(q) ||
            talk.day_label.toLowerCase().includes(q),
        )
      : talks;
    const map = new Map<string, { date: string; day_label: string; items: SessionItem[] }>();
    filtered.forEach((talk) => {
      const group = map.get(talk.date);
      if (group) group.items.push(talk);
      else map.set(talk.date, { date: talk.date, day_label: talk.day_label, items: [talk] });
    });
    return Array.from(map.values());
  }, [search, talks]);

  const openTalkPicker = () => setPickerOpen(true);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedQuestion = question.trim();
    if (!trimmedName || !trimmedQuestion) {
      setError("Your name and question are required.");
      return;
    }

    const payload = {
      name: trimmedName,
      question: trimmedQuestion,
      event_id: selectedTalk?.id || null,
    };

    setError(null);
    setSubmitting(true);
    try {
      await api.submitQuestion(payload);
      setQueued(false);
      setDone(true);
    } catch (submitError) {
      if (isRetryableQuestionError(submitError)) {
        await enqueueQuestionSubmission({
          name: trimmedName,
          question: trimmedQuestion,
          event_id: selectedTalk?.id || null,
          event_title: selectedTalk?.title || null,
        });
        setQueued(true);
        setDone(true);
        return;
      }
      setError("We couldn't send that just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const backLabel = queued ? "Saved offline" : "Question sent";
  const submitTarget = selectedTalk?.title || "the speaker";

  if (done) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.xl, paddingTop: insets.top + spacing.xl }]}>
        <ScreenBg />
        <View style={styles.successBadge}>
          <Ionicons name={queued ? "cloud-upload" : "checkmark"} size={36} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>{backLabel}</Text>
        <Text style={styles.successText}>
          {queued
            ? `Your question for ${submitTarget} is saved locally and will be sent when you're back online.`
            : `Thanks, we’ll pass your question to ${submitTarget}.`}
        </Text>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/messages")}
          style={[styles.btn, styles.btnPrimary, { marginTop: spacing.xl, width: 220 }]}
          testID="questions-done-back"
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
      <ScreenBg />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/messages")}
          hitSlop={10}
          testID="questions-close"
        >
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Ask the speaker</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="mic-outline" size={22} color={colors.brand} />
          </View>
          <Text style={styles.introTitle}>Send a question to the speaker</Text>
          <Text style={styles.introText}>
            Questions are one-way for delegates. If you choose a technical talk, the chair team will file it against that session.
          </Text>
        </View>

        {selectedTalk ? (
          <View style={styles.selectedTalk} testID="selected-talk">
            <View style={styles.talkIcon}>
              <Ionicons name="calendar" size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedTalkTitle} numberOfLines={1}>
                {selectedTalk.title}
              </Text>
              <Text style={styles.selectedTalkMeta} numberOfLines={1}>
                {selectedTalk.day_label ? `${selectedTalk.day_label} · ` : ""}
                {selectedTalk.time ? `${selectedTalk.time} · ` : ""}
                {selectedTalk.location || "Session selected"}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedTalk(null)}
              hitSlop={10}
              style={styles.clearBtn}
              testID="clear-talk"
            >
              <Ionicons name="close" size={18} color={colors.onSurfaceMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={openTalkPicker} style={styles.pickerBtn} testID="open-talk-picker">
            <Ionicons name="link-outline" size={18} color={colors.brand} />
            <Text style={styles.pickerBtnText}>Attach a talk</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} style={{ marginLeft: "auto" }} />
          </Pressable>
        )}

        <Text style={styles.label}>Your name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jane Doe"
          placeholderTextColor={colors.onSurfaceMuted}
          value={name}
          onChangeText={setName}
          testID="questions-name"
        />

        <Text style={styles.label}>Your question *</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Type your question for the speaker…"
          placeholderTextColor={colors.onSurfaceMuted}
          value={question}
          onChangeText={setQuestion}
          multiline
          testID="questions-question"
        />

        {error ? <Text style={styles.error} testID="questions-error">{error}</Text> : null}

        <Text style={styles.footerNote}>
          If you lose connection, we’ll keep the question on this device and send it later.
        </Text>

        <Pressable
          onPress={submit}
          disabled={submitting}
          style={[styles.btn, styles.btnPrimary, submitting && { opacity: 0.5 }, { marginTop: spacing.lg }]}
          testID="questions-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={[styles.btnPrimaryText, { marginLeft: 8 }]}>Send question</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

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
              <Text style={styles.modalTitle}>Attach a talk</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} testID="close-talk-picker">
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.onSurfaceMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search sessions, venues, days…"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={search}
                onChangeText={setSearch}
                testID="talk-search"
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#fff" />
                </Pressable>
              ) : null}
            </View>

            {loadingTalks ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={groupedTalks}
                keyExtractor={(g) => g.date}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: spacing.lg }}
                renderItem={({ item: group }) => (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={styles.dayHeader}>{group.day_label}</Text>
                    {group.items.map((talk) => (
                      <Pressable
                        key={talk.id}
                        onPress={() => {
                          setSelectedTalk({
                            id: talk.id,
                            title: talk.title,
                            day_label: talk.day_label,
                            time: talk.time,
                            location: talk.location,
                          });
                          setPickerOpen(false);
                          setSearch("");
                        }}
                        style={styles.talkRow}
                        testID={`pick-talk-${talk.id}`}
                      >
                        <Text style={styles.talkRowTime}>{talk.time}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.talkRowTitle} numberOfLines={1}>{talk.title}</Text>
                          <Text style={styles.talkRowLoc} numberOfLines={1}>{talk.location}</Text>
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
            )}
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
  introText: { fontSize: 13, color: "#fff", marginTop: spacing.xs, lineHeight: 18 },

  selectedTalk: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  talkIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: "#FBF1E5",
    alignItems: "center", justifyContent: "center",
  },
  selectedTalkTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  selectedTalkMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  clearBtn: { padding: 4 },

  pickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  pickerBtnText: { color: colors.onSurface, fontWeight: "700" },

  label: { fontSize: 12, fontWeight: "700", color: "#fff", marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15,
  },
  inputMulti: { minHeight: 120, textAlignVertical: "top" },
  footerNote: { fontSize: 12, color: "#fff", marginTop: spacing.md, lineHeight: 18 },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.md },

  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: radius.md },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },

  successBadge: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: "#EAF5EE",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  successTitle: { fontSize: 24, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", textAlign: "center" },
  successText: { fontSize: 13, color: colors.onSurfaceMuted, textAlign: "center", marginTop: spacing.sm, lineHeight: 19 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 22, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, marginTop: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.onSurface },
  dayHeader: { fontSize: 12, fontWeight: "800", color: colors.brandTertiary, letterSpacing: 0.8, marginBottom: spacing.xs },
  talkRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  talkRowTime: { width: 54, fontSize: 14, fontWeight: "700", color: colors.brand, fontFamily: "Georgia" },
  talkRowTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  talkRowLoc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
});
