import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Injects PWA metadata into the document head and registers the service worker.
 * Runs once on mount; no-op on iOS / Android native builds.
 *
 * Needed because Expo Router SDK 54 with output: "single" does not pick up
 * the app/+html.tsx custom shell at build time. Doing this at runtime is
 * the most portable approach and works in dev, prod and Emergent Web Deploy.
 */
export function usePwaSetup() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const head = document.head;

    // Helper to set or replace a meta tag by name.
    const setMeta = (name: string, content: string) => {
      let tag = head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = name;
        head.appendChild(tag);
      }
      tag.content = content;
    };

    // Helper to set or replace a link tag by rel (+ optional sizes).
    const setLink = (
      rel: string,
      href: string,
      attrs: Record<string, string> = {}
    ) => {
      const selectorParts = [`link[rel="${rel}"]`];
      Object.entries(attrs).forEach(([k, v]) => selectorParts.push(`[${k}="${v}"]`));
      let tag = head.querySelector<HTMLLinkElement>(selectorParts.join(""));
      if (!tag) {
        tag = document.createElement("link");
        tag.rel = rel;
        Object.entries(attrs).forEach(([k, v]) => tag!.setAttribute(k, v));
        head.appendChild(tag);
      }
      tag.href = href;
    };

    // Title
    document.title = "EDI SETP 2026 — Symposium Hub";

    // Description
    setMeta(
      "description",
      "Official delegate companion app for the SETP European Symposium, Edinburgh — schedule, comms, city guide."
    );

    // PWA core
    setMeta("theme-color", "#1A2841");
    setLink("manifest", "/manifest.webmanifest");

    // Apple / Safari
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-title", "SETP 2026");
    setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    setLink("apple-touch-icon", "/icons/apple-touch-icon.png");

    // Replace default favicon with our brand icons (sized variants)
    setLink("icon", "/icons/icon-192.png", { sizes: "192x192", type: "image/png" });
    setLink("icon", "/icons/icon-512.png", { sizes: "512x512", type: "image/png" });

    // Viewport upgrade — add viewport-fit=cover for iOS notch handling
    const vp = head.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (vp) {
      vp.content =
        "width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover";
    }

    // ── iOS PWA scroll-reset fix ─────────────────────────────────────
    // iOS Safari restores document.scrollTop even on a position:fixed body,
    // which shifts the fixed root layer upward on back navigation. Fix:
    //   1. Disable scroll restoration so the browser never saves/restores it.
    //   2. Hard-reset all scroll anchors on every navigation event.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();

    window.addEventListener("pageshow", resetScroll);
    window.addEventListener("hashchange", resetScroll);

    // On visibility change (tab re-focus, app re-open), recalc safe-area vars.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        resetScroll();
        // iOS: re-query safe-area insets in case they changed.
        const root = document.documentElement;
        root.style.setProperty("--sat", `env(safe-area-inset-top, 0px)`);
        root.style.setProperty("--sar", `env(safe-area-inset-right, 0px)`);
        root.style.setProperty("--sab", `env(safe-area-inset-bottom, 0px)`);
        root.style.setProperty("--sal", `env(safe-area-inset-left, 0px)`);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Service worker registration (only on secure origins or localhost)
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isSecure && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[SETP-PWA] SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SETP-PWA] SW registration failed:", err);
        });
    }

    return () => {
      window.removeEventListener("pageshow", resetScroll);
      window.removeEventListener("hashchange", resetScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
