import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnread } from "@/src/UnreadContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnread();
  const bottomSafeArea = Math.max(insets.bottom, 10);
  const tabBarHeight = 60; // Fixed icon area
  const totalTabHeight = tabBarHeight + bottomSafeArea; // Total including safe area

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#F2C265",
        tabBarInactiveTintColor: "rgba(245,240,230,0.78)",
        tabBarStyle: {
          backgroundColor: "#0F1A2E",
          borderTopColor: "rgba(245,240,230,0.1)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: totalTabHeight,
          paddingTop: 8,
          paddingBottom: bottomSafeArea,
          paddingHorizontal: 0,
          marginHorizontal: 0,
          marginBottom: 0,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
        },
        contentStyle: {
          paddingBottom: totalTabHeight,
          backgroundColor: "#1A2841",
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
          tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
