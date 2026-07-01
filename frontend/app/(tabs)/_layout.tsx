import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useUnread } from "@/src/UnreadContext";

export default function TabLayout() {
  const { unreadCount } = useUnread();
  const { auth } = useAuth();
  const [hasUnreadInbox, setHasUnreadInbox] = useState(false);

  const refreshUnreadInbox = useCallback(async () => {
    if (!auth.username) {
      setHasUnreadInbox(false);
      return;
    }
    try {
      const threads = await api.listContact();
      setHasUnreadInbox(threads.some((thread) => !thread.read));
    } catch {
      // Keep current state if refresh fails.
    }
  }, [auth.username]);

  useEffect(() => {
    refreshUnreadInbox();
  }, [refreshUnreadInbox]);

  useEffect(() => {
    if (!auth.username) return;
    const intervalId = setInterval(refreshUnreadInbox, 30000);
    return () => clearInterval(intervalId);
  }, [auth.username, refreshUnreadInbox]);

  const isIOSWeb =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  const webSafeInset = isIOSWeb
    ? "env(safe-area-inset-bottom, constant(safe-area-inset-bottom))"
    : "env(safe-area-inset-bottom, 0px)";
  const webTabBarHeight = isIOSWeb
    ? `calc(48px + ${webSafeInset})`
    : `calc(60px + ${webSafeInset})`;

  return (
    <View style={styles.root}>
      <Tabs
        sceneContainerStyle={{ backgroundColor: "#1A2841" }}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#999999",
          tabBarInactiveTintColor: "#666666",
          tabBarStyle: {
            backgroundColor: "#0F1A2E",
            borderTopColor: "rgba(245,240,230,0.1)",
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: 8,
            paddingHorizontal: 0,
            margin: 0,
            ...Platform.select({
              web: {
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                height: webTabBarHeight,
                paddingBottom: webSafeInset,
              },
              default: {
                height: 60,
                paddingBottom: 0,
              },
            }),
          },
          tabBarItemStyle: {
            paddingVertical: 0,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarTestID: "tab-home",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarTestID: "tab-schedule",
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarTestID: "tab-messages",
          tabBarIcon: ({ color }) => <Ionicons name="megaphone" size={28} color={color} />,
          tabBarBadge: unreadCount > 0 ? " " : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#E63946",
            minWidth: 10,
            maxWidth: 10,
            height: 10,
            borderRadius: 5,
            marginLeft: -4,
            marginTop: 4,
          },
        }}
      />
      <Tabs.Screen
        name="city"
        options={{
          title: "City",
          tabBarTestID: "tab-city",
          tabBarIcon: ({ color }) => <Ionicons name="map" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarTestID: "tab-profile",
          tabBarIcon: ({ color }) => (
            <View style={styles.profileIconWrap}>
              <Ionicons name="person-circle" size={28} color={color} />
              {auth.username && hasUnreadInbox ? <View style={styles.profileUnreadDot} /> : null}
            </View>
          ),
        }}
      />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F1A2E",
    height: Platform.OS === "web" ? "100vh" : "100%",
  },
  profileIconWrap: {
    position: "relative",
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  profileUnreadDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E63946",
  },
});
