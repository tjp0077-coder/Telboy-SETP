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

    // ── Layout stability: safe-area + bfcache back-nav fix ──────────
    // Tracks visual-viewport height as a CSS custom property so the
    // position:fixed root div stays flush with the screen on back nav.
    const setVvh = () => {
      const h = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      document.documentElement.style.setProperty("--vvh", `${h}px`);
    };
    setVvh();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setVvh);
    }
    window.addEventListener("resize", setVvh);

    // pageshow fires when the page is restored from the bfcache (back button).
    // Force a reflow so the position:fixed root realigns correctly.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        document.body.style.display = "none";
        void document.body.offsetHeight; // trigger reflow
        document.body.style.display = "";
        setVvh();
      }
    };
    window.addEventListener("pageshow", onPageShow);

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
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", setVvh);
      }
      window.removeEventListener("resize", setVvh);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}
