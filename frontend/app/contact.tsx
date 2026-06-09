import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Thanks {name.split(" ")[0] || "delegate"} — one of the organisers will get back to you.
        </Text>
        <Pressable
          onPress={() => router.back()}
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
        <Text style={styles.topTitle}>Contact organisers</Text>
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
          <Text style={styles.introTitle}>Get in touch with the symposium team</Text>
          <Text style={styles.introText}>
            Use this form to ask a question or report an issue. The 3 admins will receive your message.
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
              <Text style={[styles.btnPrimaryText, { marginLeft: 8 }]}>Send to organisers</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
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

  successBadge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#E6F2EC",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  successTitle: { fontSize: 26, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia" },
  successText: { fontSize: 14, color: colors.onSurfaceMuted, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
});
