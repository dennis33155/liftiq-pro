import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  variant?: "icon" | "labeled";
};

export function HeaderHomeButton({ variant = "icon" }: Props) {
  const colors = useColors();

  const goHome = () => {
    try {
      router.dismissAll();
    } catch {
      // ignore: not in a stack with anything to dismiss
    }
    router.replace("/");
  };

  if (variant === "labeled") {
    return (
      <Pressable
        onPress={goHome}
        hitSlop={10}
        style={({ pressed }) => [
          styles.labeled,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Feather name="home" size={14} color={colors.foreground} />
        <Text style={[styles.labeledText, { color: colors.foreground }]}>
          Home
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={goHome}
      hitSlop={12}
      style={({ pressed }) => [
        styles.icon,
        { opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Feather name="home" size={20} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  labeled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labeledText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
