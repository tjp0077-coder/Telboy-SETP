import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DISMISS_KEY = "setp_pwa_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * A small, dismissible banner that prompts the user to install the SETP 2026 app
 * to their home screen. Web-only — renders nothing on iOS / Android native builds.
 *
 * Behaviour:
 *  - Listens for the `beforeinstallprompt` event (Chrome / Edge / Brave on Android+desktop).
 *  - When fired, shows a banner. Tapping "Install" triggers the native install dialog.
 *  - If dismissed, hides for 7 days.
 *  - On iOS Safari (which doesn't fire `beforeinstallprompt`) a one-time tooltip is
 *    shown instructing the user to tap Share → Add to Home Screen.
 */
export default function PwaInstallBanner() {
  const insets = useSafeAreaInsets();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Only attach listeners on web.
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let cancelled = false;

    const checkShouldShow = async () => {
      try {
        const dismissedAt = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_TTL_MS) {
          return false;
        }
      } catch {}
      // Hide if already installed (standalone mode).
      // @ts-ignore - browser-only
      const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      // @ts-ignore - Safari iOS quirk
      if (standalone || window.navigator.standalone === true) return false;
      return true;
    };

    const onBeforeInstallPrompt = (e: any) => {
      // Stash the event so it can be triggered later.
      e.preventDefault();
      checkShouldShow().then((ok) => {
        if (!cancelled && ok) {
          setDeferredPrompt(e);
          setVisible(true);
        }
      });
    };

    const onAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    // iOS Safari detection (no beforeinstallprompt support).
    const ua = window.navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    // @ts-ignore
    const isInStandalone = window.navigator.standalone === true;
    if (isIOS && !isInStandalone) {
      setIsIos(true);
      checkShouldShow().then((ok) => {
        if (!cancelled && ok) setVisible(true);
      });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const onInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {}
    setVisible(false);
    setDeferredPrompt(null);
  };

  const onDismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  if (!visible || Platform.OS !== "web") return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom || 12 }]}
      testID="pwa-install-banner"
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait" size={22} color="#F2C265" />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Install SETP 2026</Text>
          {isIos ? (
            <Text style={styles.desc}>
              {isIos ? "Tap Share, then \u201CAdd to Home Screen\u201D." : ""}
            </Text>
          ) : (
            <Text style={styles.desc}>
              Add to your Home Screen for a faster, offline-ready experience.
            </Text>
          )}
        </View>
        {!isIos ? (
          <Pressable
            onPress={onInstall}
            style={styles.installBtn}
            testID="pwa-install-btn"
          >
            <Text style={styles.installText}>Install</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onDismiss} hitSlop={12} style={styles.dismissBtn} testID="pwa-dismiss-btn">
          <Ionicons name="close" size={20} color="rgba(245,240,230,0.85)" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    zIndex: 9999,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(15, 26, 46, 0.96)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(242, 194, 101, 0.45)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(242,194,101,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  title: { color: "#F5F0E6", fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
  desc: { color: "rgba(245,240,230,0.78)", fontSize: 11, marginTop: 2, lineHeight: 15 },
  installBtn: {
    backgroundColor: "#F2C265",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  installText: { color: "#1A2841", fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
  dismissBtn: { padding: 4 },
});
