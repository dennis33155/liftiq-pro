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
  onSuggest?: () => void;
  onAi?: () => void;
};

export function CategoryCard({ category, onPress, onSuggest, onAi }: Props) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const handleSuggest = () => {
    if (!onSuggest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSuggest();
  };

  const handleAi = () => {
    if (!onAi) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAi();
  };

  return (
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
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.main,
          { opacity: pressed ? 0.7 : 1 },
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
      </Pressable>
      {onAi ? (
        <Pressable
          onPress={handleAi}
          hitSlop={6}
          style={({ pressed }) => [
            styles.suggestBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              borderRadius: 999,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="cpu" size={14} color={colors.primaryForeground} />
          <Text
            style={[styles.suggestLabel, { color: colors.primaryForeground }]}
          >
            AI
          </Text>
        </Pressable>
      ) : null}
      {onSuggest ? (
        <Pressable
          onPress={handleSuggest}
          hitSlop={6}
          style={({ pressed }) => [
            styles.suggestBtn,
            {
              backgroundColor: colors.accent,
              borderColor: colors.border,
              borderRadius: 999,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="zap" size={14} color={colors.primary} />
          <Text
            style={[styles.suggestLabel, { color: colors.foreground }]}
          >
            Suggest
          </Text>
        </Pressable>
      ) : null}
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
  suggestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
