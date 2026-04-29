import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void | Promise<void>;
};

export function UpgradeProModal({ visible, onClose, onUpgrade }: Props) {
  const colors = useColors();
  const [busy, setBusy] = React.useState(false);

  const handleUpgrade = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await onUpgrade();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close upgrade prompt"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.primary + "22" },
            ]}
          >
            <Feather name="zap" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Upgrade to Pro
          </Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            Unlock AI coaching, unlimited history, and advanced insights.
          </Text>

          <Pressable
            onPress={handleUpgrade}
            disabled={busy}
            style={({ pressed }) => [
              styles.upgradeBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.upgradeLabel,
                { color: colors.primaryForeground },
              ]}
            >
              {busy ? "Activating..." : "Upgrade"}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [
              styles.cancelBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[styles.cancelLabel, { color: colors.mutedForeground }]}
            >
              Not now
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  upgradeBtn: {
    width: "100%",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  cancelLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
