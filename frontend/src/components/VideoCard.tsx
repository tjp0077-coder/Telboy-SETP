import React from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius, shadow, spacing } from "@/src/theme";

type Props = {
  embedUrl: string;
  style?: ViewStyle;
};

/**
 * Vertical 9:16 video card. On web → real <iframe>, on native → WebView wrapping
 * an iframe inside an HTML scaffold so YouTube's player respects the aspect.
 * Autoplay muted, playsinline, loops the same video.
 */
export default function VideoCard({ embedUrl, style }: Props) {
  const url = `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1&playsinline=1&loop=1&modestbranding=1&rel=0&controls=1`;

  const html = `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
<style>
  html,body{margin:0;padding:0;background:#000;width:100%;height:100%;overflow:hidden;}
  iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
</style>
</head><body>
<iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
</body></html>`;

  return (
    <View style={[styles.card, shadow.card, style]} testID="schedule-video-card">
      <View style={styles.frame}>
        {Platform.OS === "web" ? (
          // @ts-ignore — web platform supports raw iframe via React Native Web
          <iframe
            src={url}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: 0, display: "block" }}
          />
        ) : (
          <WebView
            source={{ html }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            style={{ flex: 1, backgroundColor: "#000" }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  frame: {
    aspectRatio: 9 / 16,
    backgroundColor: "#000",
    overflow: "hidden",
  },
});
