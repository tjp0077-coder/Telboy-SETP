import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useUnread } from "@/src/UnreadContext";
import { BottomTabBar } from "@react-navigation/bottom-tabs";

/**
 * CustomTabBar — uses SafeAreaView edges={['bottom']} to force dark background into safe area
 */
function CustomTabBar(props) {
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ backgroundColor: "#0F1A2E" }}
    >
      <BottomTabBar
        {...props}
        safeAreaInsets={{ bottom: 0 }}
        style={[
          props.style,
          {
            backgroundColor: "#0F1A2E",
            borderTopColor: "rgba(245,240,230,0.1)",
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: 8,
            paddingBottom: 8,
            paddingHorizontal: 0,
            marginBottom: 0,
            marginHorizontal: 0,
            height: 60,
          },
        ]}
      />
    </SafeAreaView>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnread();
  const bottomSafeArea = Math.max(insets.bottom, 10);
  const tabBarHeight = 60 + bottomSafeArea; // Tab height + safe area

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#999999",
        tabBarInactiveTintColor: "#666666",
        tabBar: (props) => <CustomTabBar {...props} />,
        contentStyle: {
          paddingBottom: tabBarHeight,
          backgroundColor: "#1A2841",
          marginBottom: 0,
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
