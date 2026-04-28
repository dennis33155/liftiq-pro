import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Category } from "@/lib/types";

type IconName = React.ComponentProps<typeof Feather>["name"];

const ICONS: Record<Category, IconName> = {
  Chest: "shield",
  Back: "layers",
  Legs: "trending-up",
  Arms: "zap",
  Shoulders: "triangle",
  "Full Body": "activity",
};

type Props = {
  category: Category;
  onPress: () => void;
};

export function CategoryCard({ category, onPress }: Props) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.accent, borderRadius: colors.radius },
        ]}
      >
        <Feather name={ICONS[category]} size={26} color={colors.primary} />
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {category}
      </Text>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
});
