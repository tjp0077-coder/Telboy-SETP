// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * +html.tsx — wraps every page in a custom HTML document on the web.
 * Adds:
 *   - PWA metadata (manifest, theme colour, apple-touch-icon)
 *   - Service-worker registration
 *   - Existing scroll-lock + body fixed-positioning preserved.
 * Has no effect on iOS / Android native builds.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-GB" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* ── PWA metadata ─────────────────────────────────────────── */}
        <title>EDI SETP 2026 — Symposium Hub</title>
        <meta
          name="description"
          content="Official delegate companion app for the SETP European Symposium, Edinburgh — schedule, comms, city guide."
        />
        <meta name="theme-color" content="#1A2841" />
        <link rel="manifest" href="/manifest.webmanifest" />

        {/* iOS / Safari */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SETP 2026" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* Standard favicons */}
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-512.png" type="image/png" sizes="512x512" />

        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --sat: env(safe-area-inset-top, 0px);
                --sar: env(safe-area-inset-right, 0px);
                --sab: env(safe-area-inset-bottom, 0px);
                --sal: env(safe-area-inset-left, 0px);
              }
              html, body {
                background-color: #1A2841;
                height: 100%;
                height: 100dvh;
                overscroll-behavior: none;
                -webkit-tap-highlight-color: transparent;
              }
              #root { background-color: #1A2841; }
              body > div:first-child {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
                height: 100% !important;
                height: 100dvh !important;
                overscroll-behavior: none;
              }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />

        {/* ── Layout-stability: safe-area + bfcache back-nav fix ────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                // Keep --sat CSS var in sync with actual inset so RN components
                // that use it stay correctly positioned after back navigation.
                function updateSat() {
                  var sat = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
                  document.documentElement.style.setProperty('--sat-px', sat + 'px');
                }
                updateSat();

                // pageshow fires when page is restored from bfcache (back button).
                // Force a reflow so position:fixed root realigns with the viewport.
                window.addEventListener('pageshow', function (e) {
                  if (e.persisted) {
                    var el = document.body;
                    el.style.display = 'none';
                    void el.offsetHeight;
                    el.style.display = '';
                    updateSat();
                  }
                });

                // Keep a --vvh custom property that tracks the visual viewport
                // height. On iOS the browser chrome can resize it; 100dvh alone
                // is not always stable across navigations.
                function setVvh() {
                  var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                  document.documentElement.style.setProperty('--vvh', h + 'px');
                }
                setVvh();
                if (window.visualViewport) {
                  window.visualViewport.addEventListener('resize', setVvh);
                }
                window.addEventListener('resize', setVvh);
              })();
            `,
          }}
        />

        {/* ── Service-worker registration ──────────────────────────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (!('serviceWorker' in navigator)) return;
                // Only register on secure origins (https) or localhost.
                var isSecure = location.protocol === 'https:' ||
                               location.hostname === 'localhost' ||
                               location.hostname === '127.0.0.1';
                if (!isSecure) return;
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function (reg) {
                      if (window && window.console) console.log('[SETP-PWA] SW registered', reg.scope);
                    })
                    .catch(function (err) {
                      if (window && window.console) console.warn('[SETP-PWA] SW registration failed', err);
                    });
                });
              })();
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
