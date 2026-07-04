import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const QR_CODE = require("@/assets/images/qr-code.png");

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen} testID="share-qr-screen">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.backBtn, { top: insets.top + 12 }]}
        testID="share-back-btn"
      >
        <Ionicons name="arrow-back" size={22} color="#0B1A35" />
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>

      <View style={styles.qrWrap}>
        <Image
          source={QR_CODE}
          style={styles.qrImage}
          contentFit="contain"
          transition={150}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#061734",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#F2C265",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 7,
  },
  backBtnText: {
    color: "#0B1A35",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  qrWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: "10%",
    paddingBottom: 72,
  },
  qrImage: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 560,
  },
});
