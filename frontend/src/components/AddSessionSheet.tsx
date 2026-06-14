import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, SessionItem } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (item: SessionItem) => void;
  defaultDate?: string;       // YYYY-MM-DD
  defaultDayLabel?: string;   // "Mon 27 July"
};

const CATEGORY_LABEL: Record<string, string> = {
  session: "Technical", break: "Break", meal: "Meal", social: "Social", tour: "Tour",
};
const CATEGORY_COLOR: Record<string, string> = {
  session: "#1A2841", break: "#D4A373", meal: "#D4A373", social: "#AD4C3B", tour: "#2D6A4F",
};
const CATEGORIES = ["session", "break", "meal", "social", "tour"];

const SYMPOSIUM_DAYS = [
  { date: "2026-07-26", label: "Sun 26 July" },
  { date: "2026-07-27", label: "Mon 27 July" },
  { date: "2026-07-28", label: "Tue 28 July" },
  { date: "2026-07-29", label: "Wed 29 July" },
  { date: "2026-07-30", label: "Thu 30 July" },
];

export default function AddSessionSheet({ visible, onClose, onCreated, defaultDate, defaultDayLabel }: Props) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(defaultDate || "2026-07-27");
  const [dayLabel, setDayLabel] = useState(defaultDayLabel || "Mon 27 July");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("session");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(""); setTime(""); setEndTime(""); setLocation("");
    setDescription(""); setCategory("session"); setError(null);
  };

  const submit = async () => {
    if (!title.trim() || !time.trim() || !location.trim()) {
      setError("Title, start time and location are required.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time.trim())) {
      setError("Start time must be in HH:MM format (e.g. 08:30).");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await api.createSession({
        date, day_label: dayLabel,
        time: time.trim(),
        end_time: endTime.trim() || null,
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        category,
      });
      onCreated(created);
      reset();
      onClose();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, maxHeight: "92%" }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add new session</Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SYMPOSIUM_DAYS.map((d) => {
                const sel = d.date === date;
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => { setDate(d.date); setDayLabel(d.label); }}
                    style={[styles.dayChip, sel && styles.dayChipActive]}
                    testID={`add-day-${d.date}`}
                  >
                    <Text style={[styles.dayChipText, sel && styles.dayChipTextActive]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Technical Session 6" placeholderTextColor={colors.onSurfaceMuted}
              testID="add-title" />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start *</Text>
                <TextInput style={styles.input} value={time} onChangeText={setTime}
                  placeholder="HH:MM" placeholderTextColor={colors.onSurfaceMuted} testID="add-time" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End</Text>
                <TextInput style={styles.input} value={endTime} onChangeText={setEndTime}
                  placeholder="(optional)" placeholderTextColor={colors.onSurfaceMuted} testID="add-end" />
              </View>
            </View>

            <Text style={styles.label}>Location *</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation}
              placeholder="e.g. Ps&Gs" placeholderTextColor={colors.onSurfaceMuted} testID="add-location" />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.inputMulti]} value={description} onChangeText={setDescription}
              placeholder="(optional)" placeholderTextColor={colors.onSurfaceMuted} multiline testID="add-desc" />

            <Text style={styles.label}>Category</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => {
                const sel = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.catChip, sel && { backgroundColor: CATEGORY_COLOR[c], borderColor: CATEGORY_COLOR[c] }]}
                    testID={`add-cat-${c}`}
                  >
                    <Text style={[styles.catChipText, sel && { color: "#fff" }]}>{CATEGORY_LABEL[c]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={() => { reset(); onClose(); }} style={[styles.btn, styles.btnGhost]} testID="add-cancel">
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={saving}
              style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.5 }]}
              testID="add-save"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Add session</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", marginBottom: spacing.md, textAlign: "center" },
  label: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15,
  },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: spacing.md },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: "#1A2841", borderColor: "#1A2841" },
  dayChipText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  dayChipTextActive: { color: "#F2C265" },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  catChipText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.md, textAlign: "center" },

  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.onSurface, fontWeight: "600" },
  btnPrimary: { backgroundColor: "#1A2841" },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
