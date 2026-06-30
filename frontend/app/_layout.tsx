import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { usePwaSetup } from "@/src/hooks/usePwaSetup";
import { AuthProvider } from "@/src/AuthContext";
import { FavoritesProvider } from "@/src/useFavorites";
import { UnreadProvider } from "@/src/UnreadContext";
import PwaInstallBanner from "@/src/components/PwaInstallBanner";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  usePwaSetup();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <FavoritesProvider>
            <UnreadProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" options={{ presentation: "modal" }} />
                <Stack.Screen name="event/[id]" />
                <Stack.Screen name="speaker/[id]" />
                <Stack.Screen name="speaker-bios/[sessionId]" />
                <Stack.Screen name="contact" />
                <Stack.Screen name="inbox" />
                <Stack.Screen name="deleted-inbox" />
                <Stack.Screen name="deleted-feed" />
                <Stack.Screen name="admins" />
                <Stack.Screen name="prototypes" />
              </Stack>
              <PwaInstallBanner />
            </UnreadProvider>
          </FavoritesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
