import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please enter username and password");
      return;
    }
    setError(null);
    setLoading(true);
    const r = await login(username.trim(), password);
    setLoading(false);
    if (r.ok) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/profile");
    } else {
      setError(r.error || "Login failed");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")} hitSlop={10} testID="login-close">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Image
          source={require("@/assets/images/brand/badge.png")}
          style={styles.badgeImage}
          contentFit="contain"
        />
        <Text style={styles.title}>Admin Sign-In</Text>
        <Text style={styles.sub}>
          Only authorised symposium staff. Three admins are configured.
        </Text>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. dave.mackay"
            placeholderTextColor={colors.onSurfaceMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            testID="login-username"
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.pwRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={colors.onSurfaceMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              testID="login-password"
            />
            <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.onSurfaceMuted} />
            </Pressable>
          </View>

          {error ? (
            <Text style={styles.error} testID="login-error">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.btn, loading && { opacity: 0.6 }]}
            testID="login-submit"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Forgot credentials? Contact the symposium chairman.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", justifyContent: "flex-end" },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  badge: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  badgeImage: {
    width: 120, height: 120, alignSelf: "center", marginBottom: spacing.md,
  },
  title: {
    fontSize: 26, fontWeight: "700", color: colors.onSurface,
    textAlign: "center", fontFamily: "Georgia",
  },
  sub: {
    fontSize: 13, color: colors.onSurfaceMuted, textAlign: "center",
    marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg,
  },
  label: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted, marginBottom: 6, letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15,
  },
  pwRow: { flexDirection: "row", alignItems: "center", position: "relative" },
  eyeBtn: { position: "absolute", right: 12, padding: 4 },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  btn: {
    backgroundColor: colors.brand, height: 50, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", marginTop: spacing.lg,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint: { fontSize: 11, color: colors.onSurfaceMuted, textAlign: "center", marginTop: spacing.xl },
});
