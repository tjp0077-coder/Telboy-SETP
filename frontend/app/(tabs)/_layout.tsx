import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnread } from "@/src/UnreadContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnread();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 14);
  const tabHeight = 72 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F2C265",
        tabBarInactiveTintColor: "rgba(245,240,230,0.78)",
        tabBarStyle: {
          backgroundColor: "rgba(15,26,46,0.96)",
          borderTopColor: "rgba(245,240,230,0.1)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingTop: 10,
          paddingBottom: bottomPad,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.3,
          marginTop: 0,
          marginBottom: 4,
          includeFontPadding: false,
        },
      }}
    >
      <Tabs.Screen
        name="index"
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
          tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
