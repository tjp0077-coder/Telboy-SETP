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
          content="width=device-width, initial-scale=1, viewport-fit=cover"
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
              html, body {
                margin: 0;
                padding: 0;
                background-color: #1A2841;
                width: 100%;
                height: 100%;
                height: 100dvh;
                overflow: hidden;
                -webkit-tap-highlight-color: transparent;
              }
              #root {
                background-color: #1A2841;
                width: 100%;
                height: 100%;
                height: 100dvh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }
              body > div:first-child {
                position: fixed !important;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100% !important;
                height: 100% !important;
                height: 100dvh !important;
                background-color: #1A2841 !important;
              }
            `,
          }}
        />

        {/* ── iOS PWA: early script to disable scroll restoration ─────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if ('scrollRestoration' in history) {
                  history.scrollRestoration = 'manual';
                }
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
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
      <body style={{ margin: 0, padding: 0, height: "100%", backgroundColor: "#1A2841" }}>
        {children}
      </body>
    </html>
  );
}
