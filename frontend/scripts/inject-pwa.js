#!/usr/bin/env node
/**
 * inject-pwa.js
 * ---------------------------------------------------------------------------
 * Expo Router with `web.output: "single"` (SPA mode) uses a default minimal
 * index.html template and does NOT apply app/+html.tsx during `expo export`.
 * As a result the production build is missing the PWA <head> tags and the
 * service-worker registration.
 *
 * This script runs AFTER `expo export --platform web` and patches
 * dist/index.html so the exported app is a fully installable, offline-capable
 * PWA with instant-update (network-first) behaviour.
 *
 * Idempotent: running it twice will not duplicate the injected block.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const INDEX = path.join(DIST, "index.html");
const MARKER = "<!-- pwa:injected -->";

const HEAD_BLOCK = `${MARKER}
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="Official delegate companion app for the SETP European Symposium, Edinburgh — schedule, comms, city guide." />
    <meta name="theme-color" content="#1A2841" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="SETP 2026" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
    <link rel="icon" href="/icons/icon-512.png" type="image/png" sizes="512x512" />
    <style>
      html, body, #root, #app {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        background-color: #0F1A2E;
      }
      body > div:first-child {
        background-color: #0F1A2E !important;
      }
    </style>
    <script>
      (function () {
        if (!('serviceWorker' in navigator)) return;
        var isSecure = location.protocol === 'https:' ||
                       location.hostname === 'localhost' ||
                       location.hostname === '127.0.0.1';
        if (!isSecure) return;
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(function (reg) { try { reg.update(); } catch (e) {} })
            .catch(function () {});
        });
      })();
    </script>`;

function main() {
  if (!fs.existsSync(INDEX)) {
    console.error("[inject-pwa] dist/index.html not found. Run `expo export --platform web` first.");
    process.exit(1);
  }

  let html = fs.readFileSync(INDEX, "utf8");

  if (html.includes(MARKER)) {
    console.log("[inject-pwa] PWA tags already present — skipping.");
    return;
  }

  if (!html.includes("</head>")) {
    console.error("[inject-pwa] Could not find </head> in index.html.");
    process.exit(1);
  }

  html = html.replace("</head>", `    ${HEAD_BLOCK}\n  </head>`);
  fs.writeFileSync(INDEX, html, "utf8");
  console.log("[inject-pwa] PWA head tags + service-worker registration injected into dist/index.html ✅");
}

main();
