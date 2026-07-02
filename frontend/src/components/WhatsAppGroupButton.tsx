import React from "react";
import { Alert, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import * as Linking from "expo-linking";
import { FontAwesome } from "@expo/vector-icons";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/FbIa9hKQR9zDucG8xdG3OU";
const WHATSAPP_GREEN = "#25D366";

type WhatsAppGroupButtonProps = {
  showBadge?: boolean;
  variant?: "card" | "fab";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function WhatsAppGroupButton({
  showBadge = false,
  variant = "card",
  style,
  testID,
}: WhatsAppGroupButtonProps) {
  const openGroup = React.useCallback(async () => {
    try {
      await Linking.openURL(WHATSAPP_GROUP_URL);
    } catch {
      Alert.alert(
        "Unable to open WhatsApp",
        "We couldn't open the Admin WhatsApp Group link. Please try again in a moment.",
      );
    }
  }, []);

  if (variant === "fab") {
    return (
      <TouchableOpacity
        onPress={openGroup}
        activeOpacity={0.9}
        style={[styles.fab, style]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Open Admin WhatsApp Group"
        accessibilityHint="Join Admin WhatsApp Group"
        title="Join Admin WhatsApp Group"
      >
        <View style={styles.iconWrap}>
          <FontAwesome name="whatsapp" size={26} color="#fff" />
          {showBadge ? <View style={styles.badge} /> : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={openGroup}
      activeOpacity={0.9}
      style={[styles.card, style]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Open Admin WhatsApp Group"
      accessibilityHint="Join Admin WhatsApp Group"
      title="Join Admin WhatsApp Group"
    >
      <View style={styles.cardIconWrap}>
        <FontAwesome name="whatsapp" size={24} color="#fff" />
        {showBadge ? <View style={styles.badge} /> : null}
      </View>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle}>Admin WhatsApp Group</Text>
        <Text style={styles.cardSubtitle}>Quick join for real-time committee updates</Text>
      </View>
      <FontAwesome name="angle-right" size={20} color={WHATSAPP_GREEN} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(37,211,102,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: WHATSAPP_GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    position: "relative",
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#123129",
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    color: "#3E5A51",
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: WHATSAPP_GREEN,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: 16,
    bottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E11D48",
    borderWidth: 1,
    borderColor: "#fff",
  },
});
